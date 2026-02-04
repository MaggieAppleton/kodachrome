/**
 * WebGL renderer for grainy gradients
 */

import { vertexShader, fragmentShader } from './shaders.js';

// OKLCH to linear RGB conversion
// Based on CSS Color Level 4 spec
function oklchToLinearRgb(l, c, h) {
  // OKLCH to OKLab
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  
  // OKLab to linear sRGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  
  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bOut = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  
  // Clamp to [0, 1]
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

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { 
    antialias: false,
    preserveDrawingBuffer: false 
  });
  
  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }
  
  // Compile shaders
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  
  if (!vs || !fs) return null;
  
  const program = createProgram(gl, vs, fs);
  if (!program) return null;
  
  // Set up fullscreen quad geometry
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]), gl.STATIC_DRAW);
  
  // Get attribute and uniform locations
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  
  const uniforms = {
    time: gl.getUniformLocation(program, 'u_time'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    color1: gl.getUniformLocation(program, 'u_color1'),
    color2: gl.getUniformLocation(program, 'u_color2'),
    color3: gl.getUniformLocation(program, 'u_color3'),
    speed: gl.getUniformLocation(program, 'u_speed'),
    blobSize: gl.getUniformLocation(program, 'u_blobSize'),
    softness: gl.getUniformLocation(program, 'u_softness'),
    complexity: gl.getUniformLocation(program, 'u_complexity'),
    grainStyle: gl.getUniformLocation(program, 'u_grainStyle'),
    grainIntensity: gl.getUniformLocation(program, 'u_grainIntensity'),
    halftoneSize: gl.getUniformLocation(program, 'u_halftoneSize'),
  };
  
  const grainStyleMap = {
    'film': 0,
    'ordered': 1,
    'halftone': 2
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
    
    // Bind geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniform1f(uniforms.time, time);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    
    // Convert OKLCH colors to linear RGB
    const rgb1 = oklchToLinearRgb(state.color1L, state.color1C, state.color1H);
    const rgb2 = oklchToLinearRgb(state.color2L, state.color2C, state.color2H);
    const rgb3 = oklchToLinearRgb(state.color3L, state.color3C, state.color3H);
    
    gl.uniform3fv(uniforms.color1, rgb1);
    gl.uniform3fv(uniforms.color2, rgb2);
    gl.uniform3fv(uniforms.color3, rgb3);
    
    gl.uniform1f(uniforms.speed, state.speed);
    gl.uniform1f(uniforms.blobSize, state.blobSize);
    gl.uniform1f(uniforms.softness, state.softness);
    gl.uniform1f(uniforms.complexity, state.complexity);
    gl.uniform1i(uniforms.grainStyle, grainStyleMap[state.grainStyle] || 0);
    gl.uniform1f(uniforms.grainIntensity, state.grainIntensity);
    gl.uniform1f(uniforms.halftoneSize, state.halftoneSize);
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  
  return { resize, render };
}
