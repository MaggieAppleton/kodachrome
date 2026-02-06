# Kodachrome

A playground for developing visual experiments. Contains isolated experiments exploring canvas gradients, grain, dithering, textures, and motion.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the dev server with hot reloading:

```bash
npm run dev
```

Then open [http://localhost:5173/explorations/](http://localhost:5173/explorations/)

Changes to HTML, CSS, or JS files will reload automatically.

### Generating Thumbnails

To automatically generate thumbnails for all explorations:

```bash
npm run thumbnails
```

This script:
1. Starts a Vite dev server
2. Opens each exploration in a headless browser
3. Hides the control panel and UI elements
4. Captures a screenshot of the canvas rendering
5. Saves it as `thumb.png` in each exploration folder
6. Stops the dev server

The thumbnails are 800×600px at 2× resolution for retina displays. The script automatically finds all `exploration-*` folders and will work for new explorations you add.

## Project Structure

```
shared/
  controls/           # Reusable Web Components for control panels
    control-panel.js  # <control-panel> container
    slider-control.js # <slider-control> for numeric values
    oklch-picker.js   # <oklch-picker> visual color picker
    index.js          # Import this to register all components

explorations/
  index.html          # Grid of all explorations
  exploration-01/     # Constellation Machine
  exploration-02/     # Dithered Image
```

## Using the Control Components

In any exploration, import the shared controls:

```html
<script type="module" src="../../shared/controls/index.js"></script>
```

Then use them in your HTML:

```html
<control-panel title="My Experiment">
  <panel-section title="Settings">
    <slider-control key="size" label="Size" min="1" max="100" value="50"></slider-control>
    <oklch-picker key="color" label="Color" lightness="0.5" chroma="0.15" hue="200"></oklch-picker>
  </panel-section>
</control-panel>
```

Listen for changes in your JS:

```js
document.addEventListener('control-change', (e) => {
  const { key, value } = e.detail;
  // value is a number for sliders, { l, c, h } for color pickers
});
```
