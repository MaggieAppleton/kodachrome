/**
 * <checkbox-control> - Minimal checkbox toggle with label
 * 
 * Usage:
 * <checkbox-control 
 *   key="animated" 
 *   label="Animated"
 *   checked="true">
 * </checkbox-control>
 * 
 * Events:
 * - 'control-change': { detail: { key, value: boolean } }
 */

class CheckboxControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['checked'];
  }

  get key() { return this.getAttribute('key'); }
  get checked() { return this.getAttribute('checked') === 'true'; }
  set checked(v) { this.setAttribute('checked', v ? 'true' : 'false'); }

  connectedCallback() {
    const label = this.getAttribute('label') || this.key;
    const checked = this.getAttribute('checked') === 'true';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .control {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .label {
          font-size: 11px;
          color: rgba(232, 228, 222, 0.7);
          white-space: nowrap;
          flex: 1;
        }

        .checkbox {
          width: 14px;
          height: 14px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .checkbox.checked {
          background: rgba(232, 228, 222, 0.9);
          border-color: rgba(232, 228, 222, 0.9);
        }

        .checkbox svg {
          width: 10px;
          height: 10px;
          opacity: 0;
          transition: opacity 0.1s ease;
        }

        .checkbox.checked svg {
          opacity: 1;
        }

        .control:hover .checkbox {
          border-color: rgba(255, 255, 255, 0.4);
        }

        .control:hover .checkbox.checked {
          border-color: rgba(232, 228, 222, 1);
        }
      </style>
      
      <div class="control">
        <span class="label">${label}</span>
        <div class="checkbox ${checked ? 'checked' : ''}">
          <svg viewBox="0 0 10 10" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 5l2.5 2.5L8 3" />
          </svg>
        </div>
      </div>
    `;

    this._checkbox = this.shadowRoot.querySelector('.checkbox');
    this._control = this.shadowRoot.querySelector('.control');

    this._control.addEventListener('click', this._onClick.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'checked' && this._checkbox && oldValue !== newValue) {
      const isChecked = newValue === 'true';
      this._checkbox.classList.toggle('checked', isChecked);
    }
  }

  _onClick() {
    const newValue = !this.checked;
    this.checked = newValue;
    
    this.dispatchEvent(new CustomEvent('control-change', {
      bubbles: true,
      composed: true,
      detail: { key: this.key, value: newValue }
    }));
  }
}

customElements.define('checkbox-control', CheckboxControl);

export { CheckboxControl };
