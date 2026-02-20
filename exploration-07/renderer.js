/**
 * WebGL renderer for domain-warped gradient swirls
 */

import { vertexShader, fragmentShader } from './shaders.js';

// OKLCH to linear RGB conversion
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
  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }
  
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
