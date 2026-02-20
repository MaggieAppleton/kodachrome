/**
 * GLSL shaders for domain-warped gradient swirls
 * Technique: Inigo Quilez-style domain warping — noise fed into noise coordinates
 * creates organic fold/swirl/crease shapes.
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
  // Simplex noise (Ashima Arts implementation)
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
  // FBM — fractal brownian motion
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
  // Main — Domain Warping
  //
  // Three layers of noise-into-noise:
  //   q = fbm(p)
  //   r = fbm(p + strength * q)
  //   f = fbm(p + strength * r)
  //
  // Each layer feeds into the next, creating
  // organic swirl/fold/crease shapes.
  // ============================================
  
  void main() {
    vec2 uv = v_uv;
    float time = u_time * u_speed;
    
    // Aspect-corrected coordinates
    vec2 p = uv;
    p.x *= u_resolution.x / u_resolution.y;
    p *= u_warpScale;
    
    // --- Domain warping: 3 layers ---
    
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
    
    // Normalize f to 0-1 range
    float t = f * 0.5 + 0.5;
    
    // Create light and dark variations of the base color
    vec3 darkColor = u_baseColor * (1.0 - u_colorRange);
    vec3 lightColor = u_baseColor * (1.0 + u_colorRange * 0.8) + vec3(u_colorRange * 0.3);
    
    // Slight hue shift for light areas
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
    
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
