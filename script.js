const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-inner');
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.querySelector('.menu-icon').textContent = expanded ? '☰' : '×';
  nav.classList.toggle('expanded', !expanded);
});

const searchOpen = document.querySelector('#search-open');
const searchForm = document.querySelector('#search-form');
searchOpen.addEventListener('click', () => {
  searchForm.classList.toggle('open');
  if (searchForm.classList.contains('open')) document.querySelector('#search-input').focus();
});
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  const query = document.querySelector('#search-input').value.trim();
  if (query) {
    const cards = [...document.querySelectorAll('.story-card')];
    let matches = 0;
    cards.forEach(card => {
      const found = card.textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase());
      card.hidden = !found;
      if (found) matches++;
    });
    document.querySelector('#latest').scrollIntoView({ behavior: 'smooth' });
    document.querySelector('#latest .section-heading h2').textContent = matches ? `Stories for “${query}”` : `No stories found for “${query}”`;
  }
});

document.querySelector('#newsletter-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = document.querySelector('#email');
  const message = document.querySelector('.form-message');
  if (!email.checkValidity()) {
    email.reportValidity();
    return;
  }
  message.textContent = 'The subscription service is not connected yet, so your address has not been saved.';
  email.value = '';
});
