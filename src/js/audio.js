const widgetEl  = document.querySelector('.widget');
const widgetBtn = widgetEl.querySelector('.widget__btn');
const playBtn   = widgetEl.querySelector('.widget__ctrl--play');
const pauseBtn  = widgetEl.querySelector('.widget__ctrl--pause');
const stopBtn   = widgetEl.querySelector('.widget__ctrl--stop');

const PROXY_URL = 'https://havenfield.qwerty-soft.com/proxy.php';

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

let audioEl          = null;
let audioState       = 'idle';
let currentHighlight = null;
let wordTimeline     = []; // [{ element, startMs }]

// ── Build concatenated text + character-range → element map ──

function buildSpeechContent() {
  const elements = [...document.querySelectorAll(`main ${SPEAK_SEL}`)];
  const segments = [];
  let text = '';

  elements.forEach(el => {
    const raw = el.innerText.replace(/\s+/g, ' ').trim();
    if (!raw) return;

    if (text) {
      text += /[.!?]$/.test(text) ? ' ' : '. ';
    }

    const start = text.length;
    text += raw;
    segments.push({ element: el, start, end: text.length });
  });

  return { text, segments };
}

// Map each timestamp word to its DOM element by finding its char position in text
function buildTimeline(text, segments, timestamps) {
  const timeline = [];
  let searchFrom = 0;

  for (const t of timestamps) {
    const idx = text.indexOf(t.word, searchFrom);
    if (idx === -1) continue;
    searchFrom = idx + t.word.length;

    const seg = segments.find(s => idx >= s.start && idx < s.end);
    if (seg) timeline.push({ element: seg.element, startMs: t.start_ms });
  }

  return timeline;
}

// ── Highlight helpers ──────────────────────────────────────

function highlight(el) {
  if (currentHighlight === el) return;
  if (currentHighlight) currentHighlight.classList.remove('is-speaking');
  if (!el) return;
  el.classList.add('is-speaking');
  currentHighlight = el;

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

async function startSpeech() {
  if (audioState !== 'idle') return;
  setAudioState('loading');

  const { text, segments } = buildSpeechContent();

  let data;
  try {
    const res = await fetch(PROXY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('TTS fetch failed:', err);
    setAudioState('idle');
    return;
  }

  // base64 MP3 → Blob URL
  const binary = atob(data.audio);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));

  audioEl = new Audio(blobUrl);

  const timestamps = data.timestamps ?? [];

  if (timestamps.length > 0) {
    // Use real word timestamps: locate each word by char position, no index drift
    wordTimeline = buildTimeline(text, segments, timestamps);
  } else {
    // Fallback: distribute segment highlights proportionally by character count
    audioEl.addEventListener('loadedmetadata', () => {
      const totalMs    = audioEl.duration * 1000;
      const totalChars = text.length;
      wordTimeline = segments.map(seg => ({
        element: seg.element,
        startMs: (seg.start / totalChars) * totalMs,
      }));
    });
  }

  audioEl.addEventListener('play',  () => setAudioState('playing'));
  audioEl.addEventListener('pause', () => setAudioState('paused'));
  audioEl.addEventListener('ended', () => {
    clearHighlight();
    URL.revokeObjectURL(blobUrl);
    audioEl      = null;
    wordTimeline = [];
    setAudioState('idle');
  });

  // Highlight the element that owns the current word
  audioEl.addEventListener('timeupdate', () => {
    const ms = audioEl.currentTime * 1000;
    let current = null;
    for (const w of wordTimeline) {
      if (w.startMs <= ms) current = w;
      else break;
    }
    highlight(current ? current.element : null);
  });

  audioEl.play();
}

// ── Controls ───────────────────────────────────────────────

widgetBtn.addEventListener('click', () => {
  if (audioState === 'idle') startSpeech();
});

playBtn.addEventListener('click', () => {
  if      (audioState === 'paused') audioEl?.play();
  else if (audioState === 'idle')   startSpeech();
});

pauseBtn.addEventListener('click', () => {
  if (audioState === 'playing') audioEl?.pause();
});

stopBtn.addEventListener('click', () => {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
  clearHighlight();
  wordTimeline = [];
  setAudioState('idle');
});

setAudioState('idle');
