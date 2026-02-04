import { createPersistence } from '../shared/state-persistence.js';

// Animation patterns: delays in ms for each of the 9 cells [0-8]
// Grid layout:
// [0] [1] [2]
// [3] [4] [5]
// [6] [7] [8]
const patterns = {
  'wave-lr': {
    delays: [0, 100, 200, 0, 100, 200, 0, 100, 200],
    duration: 600
  },
  'wave-rl': {
    delays: [200, 100, 0, 200, 100, 0, 200, 100, 0],
    duration: 600
  },
  'wave-tb': {
    delays: [0, 0, 0, 100, 100, 100, 200, 200, 200],
    duration: 600
  },
  'wave-bt': {
    delays: [200, 200, 200, 100, 100, 100, 0, 0, 0],
    duration: 600
  },
  'spiral-cw': {
    // Clockwise from top-left: 0,1,2,5,8,7,6,3,4
    delays: [0, 50, 100, 350, 400, 150, 300, 250, 200],
    duration: 500
  },
  'spiral-ccw': {
    // Counter-clockwise: 0,3,6,7,8,5,2,1,4
    delays: [0, 350, 100, 50, 400, 250, 150, 200, 300],
    duration: 500
  },
  'diagonal-tl': {
    // Diagonal waves from top-left
    delays: [0, 100, 200, 100, 200, 300, 200, 300, 400],
    duration: 500
  },
  'pulse-center': {
    // Center pulses out
    delays: [200, 100, 200, 100, 0, 100, 200, 100, 200],
    duration: 400
  },
  'corners': {
    // Corners light up, then edges, then center
    delays: [0, 150, 0, 150, 300, 150, 0, 150, 0],
    duration: 400
  }
};

// State
const defaults = {
  speed: 1,
  glowIntensity: 0.7,
  glowSize: 8,
  glowL: 0.7,
  glowC: 0.2,
  glowH: 145
};

const persistence = createPersistence('exploration-04');
const savedState = persistence.load();
const state = { ...defaults, ...(savedState || {}) };

// Convert OKLCH to approximate RGB for CSS
const oklchToRgb = (l, c, h) => {
  // Simplified conversion - using CSS oklch() directly is better
  // but for box-shadow we need a fallback
  return `oklch(${l} ${c} ${h})`;
};

// Initialize all loaders
const initLoaders = () => {
  const loaders = document.querySelectorAll('.loader');
  
  loaders.forEach(loader => {
    const patternName = loader.dataset.pattern;
    const pattern = patterns[patternName];
    
    if (!pattern) return;
    
    // Create 9 cells
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      cell.dataset.delay = pattern.delays[i];
      cell.dataset.duration = pattern.duration;
      loader.appendChild(cell);
    }
  });
};

// Animation loop
let animationId = null;
let startTime = null;

const animate = (timestamp) => {
  if (!startTime) startTime = timestamp;
  
  const cells = document.querySelectorAll('.cell');
  const speed = state.speed;
  
  cells.forEach(cell => {
    const delay = parseFloat(cell.dataset.delay);
    const duration = parseFloat(cell.dataset.duration);
    
    // Adjust for speed
    const adjustedDelay = delay / speed;
    const adjustedDuration = duration / speed;
    const totalCycle = adjustedDuration * 2 + adjustedDelay;
    
    // Calculate current position in cycle
    const elapsed = (timestamp - startTime) % (totalCycle + 200); // +200 for pause between cycles
    const timeInCycle = elapsed - adjustedDelay;
    
    let opacity = 0.15; // base dim state
    
    if (timeInCycle >= 0 && timeInCycle < adjustedDuration * 2) {
      // Sine wave for smooth fade in/out
      const progress = timeInCycle / (adjustedDuration * 2);
      opacity = 0.15 + 0.85 * Math.sin(progress * Math.PI);
    }
    
    cell.style.setProperty('--cell-opacity', opacity);
    
    // Add/remove lit class for glow
    if (opacity > 0.5) {
      cell.classList.add('lit');
    } else {
      cell.classList.remove('lit');
    }
  });
  
  animationId = requestAnimationFrame(animate);
};

// Update CSS variables from state
const updateStyles = () => {
  const root = document.documentElement;
  const glowColor = oklchToRgb(state.glowL, state.glowC, state.glowH);
  
  root.style.setProperty('--glow-color', glowColor);
  root.style.setProperty('--glow-size', `${state.glowSize}px`);
  root.style.setProperty('--glow-spread', `${state.glowSize * 0.25}px`);
  root.style.setProperty('--glow-intensity', state.glowIntensity);
  
  // Update cell styles
  document.querySelectorAll('.cell').forEach(cell => {
    cell.style.backgroundColor = glowColor;
  });
  
  document.querySelectorAll('.cell.lit').forEach(cell => {
    const intensity = state.glowIntensity;
    const size = state.glowSize;
    cell.style.boxShadow = `0 0 ${size}px ${size * 0.25}px ${glowColor}`;
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

// Initialize
initLoaders();
updateStyles();

customElements.whenDefined('slider-control').then(() => {
  customElements.whenDefined('oklch-picker').then(() => {
    requestAnimationFrame(syncControlsWithState);
  });
});

// Start animation
animationId = requestAnimationFrame(animate);
