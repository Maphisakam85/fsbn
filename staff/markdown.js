/* Deliberately limited Markdown renderer: raw input is never interpreted as HTML. */
(function (root) {
  function render(target, markdown) {
    target.replaceChildren();
    let list = null;
    for (const line of String(markdown || '').split(/\r?\n/)) {
      if (!line.trim()) { list = null; continue; }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      const item = /^\s*[-*]\s+(.+)$/.exec(line);
      let el;
      if (item) { if (!list) { list = document.createElement('ul'); target.append(list); } el = document.createElement('li'); list.append(el); }
      else { list = null; el = document.createElement(heading ? `h${heading[1].length + 1}` : 'p'); target.append(el); }
      const text = item ? item[1] : heading ? heading[2] : line;
      for (const [i, part] of text.split(/\*\*(.+?)\*\*/g).entries()) {
        if (i % 2) { const strong = document.createElement('strong'); strong.textContent = part; el.append(strong); }
        else el.append(document.createTextNode(part));
      }
    }
  }
  root.FSBNMarkdown = { render };
})(window);
