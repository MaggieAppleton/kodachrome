/**
 * <slider-control> - Minimal slider with label and value
 * 
 * Usage:
 * <slider-control 
 *   key="ringCount" 
 *   label="Rings" 
 *   min="3" 
 *   max="24" 
 *   step="1"
 *   value="12">
 * </slider-control>
 * 
 * Events:
 * - 'control-change': { detail: { key, value } }
 */

class SliderControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['value'];
  }

  get key() { return this.getAttribute('key'); }
  get value() { return parseFloat(this.getAttribute('value')) || 0; }
  set value(v) { this.setAttribute('value', v); }

  connectedCallback() {
    const label = this.getAttribute('label') || this.key;
    const min = this.getAttribute('min') || '0';
    const max = this.getAttribute('max') || '100';
    const step = this.getAttribute('step') || '1';
    const value = this.getAttribute('value') || min;
    
    // Determine decimal places from step
    const decimals = (step.split('.')[1] || '').length;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .control {
          display: grid;
          grid-template-columns: 1fr 80px 36px;
          align-items: center;
          gap: 8px;
        }

        .label {
          font-size: 11px;
          color: rgba(232, 228, 222, 0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          background: #e8e4de;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.1s ease;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          background: #e8e4de;
          border: none;
          border-radius: 50%;
          cursor: pointer;
        }

        .value {
          font-size: 10px;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
          color: rgba(232, 228, 222, 0.5);
          text-align: right;
        }
      </style>
      
      <div class="control">
        <span class="label">${label}</span>
        <input 
          type="range" 
          class="slider"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${value}"
        />
        <span class="value">${parseFloat(value).toFixed(decimals)}</span>
      </div>
    `;

    this._slider = this.shadowRoot.querySelector('.slider');
    this._valueDisplay = this.shadowRoot.querySelector('.value');
    this._decimals = decimals;

    this._slider.addEventListener('input', this._onInput.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'value' && this._slider && oldValue !== newValue) {
      this._slider.value = newValue;
      this._valueDisplay.textContent = parseFloat(newValue).toFixed(this._decimals);
    }
  }

  _onInput(e) {
    const value = parseFloat(e.target.value);
    this._valueDisplay.textContent = value.toFixed(this._decimals);
    
    this.dispatchEvent(new CustomEvent('control-change', {
      bubbles: true,
      composed: true,
      detail: { key: this.key, value }
    }));
  }
}

customElements.define('slider-control', SliderControl);

export { SliderControl };
