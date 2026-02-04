/**
 * GLSL shaders for grainy gradient effect
 */

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
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform float u_speed;
  uniform float u_blobSize;
  uniform float u_softness;
  uniform float u_complexity;
  uniform int u_grainStyle; // 0=film, 1=ordered, 2=halftone
  uniform float u_grainIntensity;
  uniform float u_halftoneSize;
  
  // ============================================
  // Simplex noise functions
  // Based on Ashima Arts implementation
  // ============================================
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,   // (3.0-sqrt(3.0))/6.0
      0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
      -0.577350269189626,  // -1.0 + 2.0 * C.x
      0.024390243902439    // 1.0 / 41.0
    );
    
    // First corner
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    
    // Other corners
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    
    // Permutations
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    
    // Gradients
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    
    // Compute final noise value
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // Fractal Brownian Motion for richer noise
  // Complexity controls octaves: more = more detail/intertwining
  float fbm(vec2 p, float time, float complexity) {
    float value = 0.0;
    float amplitude = 0.6;
    float frequency = 1.0;
    
    // Loop up to 5 octaves, but use complexity to control how many
    for (int i = 0; i < 5; i++) {
      if (float(i) >= complexity) break;
      value += amplitude * snoise(p * frequency + time * 0.05);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  // ============================================
  // Grain/dither functions
  // ============================================
  
  // Random hash for film grain
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  
  // Film grain - animated random noise
  float filmGrain(vec2 uv, float time) {
    return hash(uv * u_resolution + fract(time * 100.0)) - 0.5;
  }
  
  // 4x4 Bayer matrix for ordered dithering
  float bayerMatrix(vec2 uv) {
    vec2 pixel = floor(mod(uv * u_resolution, 4.0));
    int x = int(pixel.x);
    int y = int(pixel.y);
    
    // Bayer 4x4 pattern (normalized to -0.5 to 0.5)
    float pattern[16];
    pattern[0] = 0.0;    pattern[1] = 8.0;    pattern[2] = 2.0;    pattern[3] = 10.0;
    pattern[4] = 12.0;   pattern[5] = 4.0;    pattern[6] = 14.0;   pattern[7] = 6.0;
    pattern[8] = 3.0;    pattern[9] = 11.0;   pattern[10] = 1.0;   pattern[11] = 9.0;
    pattern[12] = 15.0;  pattern[13] = 7.0;   pattern[14] = 13.0;  pattern[15] = 5.0;
    
    int index = y * 4 + x;
    float value = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i == index) value = pattern[i];
    }
    
    return (value / 16.0) - 0.5;
  }
  
  // Halftone dots
  float halftone(vec2 uv, float luminance) {
    float dotSize = u_halftoneSize;
    vec2 pixel = uv * u_resolution;
    vec2 cell = floor(pixel / dotSize);
    vec2 cellCenter = (cell + 0.5) * dotSize;
    float dist = length(pixel - cellCenter);
    
    // Radius based on luminance (darker = bigger dots)
    float maxRadius = dotSize * 0.5;
    float radius = maxRadius * (1.0 - luminance);
    
    return (dist < radius) ? -0.3 : 0.1;
  }
  
  // ============================================
  // Color space conversion
  // ============================================
  
  // Linear RGB to luminance
  float luminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }
  
  // ============================================
  // Main
  // ============================================
  
  void main() {
    vec2 uv = v_uv;
    float time = u_time * u_speed;
    
    // Aspect-corrected coordinates for noise sampling
    vec2 aspectUv = uv;
    aspectUv.x *= u_resolution.x / u_resolution.y;
    
    // Scale for blob size (lower = bigger blobs)
    vec2 noiseCoord = aspectUv * u_blobSize;
    
    // Sample noise at different offsets for each color
    // Using slow-moving offsets creates the organic drift
    float n1 = fbm(noiseCoord + vec2(0.0, 0.0) + time * vec2(0.15, 0.1), time, u_complexity);
    float n2 = fbm(noiseCoord + vec2(3.7, 1.2) + time * vec2(-0.1, 0.12), time, u_complexity);
    float n3 = fbm(noiseCoord + vec2(1.4, 4.3) + time * vec2(0.08, -0.11), time, u_complexity);
    
    // Convert noise to blend weights
    // Softness controls the smoothstep range (higher = more blending/overlap)
    float edge = u_softness;
    float w1 = smoothstep(-edge, edge, n1);
    float w2 = smoothstep(-edge, edge, n2);
    float w3 = smoothstep(-edge, edge, n3);
    
    // Ensure we always have coverage (no black background)
    // Boost minimum weights so colors always blend
    w1 = max(w1, 0.1);
    w2 = max(w2, 0.1);
    w3 = max(w3, 0.1);
    
    // Normalize weights so they sum to 1
    float total = w1 + w2 + w3;
    w1 /= total;
    w2 /= total;
    w3 /= total;
    
    // Blend colors
    vec3 color = u_color1 * w1 + u_color2 * w2 + u_color3 * w3;
    
    // Apply grain/dither effect
    float grain = 0.0;
    
    if (u_grainStyle == 0) {
      // Film grain
      grain = filmGrain(uv, u_time);
    } else if (u_grainStyle == 1) {
      // Ordered dithering
      grain = bayerMatrix(uv);
    } else if (u_grainStyle == 2) {
      // Halftone
      grain = halftone(uv, luminance(color));
    }
    
    color += grain * u_grainIntensity;
    
    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
