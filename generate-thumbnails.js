import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_HEIGHT = 600;
const DEV_SERVER_URL = "http://localhost:5173";

// Load state from exploration's snapshots.json (uses first snapshot for thumbnail)
function loadSnapshotState(explorationPath) {
  const snapshotsFile = join(explorationPath, "snapshots.json");
  if (existsSync(snapshotsFile)) {
    try {
      const snapshots = JSON.parse(readFileSync(snapshotsFile, "utf-8"));
      if (snapshots.length > 0) {
        return snapshots[0].state; // Use first snapshot for thumbnail
      }
    } catch (e) {
      console.warn(`   ⚠️  Could not parse snapshots.json:`, e.message);
    }
  }
  return null;
}

async function generateThumbnail(explorationPath, explorationName) {
  console.log(`📸 Generating thumbnail for ${explorationName}...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    deviceScaleFactor: 2, // For retina/high-DPI
  });

  // Load state from exploration's snapshots.json
  const snapshotState = loadSnapshotState(explorationPath);
  const stateKey = `${explorationName}-state`;
  
  if (snapshotState) {
    // Navigate to the base URL first to set localStorage for that origin
    await page.goto(DEV_SERVER_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate((key, state) => {
      localStorage.setItem(key, JSON.stringify(state));
    }, stateKey, snapshotState);
    console.log(`   └─ Using Snapshot 1 from snapshots.json`);
  } else {
    console.log(`   └─ No snapshots.json found, using defaults`);
  }

  // Navigate to the exploration via dev server
  const explorationUrl = `${DEV_SERVER_URL}/${explorationName}/index.html`;
  await page.goto(explorationUrl, { waitUntil: "networkidle0" });

  // Wait for custom elements to be defined (for control panels)
  await page.evaluate(async () => {
    if (customElements.get('control-panel')) {
      await customElements.whenDefined('control-panel');
    }
    if (customElements.get('slider-control')) {
      await customElements.whenDefined('slider-control');
    }
  });

  // Wait for module scripts to execute and initial render
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Trigger resize event to force re-render at correct size
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
  });

  // Wait for re-render after resize
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Hide control panel, back button, and snapshot manager
  await page.evaluate(() => {
    const controlPanel = document.querySelector("control-panel");
    if (controlPanel) {
      controlPanel.style.display = "none";
    }
    const backButton = document.querySelector(".back");
    if (backButton) {
      backButton.style.display = "none";
    }
    const snapshotManager = document.querySelector("snapshot-manager");
    if (snapshotManager) {
      snapshotManager.style.display = "none";
    }
  });

  // Wait a tiny bit more for any re-render
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Take screenshot
  const screenshotPath = join(explorationPath, "thumb.png");
  await page.screenshot({
    path: screenshotPath,
    type: "png",
  });

  console.log(`✅ Saved to ${explorationName}/thumb.png`);

  await browser.close();
}

function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting Vite dev server...\n");
    
    const server = spawn("npm", ["run", "dev"], {
      stdio: "pipe",
      shell: true,
    });

    let resolved = false;

    server.stdout.on("data", (data) => {
      const output = data.toString();
      // Wait for Vite to be ready
      if (output.includes("Local:") && !resolved) {
        resolved = true;
        console.log("✅ Dev server ready\n");
        resolve(server);
      }
    });

    server.stderr.on("data", (data) => {
      // Vite outputs to stderr sometimes, check for ready message there too
      const output = data.toString();
      if (output.includes("Local:") && !resolved) {
        resolved = true;
        console.log("✅ Dev server ready\n");
        resolve(server);
      }
    });

    server.on("error", reject);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!resolved) {
        reject(new Error("Dev server failed to start"));
      }
    }, 10000);
  });
}

async function main() {
  console.log("🎨 Starting thumbnail generation...\n");

  // Start dev server
  const server = await startDevServer();

  try {
    // Find all exploration directories
    const items = readdirSync(__dirname);
    const explorations = items.filter((item) => {
      const fullPath = join(__dirname, item);
      return (
        statSync(fullPath).isDirectory() && item.startsWith("exploration-")
      );
    });

    console.log(`Found ${explorations.length} explorations\n`);

    // Generate thumbnails for each exploration
    for (const exploration of explorations) {
      const explorationPath = join(__dirname, exploration);
      try {
        await generateThumbnail(explorationPath, exploration);
      } catch (error) {
        console.error(`❌ Error generating thumbnail for ${exploration}:`, error.message);
      }
    }

    console.log("\n🎉 All thumbnails generated!");
  } finally {
    // Stop dev server
    console.log("\n🛑 Stopping dev server...");
    server.kill();
  }
}

main();
