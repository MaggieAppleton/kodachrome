import { createPersistence } from '../shared/state-persistence.js';
import { createRenderer } from './renderer.js';

const canvas = document.getElementById('canvas');

const defaults = {
  // Base color (OKLCH) — warm gold like "Warmth" reference
  baseColorL: 0.55,
  baseColorC: 0.15,
  baseColorH: 80,
  colorRange: 0.2,
  colorShift: 15,
  // Warp
  warpStrength: 1.2,
  warpScale: 2.0,
  warpDetail: 3,
  // Light
  lightX: 0.6,
  lightY: 0.3,
  lightIntensity: 0.3,
  lightSize: 0.4,
  // Motion
  speed: 0.15,
  // Grain
  grainIntensity: 0.12,
  grainSize: 1.0,
};

const persistence = createPersistence('exploration-07');
const savedState = persistence.load();
const state = { ...defaults, ...(savedState || {}) };

const renderer = createRenderer(canvas);

let startTime = performance.now();

const tick = () => {
  const time = (performance.now() - startTime) / 1000;
  renderer.render(state, time);
  requestAnimationFrame(tick);
};

// Listen for control changes
document.addEventListener('control-change', (event) => {
  const { key, value } = event.detail;
  if (typeof value === 'object' && value !== null) {
    state[`${key}L`] = value.l;
    state[`${key}C`] = value.c;
    state[`${key}H`] = value.h;
  } else {
    state[key] = value;
  }
  persistence.save(state);
});

// Sync controls with loaded state
const syncControlsWithState = () => {
  document.querySelectorAll('slider-control').forEach(slider => {
    const key = slider.getAttribute('key');
    if (key && state[key] !== undefined) {
      slider.setAttribute('value', state[key]);
    }
  });
  document.querySelectorAll('oklch-picker').forEach(picker => {
    const key = picker.getAttribute('key');
    if (key) {
      const l = state[`${key}L`];
      const c = state[`${key}C`];
      const h = state[`${key}H`];
      if (l !== undefined) picker.setAttribute('lightness', l);
      if (c !== undefined) picker.setAttribute('chroma', c);
      if (h !== undefined) picker.setAttribute('hue', h);
    }
  });
};

// Listen for snapshot loads
document.addEventListener('snapshot-load', (event) => {
  const { state: newState } = event.detail;
  Object.assign(state, newState);
  syncControlsWithState();
});

// Wait for custom elements to be ready, then sync
Promise.all([
  customElements.whenDefined('slider-control'),
  customElements.whenDefined('oklch-picker'),
]).then(() => {
  requestAnimationFrame(syncControlsWithState);
});

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
tick();
