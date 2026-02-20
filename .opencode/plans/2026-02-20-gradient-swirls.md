# Exploration 07: Gradient Swirls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an animated gradient canvas with domain-warped swirls, specular highlights, and grain — reproducing the organic, fabric-like gradient effects from the reference images.

**Architecture:** WebGL fragment shader using Inigo Quilez-style domain warping (noise fed into noise coordinates) to generate organic swirl/fold shapes. A monochromatic color scheme with tonal variation creates depth. A soft specular highlight adds a light source effect. Film grain overlay gives texture. All parameters exposed via the existing control panel system.

**Tech Stack:** Raw WebGL (no libraries), GLSL shaders, existing shared controls and state persistence.

---

### Task 1: Create the folder and HTML/CSS files

**Files:**
- Create: `exploration-07/index.html`
- Create: `exploration-07/styles.css`

**Step 1: Create the folder**

```bash
mkdir -p exploration-07
```

**Step 2: Create `exploration-07/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Exploration 07 - Gradient Swirls</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <a class="back" href="../index.html">Back</a>
    <snapshot-manager></snapshot-manager>

    <control-panel title="Gradient Swirls">
      <panel-section title="Color">
        <oklch-picker key="baseColor" label="Base Color" lightness="0.55" chroma="0.15" hue="80"></oklch-picker>
        <slider-control key="colorRange" label="Tonal Range" min="0.05" max="0.5" step="0.01" value="0.2"></slider-control>
        <slider-control key="colorShift" label="Hue Shift" min="0" max="60" step="1" value="15"></slider-control>
      </panel-section>

      <panel-section title="Warp">
        <slider-control key="warpStrength" label="Strength" min="0" max="3" step="0.05" value="1.2"></slider-control>
        <slider-control key="warpScale" label="Scale" min="0.5" max="5" step="0.1" value="2.0"></slider-control>
        <slider-control key="warpDetail" label="Detail" min="1" max="6" step="1" value="3"></slider-control>
      </panel-section>

      <panel-section title="Light">
        <slider-control key="lightX" label="Position X" min="0" max="1" step="0.01" value="0.6"></slider-control>
        <slider-control key="lightY" label="Position Y" min="0" max="1" step="0.01" value="0.3"></slider-control>
        <slider-control key="lightIntensity" label="Intensity" min="0" max="1" step="0.01" value="0.3"></slider-control>
        <slider-control key="lightSize" label="Size" min="0.1" max="1" step="0.01" value="0.4"></slider-control>
      </panel-section>

      <panel-section title="Motion">
        <slider-control key="speed" label="Speed" min="0" max="1" step="0.01" value="0.15"></slider-control>
      </panel-section>

      <panel-section title="Grain">
        <slider-control key="grainIntensity" label="Intensity" min="0" max="0.4" step="0.01" value="0.12"></slider-control>
        <slider-control key="grainSize" label="Size" min="0.5" max="3" step="0.1" value="1.0"></slider-control>
      </panel-section>
    </control-panel>

    <canvas id="canvas"></canvas>

    <script type="module" src="../shared/controls/index.js"></script>
    <script type="module" src="./script.js"></script>
  </body>
</html>
```

**Step 3: Create `exploration-07/styles.css`**

Use the standard exploration styles from AGENTS.md (same as exploration-02).

```css
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  background: #1a1a1c;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.back {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 10;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 12px;
  padding: 6px 10px;
  background: rgba(14, 12, 16, 0.7);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  transition: color 0.15s ease, border-color 0.15s ease;
}

.back:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
}
```

---

### Task 2: Write the fragment shader with domain warping

**Files:**
- Create: `exploration-07/shaders.js`

This is the core of the effect. The shader uses:
1. **Simplex noise** — same implementation as exploration-02
2. **FBM (Fractal Brownian Motion)** — layered noise octaves
3. **Domain warping** — the key technique. Feed noise output back as coordinate offsets for a second and third noise layer. This creates the organic swirl/fold/crease shapes.
4. **Monochromatic tonal mapping** — takes a single base color and varies lightness across the warp field
5. **Specular highlight** — soft radial glow at a controllable position
6. **Film grain** — animated noise overlay

