/**
 * Run this in your browser console to export all exploration states.
 * Copy the output and save to thumbnail-states.json in the repo root.
 * 
 * Or paste this into the browser console:
 * 
 * (() => {
 *   const states = {};
 *   for (let i = 0; i < localStorage.length; i++) {
 *     const key = localStorage.key(i);
 *     if (key.endsWith('-state')) {
 *       states[key] = JSON.parse(localStorage.getItem(key));
 *     }
 *   }
 *   console.log(JSON.stringify(states, null, 2));
 * })();
 */

export function exportAllStates() {
  const states = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.endsWith('-state')) {
      states[key] = JSON.parse(localStorage.getItem(key));
    }
  }
  return states;
}

// For browser console use
if (typeof window !== 'undefined') {
  window.exportExplorationStates = () => {
    const states = exportAllStates();
    console.log(JSON.stringify(states, null, 2));
    return states;
  };
}
