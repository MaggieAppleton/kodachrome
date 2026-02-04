/**
 * GLSL shaders for image treatment effects
 */

export const vertexShader = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_uv;
  
  void main() {
    v_uv = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const fragmentShader = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  uniform float u_time;
  
  // Grain
  uniform float u_grainAmount;
  uniform float u_grainSize;
  uniform bool u_grainAnimated;
  
  // Dithering
  uniform int u_ditherMode; // 0=none, 1=bayer2, 2=bayer4, 3=bayer8
  uniform float u_ditherIntensity;
  uniform float u_ditherColors;
  
  // Halftone
  uniform float u_halftoneAmount;
  uniform float u_halftoneSize;
  uniform float u_halftoneAngle;
  uniform bool u_halftoneCMYK;
  
  // Pixelation
  uniform float u_pixelSize;
  uniform int u_pixelShape; // 0=square, 1=circle, 2=diamond
  
  // Color
  uniform float u_posterize;
  uniform float u_saturation;
  uniform float u_contrast;
  
  // ============================================
  // Utility functions
  // ============================================
  
  float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  float luminance(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }
  
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  
  // ============================================
  // Bayer dithering matrices
  // ============================================
  
  float bayer2(vec2 pos) {
    int x = int(mod(pos.x, 2.0));
    int y = int(mod(pos.y, 2.0));
    float m[4];
    m[0] = 0.0; m[1] = 2.0;
    m[2] = 3.0; m[3] = 1.0;
    int idx = y * 2 + x;
    float val = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i == idx) val = m[i];
    }
    return val / 4.0;
  }
  
  float bayer4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    float m[16];
    m[0] = 0.0;  m[1] = 8.0;  m[2] = 2.0;  m[3] = 10.0;
    m[4] = 12.0; m[5] = 4.0;  m[6] = 14.0; m[7] = 6.0;
    m[8] = 3.0;  m[9] = 11.0; m[10] = 1.0; m[11] = 9.0;
    m[12] = 15.0; m[13] = 7.0; m[14] = 13.0; m[15] = 5.0;
    int idx = y * 4 + x;
    float val = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i == idx) val = m[i];
    }
    return val / 16.0;
  }
  
  float bayer8(vec2 pos) {
    // Recursive bayer using 4x4 as base
    vec2 p = mod(pos, 8.0);
    float base = bayer4(p);
    int quadX = int(p.x) / 4;
    int quadY = int(p.y) / 4;
    float offset[4];
    offset[0] = 0.0; offset[1] = 2.0;
    offset[2] = 3.0; offset[3] = 1.0;
    int quadIdx = quadY * 2 + quadX;
    float quadOffset = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i == quadIdx) quadOffset = offset[i];
    }
    return (base + quadOffset) / 4.0;
  }
  
  // ============================================
  // Effect functions
  // ============================================
  
  vec3 applyGrain(vec3 color, vec2 uv) {
    if (u_grainAmount <= 0.0) return color;
    
    vec2 grainUV = uv * u_resolution / u_grainSize;
    float seed = u_grainAnimated ? u_time : 0.0;
    float noise = random(grainUV + seed) - 0.5;
    
    return color + noise * u_grainAmount;
  }
  
  vec3 applyDither(vec3 color, vec2 pixelPos) {
    if (u_ditherMode == 0) return color;
    
    float threshold = 0.0;
    if (u_ditherMode == 1) {
      threshold = bayer2(pixelPos);
    } else if (u_ditherMode == 2) {
      threshold = bayer4(pixelPos);
    } else if (u_ditherMode == 3) {
      threshold = bayer8(pixelPos);
    }
    
    // Apply threshold and quantize
    float levels = u_ditherColors - 1.0;
    vec3 quantized = floor(color * levels + threshold * u_ditherIntensity) / levels;
    
    return mix(color, quantized, u_ditherIntensity);
  }
  
  vec3 applyHalftone(vec3 color, vec2 uv) {
    if (u_halftoneAmount <= 0.0) return color;
    
    float angle = u_halftoneAngle * 3.14159 / 180.0;
    vec2 pixelPos = uv * u_resolution;
    
    // Rotate coordinates
    float s = sin(angle);
    float c = cos(angle);
    vec2 rotated = vec2(
      pixelPos.x * c - pixelPos.y * s,
      pixelPos.x * s + pixelPos.y * c
    );
    
    vec2 cellPos = mod(rotated, u_halftoneSize);
    vec2 cellCenter = vec2(u_halftoneSize * 0.5);
    float dist = length(cellPos - cellCenter);
    
    if (u_halftoneCMYK) {
      // CMYK halftone - different angles for each channel
      vec3 cmy = 1.0 - color;
      vec3 result = vec3(0.0);
      
      float angles[3];
      angles[0] = 15.0 * 3.14159 / 180.0;  // Cyan
      angles[1] = 75.0 * 3.14159 / 180.0;  // Magenta
      angles[2] = 0.0;                      // Yellow
      
      for (int i = 0; i < 3; i++) {
        float a = angles[i] + angle;
        vec2 rot = vec2(
          pixelPos.x * cos(a) - pixelPos.y * sin(a),
          pixelPos.x * sin(a) + pixelPos.y * cos(a)
        );
        vec2 cell = mod(rot, u_halftoneSize);
        float d = length(cell - cellCenter);
        float radius = u_halftoneSize * 0.5 * (i == 0 ? cmy.r : (i == 1 ? cmy.g : cmy.b));
        float dot = 1.0 - smoothstep(radius - 1.0, radius + 1.0, d);
        if (i == 0) result.r = dot;
        else if (i == 1) result.g = dot;
        else result.b = dot;
      }
      
      vec3 halftoneColor = 1.0 - result;
      return mix(color, halftoneColor, u_halftoneAmount);
    } else {
      // Single channel halftone
      float lum = luminance(color);
      float radius = u_halftoneSize * 0.5 * (1.0 - lum);
      float dot = 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
      vec3 halftoneColor = vec3(dot);
      return mix(color, halftoneColor, u_halftoneAmount);
    }
  }
  
  vec2 applyPixelation(vec2 uv) {
    if (u_pixelSize <= 1.0) return uv;
    
    vec2 pixelPos = uv * u_resolution;
    vec2 cellPos = floor(pixelPos / u_pixelSize) * u_pixelSize + u_pixelSize * 0.5;
    
    return cellPos / u_resolution;
  }
  
  float getPixelMask(vec2 uv) {
    if (u_pixelSize <= 1.0 || u_pixelShape == 0) return 1.0;
    
    vec2 pixelPos = uv * u_resolution;
    vec2 cellPos = mod(pixelPos, u_pixelSize);
    vec2 center = vec2(u_pixelSize * 0.5);
    float radius = u_pixelSize * 0.45;
    
    if (u_pixelShape == 1) {
      // Circle
      float dist = length(cellPos - center);
      return smoothstep(radius + 1.0, radius - 1.0, dist);
    } else if (u_pixelShape == 2) {
      // Diamond
      float dist = abs(cellPos.x - center.x) + abs(cellPos.y - center.y);
      return smoothstep(radius + 1.0, radius - 1.0, dist);
    }
    
    return 1.0;
  }
  
  vec3 applyPosterize(vec3 color) {
    if (u_posterize >= 32.0) return color;
    float levels = u_posterize - 1.0;
    return floor(color * levels + 0.5) / levels;
  }
  
  vec3 applyColorAdjustments(vec3 color) {
    // Saturation
    if (u_saturation != 1.0) {
      vec3 hsv = rgb2hsv(color);
      hsv.y *= u_saturation;
      color = hsv2rgb(hsv);
    }
    
    // Contrast
    if (u_contrast != 1.0) {
      color = (color - 0.5) * u_contrast + 0.5;
    }
    
    return color;
  }
  
  // ============================================
  // Main
  // ============================================
  
  void main() {
    // Pixelation (affects UV sampling)
    vec2 uv = applyPixelation(v_uv);
    
    // Sample the image
    vec3 color = texture2D(u_image, uv).rgb;
    
    // Apply effects in order
    color = applyColorAdjustments(color);
    color = applyPosterize(color);
    color = applyHalftone(color, v_uv);
    color = applyDither(color, v_uv * u_resolution);
    color = applyGrain(color, v_uv);
    
    // Apply pixel shape mask
    float mask = getPixelMask(v_uv);
    color = mix(vec3(0.0), color, mask);
    
    // Clamp
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
