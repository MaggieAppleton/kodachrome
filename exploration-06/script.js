import { createPersistence } from '../shared/state-persistence.js';

// State
const defaults = {
  theme: 'dark',
  speed: 1,
  easing: 'ease-in-out',
  glowIntensity: 0.8,
  glowSize: 4,
  glowL: 0.7,
  glowC: 0.15,
  glowH: 145
};

// Easing curves as cubic-bezier values
const easingCurves = {
  'linear': 'linear',
  'ease': 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  'quad-in': 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  'quad-out': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  'quad-in-out': 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
  'cubic-in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  'cubic-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  'cubic-in-out': 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  'quart-in': 'cubic-bezier(0.895, 0.03, 0.685, 0.22)',
  'quart-out': 'cubic-bezier(0.165, 0.84, 0.44, 1)',
  'quart-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
  'circ-in': 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
  'circ-out': 'cubic-bezier(0.075, 0.82, 0.165, 1)',
  'circ-in-out': 'cubic-bezier(0.785, 0.135, 0.15, 0.86)',
  'back-in': 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
  'back-out': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  'back-in-out': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
};

const persistence = createPersistence('exploration-06');
const savedState = persistence.load();
const state = { ...defaults, ...(savedState || {}) };

// Convert OKLCH to CSS
const oklchToCss = (l, c, h) => `oklch(${l} ${c} ${h})`;

// Update CSS variables from state
const updateStyles = () => {
  const root = document.documentElement;
  const glowColor = oklchToCss(state.glowL, state.glowC, state.glowH);
  
  // Base duration adjusted by speed
  const baseDuration = 1.2 / state.speed;
  
  // Get easing curve
  const easing = easingCurves[state.easing] || 'ease-in-out';
  
  // Theme colors
  const isDark = state.theme === 'dark';
  const bgColor = isDark ? '#0a0a0a' : '#fafafa';
  const labelColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
  
  // Boost lightness for glow on light mode to avoid dark halo
  const glowL = isDark ? state.glowL : Math.min(state.glowL + 0.25, 0.95);
  const glowColorForShadow = oklchToCss(glowL, state.glowC, state.glowH);
  
  root.style.setProperty('--glow-color', glowColor);
  root.style.setProperty('--glow-color-shadow', glowColorForShadow);
  root.style.setProperty('--glow-size', `${state.glowSize}px`);
  root.style.setProperty('--glow-size-max', `${state.glowSize * 2}px`);
  root.style.setProperty('--glow-intensity', state.glowIntensity);
  root.style.setProperty('--animation-duration', `${baseDuration}s`);
  root.style.setProperty('--animation-easing', easing);
  root.style.setProperty('--bg-color', bgColor);
  root.style.setProperty('--label-color', labelColor);
  
  // Update SVG colors directly
  document.querySelectorAll('.logo-full').forEach(svg => {
    svg.style.color = glowColor;
    svg.style.filter = `drop-shadow(0 0 ${state.glowSize}px ${glowColorForShadow})`;
  });
};

// Sync controls with state
const syncControlsWithState = () => {
  document.querySelectorAll('slider-control').forEach(slider => {
    const key = slider.getAttribute('key');
    if (key && state[key] !== undefined) {
      slider.setAttribute('value', state[key]);
    }
  });
  
  document.querySelectorAll('select-control').forEach(select => {
    const key = select.getAttribute('key');
    if (key && state[key] !== undefined) {
      select.setAttribute('value', state[key]);
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

// Handle control changes
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
  updateStyles();
});

// Handle snapshot loads
document.addEventListener('snapshot-load', (event) => {
  const { state: newState } = event.detail;
  Object.assign(state, newState);
  syncControlsWithState();
  updateStyles();
});

// Initialize
updateStyles();

customElements.whenDefined('slider-control').then(() => {
  customElements.whenDefined('oklch-picker').then(() => {
    requestAnimationFrame(syncControlsWithState);
  });
});
