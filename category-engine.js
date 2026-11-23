(() => {
  const page = window.FSBN_CATEGORY;
  const grid = document.querySelector('#article-grid');
  const topicSelect = document.querySelector('#topic-filter');
  const sortSelect = document.querySelector('#sort-order');
  const count = document.querySelector('#results-count');
  const loadButton = document.querySelector('#load-more');
  const empty = document.querySelector('#empty-state');
  const pageSize = 3;
  let shown = pageSize;

  document.title = `${page.title} | FSBN`;
  document.querySelector('#category-title').textContent = page.title;
  document.querySelector('#category-description').textContent = page.description;
  document.querySelector('#category-crumb').textContent = page.title;
  const topics = [...new Set(page.articles.map(article => article.topic))].sort();
  topics.forEach(topic => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.append(option);
  });

  function update() {
    const topic = topicSelect.value;
    const direction = sortSelect.value;
    let articles = page.articles.filter(article => topic === 'all' || article.topic === topic);
    articles.sort((a, b) => {
      if (direction === 'oldest') return a.date.localeCompare(b.date);
      if (direction === 'title') return a.title.localeCompare(b.title);
      return b.date.localeCompare(a.date);
    });
    const visible = articles.slice(0, shown);
    grid.innerHTML = visible.map(article => `
      <article class="article" id="${article.slug}">
        <a class="thumb" href="#${article.slug}" aria-label="Read: ${article.title}">
          <img src="${article.image}" alt="${article.alt}" loading="lazy"><span>${article.topic.toUpperCase()}</span>
        </a>
        <div class="copy"><span class="meta">${page.shortLabel.toUpperCase()} · ${article.readTime} MIN READ</span>
          <h2><a href="#${article.slug}">${article.title}</a></h2><p>${article.summary}</p>
          <div class="byline">${article.author} · ${article.dateLabel}</div><a class="read" href="#${article.slug}">Read story →</a>
        </div>
      </article>`).join('');
    grid.querySelectorAll('img').forEach(image => image.addEventListener('error', () => { image.style.visibility = 'hidden'; }));
    count.textContent = `Showing ${visible.length} of ${articles.length} ${articles.length === 1 ? 'story' : 'stories'}`;
    empty.style.display = articles.length ? 'none' : 'block';
    loadButton.hidden = visible.length >= articles.length;
  }

  topicSelect.addEventListener('change', () => { shown = pageSize; update(); });
  sortSelect.addEventListener('change', update);
  loadButton.addEventListener('click', () => { shown += pageSize; update(); });
  document.querySelector('#clear-filters').addEventListener('click', () => {
    topicSelect.value = 'all';
    sortSelect.value = 'newest';
    shown = pageSize;
    update();
  });
  update();
})();
