/**
 * <snapshot-manager> - Save and load state snapshots
 * 
 * Positioned near the back button. Provides:
 * - "Save Snapshot" button that saves current state to snapshots.json
 * - Dropdown to load previously saved snapshots
 * 
 * Usage:
 * <snapshot-manager exploration="exploration-01"></snapshot-manager>
 * 
 * The component dispatches 'snapshot-load' events when a snapshot is selected.
 * Your script should listen for this and apply the state.
 */

class SnapshotManager extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.snapshots = [];
  }

  connectedCallback() {
    this.exploration = this.getAttribute('exploration') || this.detectExploration();
    this.render();
    this.loadSnapshots();
  }

  detectExploration() {
    // Extract exploration name from URL path
    const path = window.location.pathname;
    const match = path.match(/(exploration-\d+)/);
    return match ? match[1] : 'unknown';
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: 8px;
          position: fixed;
          top: 16px;
          left: 80px;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          font-size: 12px;
          z-index: 1000;
        }

        button, select {
          background: rgba(14, 12, 16, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.7);
          font-family: inherit;
          font-size: 12px;
          line-height: 1;
          padding: 8px 10px;
          cursor: pointer;
          transition: color 0.15s ease, border-color 0.15s ease;
          box-sizing: border-box;
        }

        button:hover, select:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        select {
          padding-right: 24px;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' fill-opacity='0.5' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 6px center;
          min-width: 100px;
        }

        select:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .delete-btn {
          color: rgba(255, 255, 255, 0.5);
        }

        .delete-btn:hover {
          color: #ff6b6b;
          border-color: rgba(255, 107, 107, 0.3);
        }

        .delete-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .feedback {
          color: var(--text-dim);
          font-size: 10px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .feedback.visible {
          opacity: 1;
        }
      </style>

      <button id="save">Save Snapshot</button>
      <select id="snapshots" disabled>
        <option value="">No snapshots</option>
      </select>
      <button id="delete" class="delete-btn" disabled>Delete</button>
      <span id="feedback" class="feedback"></span>
    `;

    this.shadowRoot.getElementById('save').addEventListener('click', () => this.saveSnapshot());
    this.shadowRoot.getElementById('snapshots').addEventListener('change', (e) => this.loadSnapshot(e.target.value));
    this.shadowRoot.getElementById('delete').addEventListener('click', () => this.deleteSnapshot());
  }

  async loadSnapshots() {
    try {
      const response = await fetch(`/${this.exploration}/snapshots.json`);
      if (response.ok) {
        this.snapshots = await response.json();
        this.updateDropdown();
      }
    } catch (e) {
      // No snapshots yet, that's fine
    }
  }

  updateDropdown() {
    const select = this.shadowRoot.getElementById('snapshots');
    const deleteBtn = this.shadowRoot.getElementById('delete');
    
    if (this.snapshots.length === 0) {
      select.innerHTML = '<option value="">No snapshots</option>';
      select.disabled = true;
      deleteBtn.disabled = true;
    } else {
      select.innerHTML = '<option value="">Load snapshot...</option>' +
        this.snapshots.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
      select.disabled = false;
      deleteBtn.disabled = true; // Enable only when a snapshot is selected
    }
  }

  async saveSnapshot() {
    // Get current state from localStorage
    const stateKey = `${this.exploration}-state`;
    const stateStr = localStorage.getItem(stateKey);
    
    if (!stateStr) {
      this.showFeedback('No state to save');
      return;
    }

    const state = JSON.parse(stateStr);

    try {
      const response = await fetch('/__snapshots/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exploration: this.exploration, state })
      });

      const result = await response.json();
      if (result.success) {
        this.showFeedback(`Saved ${result.name}`);
        await this.loadSnapshots();
      } else {
        this.showFeedback('Save failed');
      }
    } catch (e) {
      this.showFeedback('Save failed');
      console.error('Snapshot save error:', e);
    }
  }

  loadSnapshot(indexStr) {
    if (indexStr === '') {
      this.shadowRoot.getElementById('delete').disabled = true;
      return;
    }

    const index = parseInt(indexStr, 10);
    const snapshot = this.snapshots[index];
    if (!snapshot) return;

    // Enable delete button
    this.shadowRoot.getElementById('delete').disabled = false;

    // Save to localStorage so it persists
    const stateKey = `${this.exploration}-state`;
    localStorage.setItem(stateKey, JSON.stringify(snapshot.state));

    // Dispatch event for the exploration script to apply the state
    this.dispatchEvent(new CustomEvent('snapshot-load', {
      bubbles: true,
      detail: { state: snapshot.state, name: snapshot.name }
    }));

    this.showFeedback(`Loaded ${snapshot.name}`);
  }

  async deleteSnapshot() {
    const select = this.shadowRoot.getElementById('snapshots');
    const index = parseInt(select.value, 10);
    
    if (isNaN(index)) return;

    const snapshot = this.snapshots[index];
    if (!confirm(`Delete "${snapshot.name}"?`)) return;

    try {
      const response = await fetch('/__snapshots/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exploration: this.exploration, index })
      });

      const result = await response.json();
      if (result.success) {
        this.showFeedback('Deleted');
        await this.loadSnapshots();
      } else {
        this.showFeedback('Delete failed');
      }
    } catch (e) {
      this.showFeedback('Delete failed');
      console.error('Snapshot delete error:', e);
    }
  }

  showFeedback(message) {
    const feedback = this.shadowRoot.getElementById('feedback');
    feedback.textContent = message;
    feedback.classList.add('visible');
    setTimeout(() => feedback.classList.remove('visible'), 2000);
  }
}

customElements.define('snapshot-manager', SnapshotManager);

export { SnapshotManager };
