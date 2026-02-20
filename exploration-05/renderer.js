// WebGL renderer for Northern Lights effect

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform float u_time;
  uniform vec2 u_resolution;
  
  // Aurora parameters
  uniform vec3 u_primaryColor;
  uniform vec3 u_secondaryColor;
  uniform vec3 u_skyColor;
  uniform float u_intensity;
  uniform float u_curtainCount;
  uniform float u_waveSpeed;
  uniform float u_verticalStretch;
  
  // Star parameters
  uniform float u_starDensity;
  uniform float u_starBrightness;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // Fractional Brownian Motion
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  // Hash function for stars
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // Star field
  float stars(vec2 uv, float density) {
    vec2 gv = fract(uv * 100.0) - 0.5;
    vec2 id = floor(uv * 100.0);
    
    float star = 0.0;
    float rnd = hash(id);
    
    if (rnd < density * 0.3) {
      float size = 0.03 + rnd * 0.05;
      float brightness = hash(id + 100.0);
      // Twinkle effect
      float twinkle = sin(u_time * (1.0 + rnd * 3.0) + rnd * 6.28) * 0.3 + 0.7;
      star = smoothstep(size, 0.0, length(gv)) * brightness * twinkle;
    }
    
    return star;
  }
  
  // Aurora curtain - returns vec2(brightness, rayIntensity) for color mixing
  vec2 auroraCurtain(vec2 uv, float offset, float time) {
    // Horizontal wave displacement - gentler waves
    float wave1 = sin(uv.x * 2.5 + time * 0.4 + offset) * 0.08;
    float wave2 = sin(uv.x * 5.0 - time * 0.25 + offset * 2.0) * 0.04;
    float wave3 = snoise(vec2(uv.x * 1.5 + time * 0.15, offset)) * 0.06;
    
    float displacement = wave1 + wave2 + wave3;
    
    // Vertical position with displacement
    float y = uv.y + displacement;
    
    // Create the curtain shape - SHORTER height, positioned higher
    float curtainBase = 0.45 + offset * 0.08;
    float curtainHeight = 0.25 * u_verticalStretch; // Much shorter
    
    // Vertical falloff - tighter band
    float verticalFade = smoothstep(curtainBase - 0.05, curtainBase + curtainHeight * 0.3, y);
    verticalFade *= smoothstep(curtainBase + curtainHeight, curtainBase, y);
    
    // BRIGHTNESS VARIATION along the horizontal axis
    // This creates bright spots and dim spots along the wave
    float brightnessNoise = snoise(vec2(uv.x * 1.2 + offset * 0.7, time * 0.1)) * 0.5 + 0.5;
    float brightnessNoise2 = snoise(vec2(uv.x * 3.0 - offset, time * 0.15 + 10.0)) * 0.5 + 0.5;
    float horizontalBrightness = brightnessNoise * 0.6 + brightnessNoise2 * 0.4;
    horizontalBrightness = smoothstep(0.2, 0.8, horizontalBrightness); // Increase contrast
    horizontalBrightness = 0.15 + horizontalBrightness * 0.85; // Range from 0.15 to 1.0
    
    // Apply brightness variation to the curtain
    float curtain = verticalFade * horizontalBrightness;
    
    // RAYS - cluster in bright areas, sparse in dim areas
    float rays = 0.0;
    float rayDensity = horizontalBrightness * horizontalBrightness; // Squared for more contrast
    
    for (float i = 0.0; i < 8.0; i++) {
      float rayX = uv.x + offset * 0.5 + i * 0.15;
      float rayNoise = snoise(vec2(rayX * 8.0, time * 0.2 + i));
      
      // Ray appears only in bright areas - use threshold based on brightness
      float rayThreshold = 0.3 + (1.0 - rayDensity) * 0.5;
      float rayPresence = smoothstep(rayThreshold, rayThreshold + 0.3, 
                                      snoise(vec2(rayX * 4.0 + offset, i * 2.0 + time * 0.05)) * 0.5 + 0.5 + rayDensity * 0.3);
      
      // Ray width varies - thicker in bright areas
      float rayWidth = 0.015 + rayDensity * 0.025 + rayNoise * 0.01;
      float ray = smoothstep(rayWidth, 0.0, abs(fract(rayX * 4.0 + rayNoise * 0.15) - 0.5));
      
      // Vertical extent - taller rays in bright areas
      float rayHeight = curtainHeight * (0.4 + rayDensity * 0.5);
      ray *= smoothstep(curtainBase - 0.02, curtainBase + rayHeight, y);
      ray *= smoothstep(curtainBase + rayHeight + 0.1, curtainBase, y);
      
      // Apply presence mask
      ray *= rayPresence;
      
      rays += ray * 0.25 * horizontalBrightness;
    }
    
    // Add subtle noise variation
    float noiseVar = fbm(vec2(uv.x * 4.0 + offset, y * 2.0 + time * 0.08), 2);
    curtain *= 0.8 + noiseVar * 0.3;
    
    return vec2(curtain, rays);
  }
  
  void main() {
    vec2 uv = v_uv;
    float aspect = u_resolution.x / u_resolution.y;
    
    // Adjust for aspect ratio
    vec2 adjustedUv = vec2(uv.x * aspect, uv.y);
    
    float time = u_time * u_waveSpeed;
    
    // Sky gradient - darker at top
    vec3 sky = u_skyColor * (0.6 + uv.y * 0.4);
    
    // Add subtle noise to sky
    float skyNoise = fbm(adjustedUv * 3.0 + time * 0.02, 2) * 0.05;
    sky += skyNoise;
    
    // Stars layer
    float starField = stars(adjustedUv, u_starDensity);
    // Fade stars where aurora is bright (will be done after aurora calculation)
    
    // Aurora layers
    vec3 aurora = vec3(0.0);
    float totalAurora = 0.0;
    
    int curtains = int(u_curtainCount);
    for (int i = 0; i < 8; i++) {
      if (i >= curtains) break;
      
      float offset = float(i) * 1.8 + float(i) * 0.4;
      vec2 curtainData = auroraCurtain(adjustedUv, offset, time + float(i) * 0.6);
      float curtain = curtainData.x;
      float rays = curtainData.y;
      
      // Mix colors based on layer and position
      float colorMix = sin(float(i) * 0.8 + uv.x * 2.0 + time * 0.15) * 0.5 + 0.5;
      vec3 curtainColor = mix(u_primaryColor, u_secondaryColor, colorMix * 0.35);
      
      // Rays are brighter/more saturated
      vec3 rayColor = u_primaryColor * 1.3;
      
      // Combine curtain glow and rays
      float layerFade = 1.0 - float(i) * 0.12;
      aurora += curtainColor * curtain * layerFade;
      aurora += rayColor * rays * layerFade;
      totalAurora += (curtain + rays) * layerFade;
    }
    
    aurora *= u_intensity;
    totalAurora *= u_intensity;
    
    // Fade stars behind aurora
    starField *= (1.0 - smoothstep(0.0, 0.5, totalAurora));
    
    // Add glow around aurora
    float glow = totalAurora * 0.3;
    vec3 glowColor = mix(u_primaryColor, u_secondaryColor, 0.3) * glow;
    
    // Combine layers
    vec3 color = sky;
    color += vec3(starField * u_starBrightness);
    color += aurora;
    color += glowColor * 0.5;
    
    // Tone mapping and color correction
    color = pow(color, vec3(0.95)); // Slight gamma
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

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

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Convert OKLCH to linear RGB (simplified conversion)
function oklchToRgb(l, c, h) {
  // Convert to OKLab first
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  
  // OKLab to linear sRGB (approximate)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  
  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  
  // Clamp
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  bl = Math.max(0, Math.min(1, bl));
  
  return [r, g, bl];
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { 
    antialias: true,
    alpha: false 
  });
  
  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }
  
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vertexShader, fragmentShader);
  
  // Create fullscreen quad
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1,
  ]);
  
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  
  // Get uniform locations
  const uniforms = {
    time: gl.getUniformLocation(program, 'u_time'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    primaryColor: gl.getUniformLocation(program, 'u_primaryColor'),
    secondaryColor: gl.getUniformLocation(program, 'u_secondaryColor'),
    skyColor: gl.getUniformLocation(program, 'u_skyColor'),
    intensity: gl.getUniformLocation(program, 'u_intensity'),
    curtainCount: gl.getUniformLocation(program, 'u_curtainCount'),
    waveSpeed: gl.getUniformLocation(program, 'u_waveSpeed'),
    verticalStretch: gl.getUniformLocation(program, 'u_verticalStretch'),
    starDensity: gl.getUniformLocation(program, 'u_starDensity'),
    starBrightness: gl.getUniformLocation(program, 'u_starBrightness'),
  };
  
  return {
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth * dpr;
      const height = canvas.clientHeight * dpr;
      
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    },
    
    render(state, time) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(program);
      
      // Set up vertex attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      
      // Set uniforms
      gl.uniform1f(uniforms.time, time);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      
      // Colors
      const primary = oklchToRgb(state.primaryColorL, state.primaryColorC, state.primaryColorH);
      const secondary = oklchToRgb(state.secondaryColorL, state.secondaryColorC, state.secondaryColorH);
      const sky = oklchToRgb(state.skyColorL, state.skyColorC, state.skyColorH);
      
      gl.uniform3fv(uniforms.primaryColor, primary);
      gl.uniform3fv(uniforms.secondaryColor, secondary);
      gl.uniform3fv(uniforms.skyColor, sky);
      
      // Aurora params
      gl.uniform1f(uniforms.intensity, state.intensity);
      gl.uniform1f(uniforms.curtainCount, state.curtainCount);
      gl.uniform1f(uniforms.waveSpeed, state.waveSpeed);
      gl.uniform1f(uniforms.verticalStretch, state.verticalStretch);
      
      // Star params
      gl.uniform1f(uniforms.starDensity, state.starDensity);
      gl.uniform1f(uniforms.starBrightness, state.starBrightness);
      
      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}
