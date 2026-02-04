import { createPersistence } from '../shared/state-persistence.js';

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const defaults = {
  ringCount: 6,
  spokeCount: 12,
  gridRadius: 0.78,
  nodeBrightness: 0.65,
  nodeSize: 1.6,
  gridBrightness: 0.25,
  nodeRandomness: 0,
  // Background color (OKLCH)
  bgL: 0.18,
  bgC: 0.05,
  bgH: 275,
  // Grid color (OKLCH)
  gridL: 0.9,
  gridC: 0.02,
  gridH: 100,
  // Node color (OKLCH)
  nodeL: 0.92,
  nodeC: 0.08,
  nodeH: 90,
  // Motion
  rotationSpeed: 0,
  twinkleRate: 0,
  pulseAmplitude: 0,
  seed: 42,
};

const persistence = createPersistence('exploration-01');
const savedState = persistence.load();
const state = { ...defaults, ...(savedState || {}) };

let animationId = null;
let lastTime = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const randomFromSeed = (seed) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const resize = () => {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  render(0);
};

const isMotionActive = () => 
  state.rotationSpeed !== 0 || state.twinkleRate > 0 || state.pulseAmplitude > 0;

const startOrStopAnimation = () => {
  if (isMotionActive()) {
    if (!animationId) {
      lastTime = performance.now();
      animationId = requestAnimationFrame(tick);
    }
  } else if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
};

const tick = (time) => {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  render(time / 1000, delta);
  animationId = requestAnimationFrame(tick);
};

const buildGeometry = (width, height) => {
  const radius = Math.min(width, height) * state.gridRadius * 0.5;
  return {
    cx: width / 2,
    cy: height / 2,
    radius,
  };
};

const buildNodes = (geometry) => {
  const nodes = [];
  const ringCount = clamp(Math.round(state.ringCount), 2, 60);
  const spokeCount = clamp(Math.round(state.spokeCount), 4, 120);
  const rand = randomFromSeed(state.seed);
  const randomness = clamp(state.nodeRandomness, 0, 1);

  for (let ring = 1; ring <= ringCount; ring += 1) {
    const ringRadius = (geometry.radius * ring) / ringCount;
    for (let spoke = 0; spoke < spokeCount; spoke += 1) {
      const angle = (Math.PI * 2 * spoke) / spokeCount;
      const jitter = (rand() - 0.5) * 0.02 * geometry.radius;
      const randomAngle = rand() * Math.PI * 2;
      const randomRadius = Math.sqrt(rand()) * geometry.radius;
      const blendedRadius = ringRadius + jitter * (1 - randomness);
      const blendedAngle = angle;
      const x = Math.cos(blendedAngle) * blendedRadius * (1 - randomness) + Math.cos(randomAngle) * randomRadius * randomness;
      const y = Math.sin(blendedAngle) * blendedRadius * (1 - randomness) + Math.sin(randomAngle) * randomRadius * randomness;
      const finalRadius = Math.sqrt(x * x + y * y);
      const finalAngle = Math.atan2(y, x);
      nodes.push({
        ring,
        spoke,
        angle: finalAngle,
        radius: finalRadius,
      });
    }
  }
  return nodes;
};

const toOklch = (l, c, h, alpha = 1) => `oklch(${l} ${c} ${h} / ${alpha})`;

