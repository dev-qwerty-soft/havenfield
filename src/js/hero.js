import gsap from 'gsap';

const tl = gsap.timeline({ delay: 0.4 });
tl
  .to('.hero__label', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
  .fromTo('.hero__title', { opacity: 0, y: 50 },
    { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, '-=0.3')
  .fromTo('.hero__text', { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.4')
  .fromTo('.hero__btn', { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.4');