```js
export const vertexShader = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const fragmentShader = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform float u_time;
  uniform vec2 u_resolution;
  
  // Base color in linear RGB + tonal controls
  uniform vec3 u_baseColor;
  uniform float u_colorRange;
  uniform float u_colorShift;
  
  // Warp controls
  uniform float u_warpStrength;
  uniform float u_warpScale;
  uniform float u_warpDetail;
  
  // Light
  uniform vec2 u_lightPos;
  uniform float u_lightIntensity;
  uniform float u_lightSize;
  
  // Motion
  uniform float u_speed;
  
  // Grain
  uniform float u_grainIntensity;
  uniform float u_grainSize;
  
  // ============================================
  // Simplex noise (same as exploration-02)
  // ============================================
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // ============================================
  // FBM with detail control
  // ============================================
  
  float fbm(vec2 p, float detail) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= detail) break;
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  // ============================================
  // Film grain
  // ============================================
  
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  
  float grain(vec2 uv, float time, float size) {
    vec2 grainCoord = uv * u_resolution / size;
    return hash(grainCoord + fract(time * 43.0)) - 0.5;
  }
  
  // ============================================
  // Main — Domain Warping (Inigo Quilez technique)
  // ============================================
  
  void main() {
    vec2 uv = v_uv;
    float time = u_time * u_speed;
    
    // Aspect-corrected coordinates
    vec2 p = uv;
    p.x *= u_resolution.x / u_resolution.y;
    p *= u_warpScale;
    
    // --- Domain warping: 3 layers of noise-into-noise ---
    
    // First warp layer
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0) + time * vec2(0.12, 0.08), u_warpDetail),
      fbm(p + vec2(5.2, 1.3) + time * vec2(-0.08, 0.1), u_warpDetail)
    );
    
    // Second warp layer (feeds from first)
    vec2 r = vec2(
      fbm(p + u_warpStrength * q + vec2(1.7, 9.2) + time * vec2(0.05, -0.06), u_warpDetail),
      fbm(p + u_warpStrength * q + vec2(8.3, 2.8) + time * vec2(-0.04, 0.07), u_warpDetail)
    );
    
    // Final warped noise value
    float f = fbm(p + u_warpStrength * r + time * vec2(0.02, 0.03), u_warpDetail);
    
    // --- Map warped noise to tonal color ---
    
    // f ranges roughly -1 to 1, normalize to 0-1
    float t = f * 0.5 + 0.5;
    
    // Use the warp layers to create tonal variation
    // Mix of q and r magnitudes gives the "fold depth"
    float foldDepth = length(q) * 0.5 + length(r) * 0.3;
    
    // Create light and dark variations of the base color
    vec3 darkColor = u_baseColor * (1.0 - u_colorRange);
    vec3 lightColor = u_baseColor * (1.0 + u_colorRange * 0.8) + vec3(u_colorRange * 0.3);
    
    // Slight hue shift for the light areas (warmer/cooler)
    float hueShiftAmount = u_colorShift / 360.0;
    lightColor.r += hueShiftAmount * 0.3;
    lightColor.b -= hueShiftAmount * 0.2;
    
    // Blend based on warped noise
    vec3 color = mix(darkColor, lightColor, t);
    
    // Add fold shadows/highlights from the domain warp
    color *= 0.85 + 0.3 * smoothstep(-0.5, 0.5, f);
    
    // --- Specular highlight ---
    
    vec2 lightUv = uv;
    lightUv.x *= u_resolution.x / u_resolution.y;
    vec2 lightPosAspect = u_lightPos;
    lightPosAspect.x *= u_resolution.x / u_resolution.y;
    
    float lightDist = distance(lightUv, lightPosAspect);
    float highlight = exp(-lightDist * lightDist / (u_lightSize * u_lightSize * 0.5));
    color += highlight * u_lightIntensity * vec3(1.0, 0.98, 0.95);
    
    // --- Grain ---
    
    float g = grain(uv, u_time, u_grainSize);
    color += g * u_grainIntensity;
    
    // Clamp
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
```

**Key design notes:**
- The domain warping creates the organic fold/swirl shapes. `q` warps `r`, which warps the final `fbm` call. Each layer feeds into the next.
- `u_warpStrength` controls how dramatically the coordinates get displaced — higher values = deeper folds and more dramatic swirls.
- `u_warpScale` controls the overall zoom level of the noise field.
- `u_warpDetail` controls FBM octaves — more = finer detail in the folds.
- Color is monochromatic: single base color varied between dark and light versions based on the warped noise value.
- The specular highlight is a simple gaussian falloff from a controllable point.

