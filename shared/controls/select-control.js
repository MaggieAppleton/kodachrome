/**
 * <select-control> - Dropdown select with label
 * 
 * Usage:
 * <select-control 
 *   key="grainStyle" 
 *   label="Style" 
 *   value="film"
 *   options="film:Film grain,ordered:Ordered dither,halftone:Halftone">
 * </select-control>
 * 
 * Options format: "value1:Label 1,value2:Label 2,value3:Label 3"
 * 
 * Events:
 * - 'control-change': { detail: { key, value } }
 */

class SelectControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['value'];
  }

  get key() { return this.getAttribute('key'); }
  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }

  _parseOptions() {
    const optionsStr = this.getAttribute('options') || '';
    return optionsStr.split(',').map(opt => {
      const [value, label] = opt.split(':');
      return { value: value.trim(), label: (label || value).trim() };
    }).filter(opt => opt.value);
  }

  connectedCallback() {
    const label = this.getAttribute('label') || this.key;
    const value = this.getAttribute('value') || '';
    const options = this._parseOptions();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .control {
          display: grid;
          grid-template-columns: 1fr 90px;
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

        .select {
          appearance: none;
          -webkit-appearance: none;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(232, 228, 222, 0.9);
          font-size: 10px;
          font-family: inherit;
          padding: 4px 22px 4px 8px;
          cursor: pointer;
          outline: none;
          width: 100%;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 6px center;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }

        .select:hover {
          background-color: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .select:focus {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .select option {
          background: #1a1a1a;
          color: #e8e4de;
        }
      </style>
      
      <div class="control">
        <span class="label">${label}</span>
        <select class="select">
          ${options.map(opt => `
            <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>
              ${opt.label}
            </option>
          `).join('')}
        </select>
      </div>
    `;

    this._select = this.shadowRoot.querySelector('.select');
    this._select.addEventListener('change', this._onChange.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'value' && this._select && oldValue !== newValue) {
      this._select.value = newValue;
    }
  }

  _onChange(e) {
    const value = e.target.value;
    
    this.dispatchEvent(new CustomEvent('control-change', {
      bubbles: true,
      composed: true,
      detail: { key: this.key, value }
    }));
  }
}

customElements.define('select-control', SelectControl);

export { SelectControl };
