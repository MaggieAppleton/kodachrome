/**
 * <control-panel> - Container for control sections
 * 
 * Usage:
 * <control-panel title="Experiment Name">
 *   <panel-section title="Density">
 *     <slider-control ...></slider-control>
 *   </panel-section>
 * </control-panel>
 */

class ControlPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isCollapsed = false;
  }

  connectedCallback() {
    const title = this.getAttribute('title') || '';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --panel-bg: rgba(14, 12, 16, 0.88);
          --panel-border: rgba(255, 255, 255, 0.08);
          --text-primary: #e8e4de;
          --text-secondary: rgba(232, 228, 222, 0.5);
          --accent: #a8a8a8;
          
          display: block;
          position: fixed;
          top: 16px;
          right: 16px;
          width: 220px;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          font-size: 11px;
          color: var(--text-primary);
          z-index: 1000;
        }

        .panel {
          background: var(--panel-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          overflow: hidden;
        }

        .header {
          padding: 10px 12px 8px;
          border-bottom: 1px solid var(--panel-border);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
          transition: background 0.15s ease;
        }

        .header:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .header:active {
          background: rgba(255, 255, 255, 0.05);
        }

        .title {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
          margin: 0;
        }

        .chevron {
          width: 12px;
          height: 12px;
          transition: transform 0.2s ease;
          opacity: 0.5;
        }

        .chevron.collapsed {
          transform: rotate(-90deg);
        }

        .content {
          padding: 4px 0;
          max-height: 2000px;
          overflow: hidden;
          transition: max-height 0.3s ease, opacity 0.2s ease, padding 0.3s ease;
        }

        .content.collapsed {
          max-height: 0;
          opacity: 0;
          padding: 0;
        }

        ::slotted(panel-section) {
          display: block;
        }
      </style>
      
      <div class="panel">
        ${title ? `
          <div class="header" id="header">
            <h1 class="title">${title}</h1>
            <svg class="chevron" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        ` : ''}
        <div class="content" id="content">
          <slot></slot>
        </div>
      </div>
    `;

    // Add click handler for collapse/expand
    const header = this.shadowRoot.getElementById('header');
    if (header) {
      header.addEventListener('click', () => this.toggleCollapse());
    }
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    const content = this.shadowRoot.getElementById('content');
    const chevron = this.shadowRoot.querySelector('.chevron');
    
    if (this.isCollapsed) {
      content.classList.add('collapsed');
      chevron.classList.add('collapsed');
    } else {
      content.classList.remove('collapsed');
      chevron.classList.remove('collapsed');
    }
  }
}

/**
 * <panel-section> - Groups controls under a title
 */
class PanelSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const title = this.getAttribute('title') || '';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        :host(:last-child) {
          border-bottom: none;
        }

        .section-title {
          font-size: 9px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(232, 228, 222, 0.4);
          margin: 0 0 8px 0;
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
      </style>
      
      ${title ? `<div class="section-title">${title}</div>` : ''}
      <div class="controls">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define('control-panel', ControlPanel);
customElements.define('panel-section', PanelSection);

export { ControlPanel, PanelSection };
