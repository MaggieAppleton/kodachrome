const explorations = [
  {
    id: "exploration-01",
    title: "Constellation",
    desc: "Animated grid and stars",
  },
  {
    id: "exploration-02",
    title: "Grainy Gradients",
    desc: "Canvas gradients with grain and organic motion",
  },
  {
    id: "exploration-03",
    title: "Image Treatments",
    desc: "Grain, dithering, halftone, pixelation, and ASCII effects",
  },
  {
    id: "exploration-04",
    title: "Pixel Loaders",
    desc: "Animated 3×3 pixel grids with glow effects",
  },
  {
    id: "exploration-05",
    title: "Northern Lights",
    desc: "Animated aurora borealis with stars",
  },
  {
    id: "exploration-06",
    title: "Logo Loaders",
    desc: "Animated loading patterns with logo shapes",
  },
  {
    id: "exploration-07",
    title: "Gradient Swirls",
    desc: "Domain-warped gradient swirls with grain and light",
  },
];

const grid = document.getElementById("grid");

if (grid) {
  grid.innerHTML = explorations
    .map(
      (e) => `
      <a class="card" href="./${e.id}/index.html">
        <img src="./${e.id}/thumb.png" alt="${e.title} thumbnail" />
        <div class="meta">
          <h2 class="title">${e.title}</h2>
          <p class="desc">${e.desc}</p>
        </div>
      </a>
    `
    )
    .join("");
}
