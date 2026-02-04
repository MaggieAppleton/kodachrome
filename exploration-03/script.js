import { createPersistence } from '../shared/state-persistence.js';
import { createRenderer } from './renderer.js';

const canvas = document.getElementById('canvas');
const asciiCanvas = document.getElementById('ascii-canvas');
const asciiCtx = asciiCanvas.getContext('2d');

const defaults = {
  image: 'flower1',
  // Grain
  grainAmount: 0,
  grainSize: 1,
  grainAnimated: false,
  // Dithering
  ditherMode: 'none',
  ditherIntensity: 0.5,
  ditherColors: 4,
  // Halftone
  halftoneAmount: 0,
  halftoneSize: 6,
  halftoneAngle: 45,
  halftoneCMYK: false,
  // Pixelation
  pixelSize: 1,
  pixelShape: 'square',
  // Color
  brightness: 1,
  posterize: 32,
  saturation: 1,
  contrast: 1,
  // ASCII
  asciiSize: 0,
  asciiColor: true,
};

const persistence = createPersistence('exploration-03');
const savedState = persistence.load();
const state = { ...defaults, ...(savedState || {}) };

const renderer = createRenderer(canvas);

// Image loading
const images = {};
let currentImage = null;

async function loadImage(name) {
  if (images[name]) {
    currentImage = images[name];
    renderer.loadImage(currentImage);
    return;
  }
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = (e) => {
      console.error(`Failed to load image: ${name}`, e);
      reject(e);
    };
    // Try JPG first, fallback to PNG
    img.src = `./${name}.jpg`;
    img.onerror = () => {
      img.onerror = reject;
      img.src = `./${name}.png`;
    };
  });
  
  images[name] = img;
  currentImage = img;
  renderer.loadImage(img);
}

// ASCII rendering
const ASCII_CHARS = ' .:-=+*#%@';

function renderASCII() {
  if (state.asciiSize <= 0) {
    asciiCanvas.style.display = 'none';
    canvas.style.display = 'block';
    return;
  }
  
  asciiCanvas.style.display = 'block';
  canvas.style.display = 'none';
  
  const cellSize = state.asciiSize;
  const { width, height } = renderer.getImageSize();
  
  // Size ASCII canvas to match main canvas display
  const displayWidth = parseInt(canvas.style.width);
  const displayHeight = parseInt(canvas.style.height);
  const dpr = window.devicePixelRatio || 1;
  
  asciiCanvas.width = displayWidth * dpr;
  asciiCanvas.height = displayHeight * dpr;
  asciiCanvas.style.width = displayWidth + 'px';
  asciiCanvas.style.height = displayHeight + 'px';
  
  // Read pixels from WebGL canvas
  const gl = canvas.getContext('webgl');
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  
  // Calculate grid dimensions
  const cols = Math.floor(width / cellSize);
  const rows = Math.floor(height / cellSize);
  
  // Clear and set up context
  asciiCtx.fillStyle = '#000';
  asciiCtx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);
  
  const fontSize = (cellSize * dpr * displayWidth) / width;
  asciiCtx.font = `${fontSize}px monospace`;
  asciiCtx.textAlign = 'center';
  asciiCtx.textBaseline = 'middle';
  
  const scaleX = (displayWidth * dpr) / width;
  const scaleY = (displayHeight * dpr) / height;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Sample center of cell
      const px = Math.floor(col * cellSize + cellSize / 2);
      const py = Math.floor(row * cellSize + cellSize / 2);
      
      // WebGL pixels are bottom-up
      const flippedY = height - 1 - py;
      const idx = (flippedY * width + px) * 4;
      
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      
      // Calculate luminance
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Pick character based on luminance
      const charIdx = Math.floor(lum * (ASCII_CHARS.length - 1));
      const char = ASCII_CHARS[charIdx];
      
      // Position on ASCII canvas
      const x = (col * cellSize + cellSize / 2) * scaleX;
      const y = (row * cellSize + cellSize / 2) * scaleY;
      
      if (state.asciiColor) {
        asciiCtx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        asciiCtx.fillStyle = '#fff';
      }
      
      asciiCtx.fillText(char, x, y);
    }
  }
}

let animationId = null;
let startTime = performance.now();

const resize = () => {
  renderer.resize();
};

const tick = () => {
  const time = (performance.now() - startTime) / 1000;
  renderer.render(state, time);
  
  // Only render ASCII if enabled, and throttle it
  if (state.asciiSize > 0) {
    renderASCII();
  }
  
  animationId = requestAnimationFrame(tick);
};

// Control handling
document.addEventListener('control-change', (event) => {
  const { key, value } = event.detail;
  state[key] = value;
  
  // Handle image change
  if (key === 'image') {
    loadImage(value);
  }
  
  // Handle ASCII toggle
  if (key === 'asciiSize') {
    if (value <= 0) {
      asciiCanvas.style.display = 'none';
      canvas.style.display = 'block';
    }
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
  
  document.querySelectorAll('select-control').forEach(select => {
    const key = select.getAttribute('key');
    if (key && state[key] !== undefined) {
      select.setAttribute('value', state[key]);
    }
  });
  
  document.querySelectorAll('checkbox-control').forEach(checkbox => {
    const key = checkbox.getAttribute('key');
    if (key && state[key] !== undefined) {
      checkbox.setAttribute('checked', state[key] ? 'true' : 'false');
    }
  });
};

// Listen for snapshot loads
document.addEventListener('snapshot-load', (event) => {
  const { state: newState } = event.detail;
  Object.assign(state, newState);
  syncControlsWithState();
  
  // Reload image if it changed
  if (newState.image && newState.image !== state.image) {
    loadImage(newState.image);
  }
});

// Wait for custom elements then initialize
Promise.all([
  customElements.whenDefined('slider-control'),
  customElements.whenDefined('select-control'),
  customElements.whenDefined('checkbox-control'),
]).then(() => {
  requestAnimationFrame(syncControlsWithState);
});

// Initialize
window.addEventListener('resize', resize);
loadImage(state.image).then(() => {
  tick();
});
