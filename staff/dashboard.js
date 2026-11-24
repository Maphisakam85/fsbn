(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let client, role, userId, articles = [], categories = [], authors = [], topics = [], editing = null, dirty = false, busy = false, loadVersion = 0, active = false;
  let uploaded = null, previewUrl = null;
  const form = $('article-form');
  const status = text => { $('article-status').textContent = text; };
  const editorStatus = text => { $('editor-status').textContent = text; };
  const mayEdit = article => role !== 'author' || (article.status === 'draft' && authors.some(a => a.id === article.author_id && a.profile_id === userId));
  const guard = () => !busy && (!dirty || window.confirm('Discard unsaved article changes?'));
  function stop() { active = false; loadVersion++; $('editor').hidden = true; dirty = false; articles = []; $('articles').replaceChildren(); $('overview').textContent = ''; }
  function option(select, value, label) { const el = document.createElement('option'); el.value = value; el.textContent = label; select.append(el); }
  async function load() {
    const version = ++loadVersion; status('Loading articles…');
    const results = await Promise.all([
      client.from('articles').select('*').order('updated_at', {ascending:false}),
      client.from('categories').select('id,name').order('name'),
      client.from('authors').select('id,name,profile_id').order('name'),
      client.from('topics').select('id,name').order('name')
    ]);
    if (!active || version !== loadVersion) return;
    if (results.some(r => r.error)) { status('Could not load the dashboard. Check your connection and access, then reload.'); return; }
    [articles, categories, authors, topics] = results.map(r => r.data || []);
    renderList();
  }
  function renderList() {
    $('overview').replaceChildren();
    for (const state of ['draft','review','published','archived']) { const el = document.createElement('span'); el.textContent = `${state[0].toUpperCase()+state.slice(1)}: ${articles.filter(a => a.status === state).length}`; $('overview').append(el); }
    const list = $('articles'); list.replaceChildren();
    if (!articles.length) { status('No articles are available. Create an article to get started.'); return; }
    status(`${articles.length} ${articles.length === 1 ? 'article' : 'articles'} available.`);
    articles.forEach(article => {
      const row = document.createElement('div'); row.className = 'article-row';
      const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = article.headline; const meta = document.createElement('p'); meta.textContent = `${article.status}${article.is_demo ? ' · Demo content' : ''}`; copy.append(title, meta); row.append(copy);
      const actions = document.createElement('div'); actions.className = 'article-actions';
      if (mayEdit(article)) { const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => openEditor(article)); actions.append(edit); }
      if (role !== 'author') {
        if (article.status !== 'archived') { const archive = document.createElement('button'); archive.type = 'button'; archive.textContent = 'Archive'; archive.addEventListener('click', () => changeArticle(article, false)); actions.append(archive); }
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete'; remove.addEventListener('click', () => changeArticle(article, true)); actions.append(remove);
      }
      row.append(actions); list.append(row);
    });
  }
  async function changeArticle(article, remove) {
    if (!guard() || !window.confirm(`${remove ? 'Permanently delete' : 'Archive'} “${article.headline}”?`)) return;
    dirty = false; $('editor').hidden = true; status(remove ? 'Deleting article…' : 'Archiving article…');
    const query = remove ? client.from('articles').delete() : client.from('articles').update({status:'archived'});
    const result = await query.eq('id', article.id).select('id');
    if (result.error || !result.data || !result.data.length) { status(`Could not ${remove ? 'delete' : 'archive'} the article. Check your access and try again.`); return; }
    await load(); status(remove ? 'Article deleted.' : 'Article archived.');
  }
  async function openEditor(article) {
    if (!guard()) return;
    editing = article; uploaded = null; dirty = false; form.reset(); $('preview').hidden = true; editorStatus('');
    $('editor-title').textContent = article ? `Edit ${article.headline}` : 'Create article';
    const category = form.elements.category_id, author = form.elements.author_id;
    category.replaceChildren(); author.replaceChildren(); option(category, '', 'Select category'); option(author, '', 'Select author');
    categories.forEach(c => option(category,c.id,c.name));
    authors.filter(a => role !== 'author' || a.profile_id === userId).forEach(a => option(author,a.id,a.name));
    if (role === 'author' && author.options.length === 2) author.selectedIndex = 1;
    $('topic-options').replaceChildren();
    for (const topic of topics) { const label = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox'; box.value = topic.id; box.name = 'topic'; label.append(box, document.createTextNode(topic.name)); $('topic-options').append(label); }
    if (article) {
      for (const name of ['headline','slug','category_id','author_id','summary','body','image_alt_text','image_caption','image_credit','seo_title','seo_description']) form.elements[name].value = article[name] || '';
      editorStatus('Loading article topics…'); $('editor').hidden = false;
      const {data,error} = await client.from('article_topics').select('topic_id').eq('article_id', article.id);
      if (!active || editing !== article) return;
      if (error) { $('editor').hidden = true; status('Could not load article topics. Nothing was changed.'); return; }
      const selected = new Set(data.map(item => item.topic_id)); document.querySelectorAll('#topic-options input').forEach(box => { box.checked = selected.has(box.value); }); editorStatus('');
    }
    $('cover-state').textContent = article?.cover_image_id ? 'An existing cover image is attached. Select a file to replace it.' : 'No cover image selected.';
    $('publish').hidden = role === 'author'; $('editor').hidden = false; $('editor').scrollIntoView({behavior:'smooth'});
    if (role === 'author' && author.options.length < 2) editorStatus('Your account needs an author profile linked by an administrator before you can create a draft.');
    if (article?.is_demo) editorStatus('Demo content cannot be published. Create verified reporting separately.');
  }
  async function save(publish) {
    if (busy || !form.reportValidity()) return;
    if (publish && role === 'author') return;
    if (publish && editing?.is_demo) { editorStatus('Demo content cannot be published.'); return; }
    if (!publish && editing?.status === 'published' && !window.confirm('Saving as a draft will unpublish this article. Continue?')) return;
    const file = form.elements.cover_file.files[0];
    if (file && (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 10485760)) { editorStatus('Choose a JPEG, PNG, WebP or GIF image up to 10 MB.'); return; }
    if ((file || editing?.cover_image_id) && !form.elements.image_alt_text.value.trim()) { editorStatus('Add alt text for the cover image.'); form.elements.image_alt_text.focus(); return; }
    busy = true; form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = true; }); editorStatus('Saving article…');
    try {
      let cover = editing?.cover_image_id || null;
      if (file) {
        if (!uploaded || uploaded.file !== file) {
          const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type];
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const up = await client.storage.from('editorial-media').upload(path, file, {contentType:file.type, upsert:false});
          if (up.error) throw new Error('Image upload failed.');
          uploaded = {file, path, id:null};
        }
        if (!uploaded.id) {
          const result = await client.from('media_assets').insert({storage_path:uploaded.path,alt_text:form.elements.image_alt_text.value.trim(),caption:form.elements.image_caption.value.trim(),credit:form.elements.image_credit.value.trim()}).select('id').single();
          if (result.error) throw new Error('Image uploaded but its record could not be saved. Retry, or contact an administrator to clean up the upload.');
          uploaded.id = result.data.id;
        }
        cover = uploaded.id;
      }
      const data = {};
      for (const name of ['headline','slug','category_id','author_id','summary','body','image_alt_text','image_caption','image_credit','seo_title','seo_description']) data[name] = form.elements[name].value.trim();
      data.cover_image_id = cover; data.status = publish ? 'published' : 'draft'; data.published_at = publish ? (editing?.published_at || new Date().toISOString()) : null;
      const selected = [...document.querySelectorAll('#topic-options input:checked')].map(box => box.value);
      const result = await client.rpc('save_article',{p_id:editing?.id || null,p_article:data,p_topics:selected});
      if (result.error) throw new Error('Article could not be saved. Check access, duplicate slug and required fields.');
      dirty = false; editing = null; uploaded = null; $('editor').hidden = true; await load(); status(publish ? 'Article published.' : 'Draft saved.');
    } catch (error) { editorStatus(error.message || 'Unable to save. Please try again.'); }
    finally { busy = false; form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = false; }); }
  }
  form.addEventListener('input', () => { dirty = true; }); form.addEventListener('change', () => { dirty = true; });
  form.addEventListener('submit', event => { event.preventDefault(); save(false); });
  $('publish').addEventListener('click', () => { if (window.confirm('Publish this article?')) save(true); });
  $('new-article').addEventListener('click', () => openEditor(null));
  $('cancel-edit').addEventListener('click', () => { if (guard()) { dirty = false; $('editor').hidden = true; } });
  $('preview-button').addEventListener('click', async () => {
    $('preview-title').textContent = form.elements.headline.value; $('preview-summary').textContent = form.elements.summary.value;
    window.FSBNMarkdown.render($('preview-body'), form.elements.body.value); $('preview').hidden = false;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const image = $('preview-image'); const figure = $('preview-figure'); figure.hidden = true;
    image.alt = form.elements.image_alt_text.value; $('preview-caption').textContent = [form.elements.image_caption.value, form.elements.image_credit.value].filter(Boolean).join(' · ');
    const file = form.elements.cover_file.files[0];
    if (file && ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) { previewUrl = URL.createObjectURL(file); image.src = previewUrl; figure.hidden = false; }
    else if (editing?.cover_image_id) {
      const media = await client.from('media_assets').select('storage_path,external_url').eq('id', editing.cover_image_id).maybeSingle();
      if (media.data?.storage_path) { const result = await client.storage.from('editorial-media').createSignedUrl(media.data.storage_path, 60); if (result.data?.signedUrl) { image.src = result.data.signedUrl; figure.hidden = false; } }
      else if (media.data?.external_url?.startsWith('https://')) { image.src = media.data.external_url; figure.hidden = false; }
    }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.FSBN_DASHBOARD = { canLeave: guard, stop, async start(c, r, id) { if (active && role === r && userId === id) return; stop(); client = c; role = r; userId = id; active = true; await load(); } };
})();
