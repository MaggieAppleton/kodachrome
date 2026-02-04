/**
 * Shared Control Components
 * 
 * Import this file to register all control components:
 * <script type="module" src="../../shared/controls/index.js"></script>
 * 
 * Available components:
 * - <control-panel title="...">
 * - <panel-section title="...">
 * - <slider-control key="..." label="..." min="..." max="..." step="..." value="...">
 * - <oklch-picker key="..." label="..." lightness="..." chroma="..." hue="...">
 * - <snapshot-manager exploration="...">
 * 
 * All components emit 'control-change' events with { key, value } detail.
 * snapshot-manager emits 'snapshot-load' events with { state, name } detail.
 */

import './control-panel.js';
import './slider-control.js';
import './oklch-picker.js';
import './select-control.js';
import './snapshot-manager.js';

export * from './control-panel.js';
export * from './slider-control.js';
export * from './oklch-picker.js';
export * from './select-control.js';
export * from './snapshot-manager.js';