const drawBackground = (width, height, geometry) => {
  const bgInner = toOklch(clamp(state.bgL + 0.08, 0, 1), state.bgC, state.bgH);
  const bgOuter = toOklch(clamp(state.bgL - 0.1, 0, 1), state.bgC, state.bgH);
  const gradient = ctx.createRadialGradient(
    geometry.cx,
    geometry.cy,
    geometry.radius * 0.1,
    geometry.cx,
    geometry.cy,
    geometry.radius * 1.4
  );
  gradient.addColorStop(0, bgInner);
  gradient.addColorStop(0.6, toOklch(state.bgL, state.bgC, state.bgH));
  gradient.addColorStop(1, bgOuter);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  const grainCount = Math.floor((width * height) / 7000);
  for (let i = 0; i < grainCount; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
};

const polarToCartesian = (geometry, node, time = 0) => {
  const rotation = state.rotationSpeed * 0.2;
  const driftAngle = node.angle + time * rotation;
  const radiusPulse = 1 + Math.sin(time * 1.6 + node.ring) * state.pulseAmplitude * 0.08;
  const radius = node.radius * radiusPulse;
  return {
    x: geometry.cx + Math.cos(driftAngle) * radius,
    y: geometry.cy + Math.sin(driftAngle) * radius,
  };
};

const drawGrid = (geometry, time) => {
  const ringCount = clamp(Math.round(state.ringCount), 2, 60);
  const spokeCount = clamp(Math.round(state.spokeCount), 4, 120);
  const rotation = state.rotationSpeed * 0.2;
  const alpha = clamp(state.gridBrightness, 0, 1);
  ctx.save();
  ctx.strokeStyle = toOklch(state.gridL, state.gridC, state.gridH, 0.22 * alpha);
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const ringRadius = (geometry.radius * ring) / ringCount;
    ctx.beginPath();
    ctx.arc(geometry.cx, geometry.cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let spoke = 0; spoke < spokeCount; spoke += 1) {
    const angle = (Math.PI * 2 * spoke) / spokeCount + time * rotation;
    ctx.beginPath();
    ctx.moveTo(geometry.cx, geometry.cy);
    ctx.lineTo(
      geometry.cx + Math.cos(angle) * geometry.radius,
      geometry.cy + Math.sin(angle) * geometry.radius
    );
    ctx.stroke();
  }
  ctx.restore();
};

const drawNodes = (nodes, geometry, time) => {
  const size = state.nodeSize;
  const brightness = clamp(state.nodeBrightness, 0.05, 1);
  const twinkle = clamp(state.twinkleRate, 0, 1);
  ctx.save();
  nodes.forEach((node) => {
    const phase = node.ring * 0.9 + node.spoke * 0.35;
    const twinkleSpeed = 0.6 + twinkle * 2.8;
    const flicker = (Math.sin(time * twinkleSpeed + phase) + 1) / 2;
    const intensity = 0.3 + flicker * 0.7;
    const nodeAlpha = brightness * (1 - twinkle + twinkle * intensity);
    const nodeSize = size * (1 - twinkle * 0.35 + twinkle * intensity);
    ctx.fillStyle = toOklch(state.nodeL, state.nodeC, state.nodeH, nodeAlpha);
    const position = polarToCartesian(geometry, node, time);
    ctx.beginPath();
    ctx.arc(position.x, position.y, nodeSize, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
};

const render = (time = 0) => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const geometry = buildGeometry(width, height);
  const nodes = buildNodes(geometry);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, geometry);
  drawGrid(geometry, time);
  drawNodes(nodes, geometry, time);
};

// Listen for control changes from the Web Components
document.addEventListener('control-change', (event) => {
  const { key, value } = event.detail;
  
  // Handle color picker values (object with l, c, h)
  if (typeof value === 'object' && value !== null) {
    // Color picker returns { l, c, h } - map to state keys
    state[`${key}L`] = value.l;
    state[`${key}C`] = value.c;
    state[`${key}H`] = value.h;
  } else {
    // Slider returns a number
    state[key] = value;
  }
  
  // Auto-save state to localStorage
  persistence.save(state);
  
  startOrStopAnimation();
  if (!isMotionActive()) {
    render(0);
  }
});

// Sync control components with loaded state
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
};

// Wait for custom elements to be defined, then sync
customElements.whenDefined('slider-control').then(() => {
  customElements.whenDefined('oklch-picker').then(() => {
    // Small delay to ensure components are fully rendered
    requestAnimationFrame(syncControlsWithState);
  });
});

window.addEventListener("resize", resize);
resize();

// Start animation if loaded state has motion
startOrStopAnimation();
