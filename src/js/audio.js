const widgetEl  = document.querySelector('.widget');
const widgetBtn = widgetEl.querySelector('.widget__btn');
const playBtn   = widgetEl.querySelector('.widget__ctrl--play');
const pauseBtn  = widgetEl.querySelector('.widget__ctrl--pause');
const stopBtn   = widgetEl.querySelector('.widget__ctrl--stop');

const synth = window.speechSynthesis;
let utterance        = null;
let audioState       = 'idle';
let currentHighlight = null;
let speechSegments   = [];

// Specific BEM selectors — no nesting between them so no duplicates in DOM order
const SPEAK_SEL = [
  '.hero__label', '.hero__title', '.hero__text',
  '.section__label', '.section__title',
  '.card__title', '.card__text',
  '.property__name', '.property__meta',
  '.step__title', '.step__text',
  '.stat__num',
  '.testimonial__text',
  '.cta__title', '.cta__text',
].join(', ');

// ── Build utterance text + character-range → element map ──

function buildSpeechContent() {
  const elements = [...document.querySelectorAll(`main ${SPEAK_SEL}`)];
  const segments = [];
  let text = '';

  elements.forEach(el => {
    const raw = el.innerText.replace(/\s+/g, ' ').trim();
    if (!raw) return;

    if (text) {
      // Sentence boundary = natural TTS pause; only add if not already punctuated
      text += /[.!?]$/.test(text) ? ' ' : '. ';
    }

    const start = text.length;
    text += raw;
    segments.push({ element: el, start, end: text.length });
  });

  return { text, segments };
}

// ── Highlight helpers ──────────────────────────────────────

function highlight(el) {
  if (currentHighlight === el) return;
  if (currentHighlight) currentHighlight.classList.remove('is-speaking');
  el.classList.add('is-speaking');
  currentHighlight = el;

  // Scroll into view if outside visible area (with some margin for the fixed header)
  const rect = el.getBoundingClientRect();
  if (rect.top < 80 || rect.bottom > window.innerHeight - 40) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearHighlight() {
  if (currentHighlight) {
    currentHighlight.classList.remove('is-speaking');
    currentHighlight = null;
  }
}

// ── State machine ──────────────────────────────────────────

function setAudioState(s) {
  audioState = s;
  widgetEl.dataset.state = s;
  widgetEl.classList.toggle('is-active', s !== 'idle');
  playBtn.disabled  = (s === 'playing' || s === 'loading');
  pauseBtn.disabled = (s !== 'playing');
  stopBtn.disabled  = (s === 'idle');
}

// ── Speech ─────────────────────────────────────────────────

function startSpeech() {
  if (audioState !== 'idle') return;
  setAudioState('loading');

  const { text, segments } = buildSpeechContent();
  speechSegments = segments;

  utterance        = new SpeechSynthesisUtterance(text);
  utterance.lang   = 'en-US';
  utterance.rate   = 0.9;
  utterance.pitch  = 1;

  utterance.onstart  = () => setAudioState('playing');
  utterance.onpause  = () => setAudioState('paused');
  utterance.onresume = () => setAudioState('playing');

  utterance.onend = () => {
    clearHighlight();
    utterance = null;
    setAudioState('idle');
  };

  utterance.onerror = () => {
    clearHighlight();
    utterance = null;
    setAudioState('idle');
  };

  // charIndex from boundary event maps into our concatenated text
  utterance.onboundary = (e) => {
    if (e.name !== 'word') return;
    const i   = e.charIndex;
    const seg = speechSegments.find(s => i >= s.start && i < s.end);
    if (seg) highlight(seg.element);
  };

  synth.speak(utterance);
}

// ── Controls ───────────────────────────────────────────────

widgetBtn.addEventListener('click', () => {
  if (audioState === 'idle') startSpeech();
});

playBtn.addEventListener('click', () => {
  if      (audioState === 'paused') synth.resume();
  else if (audioState === 'idle')   startSpeech();
});

pauseBtn.addEventListener('click', () => {
  if (audioState === 'playing') synth.pause();
});

stopBtn.addEventListener('click', () => {
  synth.cancel();
  clearHighlight();
  utterance = null;
  setAudioState('idle');
});

setAudioState('idle');
