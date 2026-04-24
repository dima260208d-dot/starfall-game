/**
 * Preloads every GLB model used by the game so they are already cached when
 * the first gameplay screen opens.  Call this during the boot loading screen
 * and pass an onProgress callback to drive the real progress bar.
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGLTFCached, MODEL_URLS } from "../components/BrawlerRevealModal";
import { loadChestCached, CHEST_MODELS } from "../components/Chest3DViewer";
import { loadAllTileModels } from "./tileModelCache";
import { loadPlatformTile } from "./platformTile";

// ── Resource model cache (coin / gem / powerpoint) ────────────────────────────
const resourceCache = new Map<string, Promise<void>>();

function loadResourceCached(url: string): Promise<void> {
  const hit = resourceCache.get(url);
  if (hit) return hit;
  const p = new Promise<void>((resolve) => {
    new GLTFLoader().load(url, () => resolve(), undefined, () => resolve());
  });
  resourceCache.set(url, p);
  return p;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function preloadAllModels(
  base: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const b = base.endsWith("/") ? base : `${base}/`;

  const brawlerTasks = Object.values(MODEL_URLS).map((m) =>
    loadGLTFCached(`${b}${m.url}`),
  );
  const chestTasks = Object.values(CHEST_MODELS).map((path) =>
    loadChestCached(`${b}${path}`),
  );
  const resourceTasks = (["models/coin.glb", "models/gem.glb", "models/powerpoint.glb"] as const).map(
    (p) => loadResourceCached(`${b}${p}`),
  );
  // Tile GLBs + platform tile — must be ready before Showdown starts
  const tileTasks: Promise<unknown>[] = [loadAllTileModels(), loadPlatformTile()];

  const allTasks: Promise<unknown>[] = [...brawlerTasks, ...chestTasks, ...resourceTasks, ...tileTasks];
  const total = allTasks.length;
  let done = 0;

  onProgress(0.04); // immediate 4 % so the bar doesn't look stuck at 0

  await Promise.all(
    allTasks.map((task) =>
      Promise.resolve(task)
        .then(() => { done++; onProgress(0.04 + (done / total) * 0.92); })
        .catch(() => { done++; onProgress(0.04 + (done / total) * 0.92); }),
    ),
  );

  onProgress(1.0);
}
