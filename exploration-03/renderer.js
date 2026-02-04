/**
 * WebGL renderer for image treatments
 */

import { vertexShader, fragmentShader } from './shaders.js';

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
  const gl = canvas.getContext('webgl', { 
    antialias: false,
    preserveDrawingBuffer: true 
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
  
  // Fullscreen quad with texture coordinates
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  0, 1,
     1, -1,  1, 1,
    -1,  1,  0, 0,
    -1,  1,  0, 0,
     1, -1,  1, 1,
     1,  1,  1, 0
  ]), gl.STATIC_DRAW);
  
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
  
  const uniforms = {
    image: gl.getUniformLocation(program, 'u_image'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    // Grain
    grainAmount: gl.getUniformLocation(program, 'u_grainAmount'),
    grainSize: gl.getUniformLocation(program, 'u_grainSize'),
    grainAnimated: gl.getUniformLocation(program, 'u_grainAnimated'),
    // Dither
    ditherMode: gl.getUniformLocation(program, 'u_ditherMode'),
    ditherIntensity: gl.getUniformLocation(program, 'u_ditherIntensity'),
    ditherColors: gl.getUniformLocation(program, 'u_ditherColors'),
    // Halftone
    halftoneAmount: gl.getUniformLocation(program, 'u_halftoneAmount'),
    halftoneSize: gl.getUniformLocation(program, 'u_halftoneSize'),
    halftoneAngle: gl.getUniformLocation(program, 'u_halftoneAngle'),
    halftoneCMYK: gl.getUniformLocation(program, 'u_halftoneCMYK'),
    // Pixelation
    pixelSize: gl.getUniformLocation(program, 'u_pixelSize'),
    pixelShape: gl.getUniformLocation(program, 'u_pixelShape'),
    // Color
    brightness: gl.getUniformLocation(program, 'u_brightness'),
    posterize: gl.getUniformLocation(program, 'u_posterize'),
    saturation: gl.getUniformLocation(program, 'u_saturation'),
    contrast: gl.getUniformLocation(program, 'u_contrast'),
  };
  
  // Texture for the image
  let texture = null;
  let imageWidth = 0;
  let imageHeight = 0;
  
  const ditherModeMap = { 'none': 0, 'bayer2': 1, 'bayer4': 2, 'bayer8': 3 };
  const pixelShapeMap = { 'square': 0, 'circle': 1, 'diamond': 2 };
  
  function loadImage(img) {
    if (texture) {
      gl.deleteTexture(texture);
    }
    
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    
    // Use LINEAR for smoother results, NEAREST for pixelated
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    imageWidth = img.naturalWidth || img.width;
    imageHeight = img.naturalHeight || img.height;
    
    resize();
  }
  
  function resize() {
    if (!imageWidth || !imageHeight) return;
    
    const dpr = window.devicePixelRatio || 1;
    const maxWidth = window.innerWidth * 0.85;
    const maxHeight = window.innerHeight * 0.9;
    
    // Calculate display size maintaining aspect ratio
    const imageAspect = imageWidth / imageHeight;
    const screenAspect = maxWidth / maxHeight;
    
    let displayWidth, displayHeight;
    if (imageAspect > screenAspect) {
      displayWidth = maxWidth;
      displayHeight = maxWidth / imageAspect;
    } else {
      displayHeight = maxHeight;
      displayWidth = maxHeight * imageAspect;
    }
    
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  
  function render(state, time) {
    if (!texture) return;
    
    gl.useProgram(program);
    
    // Bind geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    
    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.image, 0);
    
    // Set uniforms
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, time);
    
    // Grain
    gl.uniform1f(uniforms.grainAmount, state.grainAmount || 0);
    gl.uniform1f(uniforms.grainSize, state.grainSize || 1);
    gl.uniform1i(uniforms.grainAnimated, state.grainAnimated ? 1 : 0);
    
    // Dither
    gl.uniform1i(uniforms.ditherMode, ditherModeMap[state.ditherMode] || 0);
    gl.uniform1f(uniforms.ditherIntensity, state.ditherIntensity || 0.5);
    gl.uniform1f(uniforms.ditherColors, state.ditherColors || 4);
    
    // Halftone
    gl.uniform1f(uniforms.halftoneAmount, state.halftoneAmount || 0);
    gl.uniform1f(uniforms.halftoneSize, state.halftoneSize || 6);
    gl.uniform1f(uniforms.halftoneAngle, state.halftoneAngle || 45);
    gl.uniform1i(uniforms.halftoneCMYK, state.halftoneCMYK ? 1 : 0);
    
    // Pixelation
    gl.uniform1f(uniforms.pixelSize, state.pixelSize || 1);
    gl.uniform1i(uniforms.pixelShape, pixelShapeMap[state.pixelShape] || 0);
    
    // Color
    gl.uniform1f(uniforms.brightness, state.brightness || 1);
    gl.uniform1f(uniforms.posterize, state.posterize || 32);
    gl.uniform1f(uniforms.saturation, state.saturation || 1);
    gl.uniform1f(uniforms.contrast, state.contrast || 1);
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  
  function getImageSize() {
    return { width: canvas.width, height: canvas.height };
  }
  
  return { loadImage, resize, render, getImageSize };
}
