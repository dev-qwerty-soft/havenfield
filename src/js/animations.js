import gsap from 'gsap';

// Widget — smooth entrance after page load
gsap.fromTo('.widget',
  { opacity: 0, y: -12 },
  { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 1.4 }
);

// Header glass effect on scroll
window.addEventListener('scroll', () => {
  document.querySelector('.header').classList.toggle('is-scrolled', window.scrollY > 40);
});

// ── Scroll reveal helpers ─────────────────────────────────

const reveal = (selector, from, overrides = {}) => {
  gsap.utils.toArray(selector).forEach(el => {
    gsap.fromTo(el, from, {
      opacity: 1, x: 0, y: 0, scale: 1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
      ...overrides,
    });
  });
};

const revealGroup = (parentSelector, childSelector, from, overrides = {}) => {
  gsap.utils.toArray(parentSelector).forEach(parent => {
    gsap.fromTo(parent.querySelectorAll(childSelector), from, {
      opacity: 1, x: 0, y: 0, scale: 1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: parent,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
      ...overrides,
    });
  });
};

// ── Reveals ───────────────────────────────────────────────

reveal('.section__label', { opacity: 0, y: 20 }, { duration: 0.6, scrollTrigger: { trigger: '.section__label', start: 'top 88%', toggleActions: 'play none none reverse' } });

gsap.utils.toArray('.section__title, .cta__title').forEach(el => {
  gsap.fromTo(el,
    { opacity: 0, y: 55 },
    { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } }
  );
});

revealGroup('.cards', '.card',
  { opacity: 0, y: 50 },
  { stagger: 0.15 }
);

revealGroup('.properties', '.property',
  { opacity: 0, y: 60, scale: 0.97 },
  { duration: 0.9, stagger: 0.18 }
);

revealGroup('.steps', '.step',
  { opacity: 0, x: -40 },
  { stagger: 0.2 }
);

gsap.fromTo('.stats .stat',
  { opacity: 0, y: 30, scale: 0.88 },
  { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.7)', stagger: 0.12,
    scrollTrigger: { trigger: '.stats', start: 'top 80%', toggleActions: 'play none none reverse' } }
);

gsap.fromTo('.testimonial',
  { opacity: 0, x: -40 },
  { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15,
    scrollTrigger: { trigger: '.testimonials', start: 'top 80%', toggleActions: 'play none none reverse' } }
);

gsap.fromTo('.cta__text',
  { opacity: 0, y: 25 },
  { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '.section--cta', start: 'top 72%', toggleActions: 'play none none reverse' } }
);
gsap.fromTo('.section--cta .btn',
  { opacity: 0, y: 20 },
  { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '.section--cta', start: 'top 66%', toggleActions: 'play none none reverse' } }
);

gsap.fromTo('.contact-form',
  { opacity: 0, y: 40 },
  { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '.contact-form', start: 'top 85%', toggleActions: 'play none none reverse' } }
);
