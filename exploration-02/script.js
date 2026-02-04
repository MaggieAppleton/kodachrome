import { createPersistence } from '../shared/state-persistence.js';
import { createRenderer } from './renderer.js';

const canvas = document.getElementById('canvas');

const defaults = {
  // Color 1 (OKLCH) - purple
  color1L: 0.65,
  color1C: 0.2,
  color1H: 280,
  // Color 2 (OKLCH) - teal
  color2L: 0.7,
  color2C: 0.18,
  color2H: 180,
  // Color 3 (OKLCH) - orange
  color3L: 0.55,
  color3C: 0.22,
  color3H: 30,
  // Motion
  speed: 0.3,
  // Blobs
  blobSize: 0.8,
  softness: 0.5,
  complexity: 2,
  // Grain
  grainStyle: 'film',
  grainIntensity: 0.15,
  halftoneSize: 4.0,
};

const persistence = createPersistence('exploration-02');
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
