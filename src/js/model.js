import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { pivot, camera, renderer, onFrame } from './scene.js';

pivot.position.x = 2.5;

// Process section — house glides right as section enters, returns as it exits
const processTl = gsap.timeline({
  scrollTrigger: {
    trigger: '#process',
    start: 'top 80%',
    end: 'bottom 20%',
    scrub: 2,
  },
});
processTl
  .to(pivot.position, { x: 3.4, ease: 'power2.out' })
  .to(pivot.position, { x: 2.5, ease: 'power2.in'  });

// ── Proxy objects ─────────────────────────────────────────
// GSAP writes to these; onFrame applies them to pivot.
// This prevents scroll-scrub and mouse code from conflicting.

const scrollRot = { y: 0 };
const scrollScl = { value: 1 };
const hoverProxy = { scale: 1 };
const dragProxy  = { offsetY: 0 }; // GSAP snap-back tweens this

// ── Interaction state ─────────────────────────────────────

let isDragging    = false;
let dragStartX    = 0;
let dragStartOff  = 0; // dragProxy.offsetY value when drag began
let isHovered     = false;
let modelMeshes   = [];

const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function isInHero() {
  return window.scrollY < window.innerHeight * 0.6;
}

function updateMouse(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
}

function hitTest() {
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObjects(modelMeshes, true).length > 0;
}

function enterHover() {
  if (isHovered) return;
  isHovered = true;
  gsap.to(hoverProxy, { scale: 1.09, duration: 0.35, ease: 'power2.out' });
  canvas.style.cursor = 'grab';
}

function leaveHover() {
  if (!isHovered) return;
  isHovered = false;
  gsap.to(hoverProxy, { scale: 1, duration: 0.35, ease: 'power2.out' });
  canvas.style.cursor = '';
}

// ── Mouse events ──────────────────────────────────────────

canvas.addEventListener('mousedown', (e) => {
  if (!isInHero() || modelMeshes.length === 0) return;
  updateMouse(e);
  if (!hitTest()) return;

  // Kill any ongoing snap-back so drag starts from current visual position
  gsap.killTweensOf(dragProxy);

  isDragging   = true;
  dragStartX   = e.clientX;
  dragStartOff = dragProxy.offsetY;
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const raw = dragStartOff + (e.clientX - dragStartX) * 0.012;
    // Clamp to ±90°
    dragProxy.offsetY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, raw));
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (!isInHero() || modelMeshes.length === 0) {
    leaveHover();
    return;
  }

  updateMouse(e);
  hitTest() ? enterHover() : leaveHover();
});

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;

  // Snap-back to scroll-only position
  gsap.to(dragProxy, { offsetY: 0, duration: 1.1, ease: 'elastic.out(1, 0.55)' });

  // Small movement = click → scroll to Process section
  if (Math.abs(e.clientX - dragStartX) < 6) {
    document.getElementById('process').scrollIntoView({ behavior: 'smooth' });
  }

  // Update hover state after release
  updateMouse(e);
  if (isInHero() && modelMeshes.length > 0 && hitTest()) {
    enterHover();
  } else {
    leaveHover();
  }
});

canvas.addEventListener('mouseleave', () => { leaveHover(); });

// ── onFrame: apply all proxy values to pivot ──────────────

onFrame.push(() => {
  pivot.rotation.y = scrollRot.y + dragProxy.offsetY;
  pivot.scale.setScalar(scrollScl.value * hoverProxy.scale);
});

// ── Load model ────────────────────────────────────────────

const loaderEl  = document.getElementById('loader');
const pageStart  = Date.now();

const loader = new GLTFLoader();
loader.load(import.meta.env.BASE_URL + 'models/Bambo_House.gltf', (gltf) => {
  const loaded = gltf.scene;

  const box    = new THREE.Box3().setFromObject(loaded);
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());

  const baseScale = 4.5 / Math.max(size.x, size.y, size.z);

  loaded.position.sub(center);
  pivot.add(loaded);

  loaded.traverse(obj => { if (obj.isMesh) modelMeshes.push(obj); });

  scrollScl.value = baseScale;

  gsap.to(scrollRot, {
    y: Math.PI * 3,
    ease: 'none',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.5,
    },
  });

  gsap.to(scrollScl, {
    value: baseScale * 2.2,
    ease: 'power1.inOut',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.5,
    },
  });

  // Hide loader — minimum 900ms display so it doesn't flash
  const delay = Math.max(0, 900 - (Date.now() - pageStart));
  setTimeout(() => {
    gsap.to(loaderEl, {
      opacity: 0,
      duration: 0.7,
      ease: 'power2.inOut',
      onComplete: () => loaderEl.remove(),
    });
  }, delay);
});
