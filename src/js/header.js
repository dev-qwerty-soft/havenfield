const burger = document.querySelector('.header__burger');
const nav    = document.querySelector('.header__nav');

function toggleMenu(open) {
  burger.classList.toggle('is-open', open);
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

burger.addEventListener('click', () => {
  toggleMenu(!nav.classList.contains('is-open'));
});

nav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => toggleMenu(false));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && nav.classList.contains('is-open')) toggleMenu(false);
});
