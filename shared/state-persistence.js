/**
 * State persistence utility for explorations.
 * Auto-saves state to localStorage, keyed per exploration.
 * 
 * Usage:
 *   import { createPersistence } from '../../shared/state-persistence.js';
 *   const persistence = createPersistence('exploration-01');
 *   const savedState = persistence.load();
 *   // merge with defaults: Object.assign(state, savedState);
 *   // on change: persistence.save(state);
 */

export function createPersistence(explorationId) {
  const key = `${explorationId}-state`;

  return {
    load() {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        console.warn(`Failed to load state for ${explorationId}:`, e);
        return null;
      }
    },

    save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        console.warn(`Failed to save state for ${explorationId}:`, e);
      }
    },

    clear() {
      localStorage.removeItem(key);
    }
  };
}
