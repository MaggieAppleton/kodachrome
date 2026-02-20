import { createPersistence } from '../shared/state-persistence.js';
import { createRenderer } from './renderer.js';

const canvas = document.getElementById('canvas');

const defaults = {
  // Primary color (OKLCH) - aurora green
  primaryColorL: 0.75,
  primaryColorC: 0.22,
  primaryColorH: 155,
  // Secondary color (OKLCH) - purple accent
  secondaryColorL: 0.5,
  secondaryColorC: 0.15,
  secondaryColorH: 280,
  // Sky color (OKLCH) - dark blue
  skyColorL: 0.15,
  skyColorC: 0.05,
  skyColorH: 220,
  // Aurora
  intensity: 1,
  curtainCount: 4,
  waveSpeed: 0.5,
  verticalStretch: 0.8,
  // Stars
  starDensity: 0.5,
  starBrightness: 0.6,
};

const persistence = createPersistence('exploration-05');
const savedState = persistence.load();
const state = { ...defaults, ...(savedState || {}) };

const renderer = createRenderer(canvas);

let animationId = null;
let startTime = performance.now();

const resize = () => {
  renderer.resize();
};

const tick = () => {
  const time = (performance.now() - startTime) / 1000;
  renderer.render(state, time);
  animationId = requestAnimationFrame(tick);
};

// Listen for control changes
document.addEventListener('control-change', (event) => {
  const { key, value } = event.detail;
  
  // Handle color picker values (object with l, c, h)
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
  // Sync sliders
  document.querySelectorAll('slider-control').forEach(slider => {
    const key = slider.getAttribute('key');
    if (key && state[key] !== undefined) {
      slider.setAttribute('value', state[key]);
    }
  });
  
  // Sync color pickers
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
  
  // Sync select controls
  document.querySelectorAll('select-control').forEach(select => {
    const key = select.getAttribute('key');
    if (key && state[key] !== undefined) {
      select.setAttribute('value', state[key]);
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
  customElements.whenDefined('select-control'),
]).then(() => {
  requestAnimationFrame(syncControlsWithState);
});

window.addEventListener('resize', resize);
resize();
tick();