---

### Task 3: Write the WebGL renderer

**Files:**
- Create: `exploration-07/renderer.js`

Follow the same pattern as `exploration-02/renderer.js`. Key differences:
- Different uniform set (base color instead of 3 colors, warp params, light params)
- Single OKLCH-to-RGB conversion for the base color

```js
import { vertexShader, fragmentShader } from './shaders.js';

function oklchToLinearRgb(l, c, h) {
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  
  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bOut = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  
  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, bOut))
  ];
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) { console.error('WebGL not supported'); return null; }
  
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  if (!vs || !fs) return null;
  
  const program = createProgram(gl, vs, fs);
  if (!program) return null;
  
  // Fullscreen quad
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1
  ]), gl.STATIC_DRAW);
  
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  
  const uniforms = {
    time: gl.getUniformLocation(program, 'u_time'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    baseColor: gl.getUniformLocation(program, 'u_baseColor'),
    colorRange: gl.getUniformLocation(program, 'u_colorRange'),
    colorShift: gl.getUniformLocation(program, 'u_colorShift'),
    warpStrength: gl.getUniformLocation(program, 'u_warpStrength'),
    warpScale: gl.getUniformLocation(program, 'u_warpScale'),
    warpDetail: gl.getUniformLocation(program, 'u_warpDetail'),
    lightPos: gl.getUniformLocation(program, 'u_lightPos'),
    lightIntensity: gl.getUniformLocation(program, 'u_lightIntensity'),
    lightSize: gl.getUniformLocation(program, 'u_lightSize'),
    speed: gl.getUniformLocation(program, 'u_speed'),
    grainIntensity: gl.getUniformLocation(program, 'u_grainIntensity'),
    grainSize: gl.getUniformLocation(program, 'u_grainSize'),
  };
  
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  
  function render(state, time) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform1f(uniforms.time, time);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    
    const rgb = oklchToLinearRgb(state.baseColorL, state.baseColorC, state.baseColorH);
    gl.uniform3fv(uniforms.baseColor, rgb);
    gl.uniform1f(uniforms.colorRange, state.colorRange);
    gl.uniform1f(uniforms.colorShift, state.colorShift);
    
    gl.uniform1f(uniforms.warpStrength, state.warpStrength);
    gl.uniform1f(uniforms.warpScale, state.warpScale);
    gl.uniform1f(uniforms.warpDetail, state.warpDetail);
    
    gl.uniform2f(uniforms.lightPos, state.lightX, state.lightY);
    gl.uniform1f(uniforms.lightIntensity, state.lightIntensity);
    gl.uniform1f(uniforms.lightSize, state.lightSize);
    
    gl.uniform1f(uniforms.speed, state.speed);
    gl.uniform1f(uniforms.grainIntensity, state.grainIntensity);
    gl.uniform1f(uniforms.grainSize, state.grainSize);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  
  return { resize, render };
}
```

---

### Task 4: Write the main script with state persistence

**Files:**
- Create: `exploration-07/script.js`

Same pattern as exploration-02.

```js
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

document.addEventListener('snapshot-load', (event) => {
  const { state: newState } = event.detail;
  Object.assign(state, newState);
  syncControlsWithState();
});

Promise.all([
  customElements.whenDefined('slider-control'),
  customElements.whenDefined('oklch-picker'),
]).then(() => {
  requestAnimationFrame(syncControlsWithState);
});

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
tick();
```

---

### Task 5: Register in the main grid

**Files:**
- Modify: `script.js` (root) — add entry to the `explorations` array

Add this entry after the exploration-06 object:

```js
  {
    id: "exploration-07",
    title: "Gradient Swirls",
    desc: "Domain-warped gradient swirls with grain and light",
  },
```

---

### Task 6: Test and iterate

- Run `npx vite` and open `exploration-07/index.html`
- Verify the shader compiles (check console for errors)
- Test all controls respond in real time
- Test snapshot save/load
- Try different color picker values — should work across the full hue range
- Check performance (should be 60fps)
- If the effect looks flat, increase `warpStrength` default
- If the folds are too busy, decrease `warpDetail` default
