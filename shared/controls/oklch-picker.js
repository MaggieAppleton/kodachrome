/**
 * <oklch-picker> - Visual OKLCH color picker
 * 
 * Features three independent sliders for lightness, chroma, and hue.
 * 
 * Usage:
 * <oklch-picker 
 *   key="bg" 
 *   label="Background"
 *   lightness="0.15"
 *   chroma="0.02"
 *   hue="280">
 * </oklch-picker>
 * 
 * Events:
 * - 'control-change': { detail: { key, value: { l, c, h } } }
 */

class OklchPicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isDraggingLightness = false;
    this._isDraggingChroma = false;
    this._isDraggingHue = false;
  }

  static get observedAttributes() {
    return ['lightness', 'chroma', 'hue'];
  }

  get key() { return this.getAttribute('key'); }
  
  get l() { return parseFloat(this.getAttribute('lightness')) || 0.5; }
  get c() { return parseFloat(this.getAttribute('chroma')) || 0.1; }
  get h() { return parseFloat(this.getAttribute('hue')) || 0; }

  set l(v) { this.setAttribute('lightness', v); }
  set c(v) { this.setAttribute('chroma', v); }
  set h(v) { this.setAttribute('hue', v); }

  connectedCallback() {
    const label = this.getAttribute('label') || this.key;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .picker {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .label {
          font-size: 11px;
          color: rgba(232, 228, 222, 0.7);
        }

        .swatch {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .sliders {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .slider-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .slider-label {
          font-size: 9px;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          color: rgba(232, 228, 222, 0.4);
          width: 8px;
          flex-shrink: 0;
        }

        .slider-container {
          position: relative;
          flex: 1;
          height: 20px;
        }

        .slider-track {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          cursor: ew-resize;
        }

        .slider-handle {
          position: absolute;
          top: 50%;
          width: 8px;
          height: 24px;
          background: white;
          border-radius: 4px;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3);
          pointer-events: none;
        }

        .slider-value {
          font-size: 9px;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          color: rgba(232, 228, 222, 0.4);
          width: 32px;
          text-align: right;
          flex-shrink: 0;
        }
      </style>
      
      <div class="picker">
        <div class="header">
          <span class="label">${label}</span>
          <div class="swatch"></div>
        </div>
        <div class="sliders">
          <div class="slider-row">
            <span class="slider-label">L</span>
            <div class="slider-container lightness-container">
              <canvas class="slider-track lightness-track" width="400" height="40"></canvas>
              <div class="slider-handle lightness-handle"></div>
            </div>
            <span class="slider-value val-l">${this.l.toFixed(2)}</span>
          </div>
          <div class="slider-row">
            <span class="slider-label">C</span>
            <div class="slider-container chroma-container">
              <canvas class="slider-track chroma-track" width="400" height="40"></canvas>
              <div class="slider-handle chroma-handle"></div>
            </div>
            <span class="slider-value val-c">${this.c.toFixed(2)}</span>
          </div>
          <div class="slider-row">
            <span class="slider-label">H</span>
            <div class="slider-container hue-container">
              <canvas class="slider-track hue-track" width="400" height="40"></canvas>
              <div class="slider-handle hue-handle"></div>
            </div>
            <span class="slider-value val-h">${Math.round(this.h)}</span>
          </div>
        </div>
      </div>
    `;

    this._lightnessTrack = this.shadowRoot.querySelector('.lightness-track');
    this._lightnessCtx = this._lightnessTrack.getContext('2d');
    this._lightnessHandle = this.shadowRoot.querySelector('.lightness-handle');
    this._lightnessContainer = this.shadowRoot.querySelector('.lightness-container');

    this._chromaTrack = this.shadowRoot.querySelector('.chroma-track');
    this._chromaCtx = this._chromaTrack.getContext('2d');
    this._chromaHandle = this.shadowRoot.querySelector('.chroma-handle');
    this._chromaContainer = this.shadowRoot.querySelector('.chroma-container');

    this._hueTrack = this.shadowRoot.querySelector('.hue-track');
    this._hueCtx = this._hueTrack.getContext('2d');
    this._hueHandle = this.shadowRoot.querySelector('.hue-handle');
    this._hueContainer = this.shadowRoot.querySelector('.hue-container');

    this._swatch = this.shadowRoot.querySelector('.swatch');
    this._valL = this.shadowRoot.querySelector('.val-l');
    this._valC = this.shadowRoot.querySelector('.val-c');
    this._valH = this.shadowRoot.querySelector('.val-h');

    this._drawAllTracks();
    this._updateHandles();
    this._updateSwatch();

    // Lightness interactions  
    this._lightnessContainer.addEventListener('mousedown', this._onLightnessStart.bind(this));
    this._lightnessContainer.addEventListener('touchstart', this._onLightnessStart.bind(this), { passive: false });

    // Chroma interactions  
    this._chromaContainer.addEventListener('mousedown', this._onChromaStart.bind(this));
    this._chromaContainer.addEventListener('touchstart', this._onChromaStart.bind(this), { passive: false });

    // Hue interactions  
    this._hueContainer.addEventListener('mousedown', this._onHueStart.bind(this));
    this._hueContainer.addEventListener('touchstart', this._onHueStart.bind(this), { passive: false });

    // Global move/end
    this._onMove = this._onMove.bind(this);
    this._onEnd = this._onEnd.bind(this);
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mouseup', this._onEnd);
    document.addEventListener('touchmove', this._onMove, { passive: false });
    document.addEventListener('touchend', this._onEnd);
  }

  disconnectedCallback() {
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('mouseup', this._onEnd);
    document.removeEventListener('touchmove', this._onMove);
    document.removeEventListener('touchend', this._onEnd);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this._lightnessTrack) {
      this._drawAllTracks();
      this._updateHandles();
      this._updateSwatch();
    }
  }

  _drawAllTracks() {
    this._drawLightnessTrack();
    this._drawChromaTrack();
    this._drawHueTrack();
  }

  _drawLightnessTrack() {
    const ctx = this._lightnessCtx;
    const width = 400;
    const height = 40;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw gradient from dark (left) to light (right)
    for (let x = 0; x < width; x++) {
      const l = x / width;
      const color = this._oklchToRgb(l, this.c, this.h);
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(x, 0, 1, height);
    }
  }

  _drawChromaTrack() {
    const ctx = this._chromaCtx;
    const width = 400;
    const height = 40;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw gradient from no chroma (left) to max chroma (right)
    const maxChroma = 0.37;
    for (let x = 0; x < width; x++) {
      const c = (x / width) * maxChroma;
      const color = this._oklchToRgb(this.l, c, this.h);
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(x, 0, 1, height);
    }
  }

  _drawHueTrack() {
    const ctx = this._hueCtx;
    const width = 400;
    const height = 40;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw gradient across full hue spectrum (0-360)
    for (let x = 0; x < width; x++) {
      const h = (x / width) * 360;
      const color = this._oklchToRgb(this.l, this.c, h);
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(x, 0, 1, height);
    }
  }

  _updateHandles() {
    // Update lightness handle position
    const trackWidth = this._lightnessContainer.getBoundingClientRect().width;
    const lightnessX = this.l * trackWidth;
    this._lightnessHandle.style.left = `${lightnessX}px`;

    // Update chroma handle position
    const maxChroma = 0.37;
    const chromaX = (this.c / maxChroma) * trackWidth;
    this._chromaHandle.style.left = `${chromaX}px`;

    // Update hue handle position
    const hueX = (this.h / 360) * trackWidth;
    this._hueHandle.style.left = `${hueX}px`;

    // Update value displays
    this._valL.textContent = `${this.l.toFixed(2)}`;
    this._valC.textContent = `${this.c.toFixed(2)}`;
    this._valH.textContent = `${Math.round(this.h)}`;
  }

  _updateSwatch() {
    this._swatch.style.background = `oklch(${this.l} ${this.c} ${this.h})`;
  }

  _onLightnessStart(e) {
    e.preventDefault();
    this._isDraggingLightness = true;
    this._updateFromLightnessEvent(e);
  }

  _onChromaStart(e) {
    e.preventDefault();
    this._isDraggingChroma = true;
    this._updateFromChromaEvent(e);
  }

  _onHueStart(e) {
    e.preventDefault();
    this._isDraggingHue = true;
    this._updateFromHueEvent(e);
  }

  _onMove(e) {
    if (this._isDraggingLightness) {
      this._updateFromLightnessEvent(e);
    }
    if (this._isDraggingChroma) {
      this._updateFromChromaEvent(e);
    }
    if (this._isDraggingHue) {
      this._updateFromHueEvent(e);
    }
  }

  _onEnd() {
    this._isDraggingLightness = false;
    this._isDraggingChroma = false;
    this._isDraggingHue = false;
  }

  _updateFromLightnessEvent(e) {
    const rect = this._lightnessContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    
    // Left = 0 (dark), right = 1 (light)
    const lightness = x / rect.width;
    
    this.l = Math.max(0, Math.min(1, lightness));
    
    this._drawChromaTrack();
    this._drawHueTrack();
    this._updateHandles();
    this._updateSwatch();
    this._emitChange();
  }

  _updateFromChromaEvent(e) {
    const rect = this._chromaContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    
    // Left = 0 (no chroma), right = 0.37 (max chroma)
    const maxChroma = 0.37;
    const chroma = (x / rect.width) * maxChroma;
    
    this.c = Math.max(0, Math.min(maxChroma, chroma));
    
    this._drawLightnessTrack();
    this._drawHueTrack();
    this._updateHandles();
    this._updateSwatch();
    this._emitChange();
  }

  _updateFromHueEvent(e) {
    const rect = this._hueContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    
    // Left = 0°, right = 360°
    const hue = (x / rect.width) * 360;
    
    this.h = Math.max(0, Math.min(360, hue));
    
    this._drawLightnessTrack();
    this._drawChromaTrack();
    this._updateHandles();
    this._updateSwatch();
    this._emitChange();
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent('control-change', {
      bubbles: true,
      composed: true,
      detail: {
        key: this.key,
        value: { l: this.l, c: this.c, h: this.h }
      }
    }));
  }

  // OKLCH to RGB conversion (approximate, works for display)
  _oklchToRgb(l, c, h) {
    // Convert OKLCH to OKLab
    const hRad = h * (Math.PI / 180);
    const a = c * Math.cos(hRad);
    const b = c * Math.sin(hRad);
    
    // OKLab to linear sRGB
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
    
    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;
    
    let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
    
    // Linear to sRGB
    const toSrgb = (x) => {
      if (x <= 0.0031308) return x * 12.92;
      return 1.055 * Math.pow(x, 1/2.4) - 0.055;
    };
    
    r = Math.round(Math.max(0, Math.min(1, toSrgb(r))) * 255);
    g = Math.round(Math.max(0, Math.min(1, toSrgb(g))) * 255);
    bl = Math.round(Math.max(0, Math.min(1, toSrgb(bl))) * 255);
    
    return { r, g, b: bl };
  }
}

customElements.define('oklch-picker', OklchPicker);

export { OklchPicker };
