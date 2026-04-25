import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TileType } from "../game/TileMap";

// ── Canvas dimensions ─────────────────────────────────────────────────────────
// Standard square canvas used for blocks, water, etc.
const TILE_PX = 256;
// Tall canvas used for BUSH/grass — 1:2 aspect lets us show the full 3-D
// model from a low camera angle so it reads clearly as 3-D foliage.
const BUSH_PX_W = 256;
const BUSH_PX_H = 512;

// Scale fill factor for standard tiles.
// 1.7 keeps even asymmetric models fully inside the frustum without clipping.
const MODEL_SCALE_FILL = 1.7;

// Scale fill factor for bushes — larger so foliage is proportional to
// the brawler characters (who stand ~1.5 cells tall).
const BUSH_SCALE_FILL = 2.2;

export const PYRAMID_TILE = 12; // matches TileType.PYRAMID = 12

const TILE_MODEL: Partial<Record<number, string>> = {
  [TileType.WALL]:       "brick_wall.glb",
  [TileType.MOUNTAIN]:   "stone_block.glb",
  [TileType.BUSH]:       "grass_tile.glb",
  [TileType.WATER]:      "water.glb",
  [TileType.DECORATION]: "bones.glb",
  [TileType.FENCE]:      "fence.glb",
  [TileType.HEAL]:       "barrel.glb",
  [TileType.CACTUS]:     "cactus.glb",
  [TileType.WOOD]:       "wood_block.glb",
  [TileType.SAND_WALL]:  "boulder.glb",
  [PYRAMID_TILE]:        "pyramid.glb",
};

const TILE_FALLBACK_COLOR: Partial<Record<number, string>> = {
  [TileType.WALL]:       "#8B6060",
  [TileType.MOUNTAIN]:   "#607060",
  [TileType.BUSH]:       "#4CAF50",
  [TileType.WATER]:      "#1565C0",
  [TileType.DECORATION]: "#E0E0E0",
  [TileType.FENCE]:      "#C8A45A",
  [TileType.HEAL]:       "#C2185B",
  [TileType.CACTUS]:     "#558B2F",
  [TileType.WOOD]:       "#8D6E63",
  [TileType.SAND_WALL]:  "#78909C",
  [PYRAMID_TILE]:        "#FDD835",
};

// Tile types whose pre-rendered canvas is taller than wide (BUSH_PX_W × BUSH_PX_H).
// All other tile types use a square TILE_PX × TILE_PX canvas.
const TALL_CANVAS_TYPES = new Set<number>([TileType.BUSH]);

// Tile types that are rendered tall in-game (overflow upward into adjacent cells).
export const TALL_TILE_TYPES = new Set<number>([
  TileType.WALL,
  TileType.MOUNTAIN,
  TileType.DECORATION,
  TileType.FENCE,
  TileType.WOOD,
  TileType.SAND_WALL,
  TileType.CACTUS,
  PYRAMID_TILE,
]);

const cache = new Map<number, HTMLCanvasElement>();
let loadPromise: Promise<void> | null = null;

function makeFallback(color: string, w = TILE_PX, h = TILE_PX): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  return c;
}

// ── Shared WebGL renderer ─────────────────────────────────────────────────────
let sharedRenderer: THREE.WebGLRenderer | null = null;

function getOrCreateRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(TILE_PX, TILE_PX);   // will be resized per-tile below
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = false;
    sharedRenderer = r;
    return r;
  } catch {
    return null;
  }
}

// ── Scene / lighting ──────────────────────────────────────────────────────────
function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.8));
  const dir1 = new THREE.DirectionalLight(0xfff5e0, 1.2);
  dir1.position.set(4, 10, 4);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xd0e8ff, 0.55);
  dir2.position.set(-4, 6, -2);
  scene.add(dir2);
  return scene;
}

// ── Camera builders ───────────────────────────────────────────────────────────

/**
 * Standard isometric camera at ~45° elevation.
 * Frustum half of 4.2 gives visible margin so models are never clipped.
 */
function buildCamera(): THREE.OrthographicCamera {
  const half = 4.2;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
  cam.position.set(0, 7, 7);
  cam.lookAt(0, 0, 0);
  return cam;
}

/**
 * Frontal camera for BUSH tiles.
 * Lower elevation (~20°) shows more of the bush's vertical structure so it
 * clearly reads as 3-D foliage rather than a flat top-down patch.
 * The frustum matches the 1:2 aspect (BUSH_PX_W × BUSH_PX_H) so there is no
 * distortion and nothing gets clipped vertically.
 */
function buildBushCamera(): THREE.OrthographicCamera {
  const halfW = 3.6;
  const halfH = halfW * (BUSH_PX_H / BUSH_PX_W); // = 7.2  (1:2 aspect)
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 200);
  // Low angle: Y=3, Z=9 → elevation ≈ arctan(3/9) ≈ 18°
  cam.position.set(0, 3, 9);
  // Look slightly above the base so the top of the bush stays fully in frame
  cam.lookAt(0, 1.2, 0);
  return cam;
}

// ── Material fix ──────────────────────────────────────────────────────────────
function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m: THREE.Material) => {
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      m.needsUpdate = true;
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export function getTileCanvas(type: number): HTMLCanvasElement | null {
  return cache.get(type) ?? null;
}

export function loadAllTileModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // If WebGL is unavailable skip all fetching and use solid-colour fallbacks.
    const renderer = getOrCreateRenderer();
    if (!renderer) {
      for (const [typeStr, color] of Object.entries(TILE_FALLBACK_COLOR) as [string, string][]) {
        const type = Number(typeStr);
        const w = TALL_CANVAS_TYPES.has(type) ? BUSH_PX_W : TILE_PX;
        const h = TALL_CANVAS_TYPES.has(type) ? BUSH_PX_H : TILE_PX;
        cache.set(type, makeFallback(color, w, h));
      }
      return;
    }

    const baseUrl: string = (import.meta as any).env?.BASE_URL ?? "/";
    const base = baseUrl.replace(/\/$/, "");
    const entries = Object.entries(TILE_MODEL) as [string, string][];

    // Fetch all GLBs in parallel — network latency overlaps.
    const fetched = await Promise.allSettled(
      entries.map(async ([typeStr, filename]) => {
        const type = Number(typeStr);
        const url = `${base}/models/${filename}`;
        const gltf = await new Promise<any>((res, rej) =>
          new GLTFLoader().load(url, res, undefined, rej)
        );
        return { type, gltf };
      })
    );

    // Render each model sequentially (shared single WebGL context).
    for (let i = 0; i < fetched.length; i++) {
      const result = fetched[i];
      const type = Number(entries[i][0]);
      const isBush = TALL_CANVAS_TYPES.has(type);
      const canvasW = isBush ? BUSH_PX_W : TILE_PX;
      const canvasH = isBush ? BUSH_PX_H : TILE_PX;
      const fallback = TILE_FALLBACK_COLOR[type] ?? "#888888";

      if (result.status === "rejected") {
        cache.set(type, makeFallback(fallback, canvasW, canvasH));
        continue;
      }
      try {
        const { gltf } = result.value;
        const model = gltf.scene.clone(true);
        fixMaterials(model);

        // Water asset is stored vertically — rotate it flat.
        if (type === TileType.WATER) model.rotation.x = -Math.PI / 2;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z, size.y) || 1;

        let scale: number;
        let camera: THREE.OrthographicCamera;

        if (isBush) {
          // Bush: scale to fill the frustum width (height has plenty of room)
          const halfW = 3.6;
          scale = (halfW * BUSH_SCALE_FILL) / Math.max(size.x, size.z);
          camera = buildBushCamera();
        } else {
          const half = 4.2;
          scale = (half * MODEL_SCALE_FILL) / maxDim;
          camera = buildCamera();
        }

        // Centre model horizontally; sit base on ground (y = 0).
        model.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale,
        );
        model.scale.setScalar(scale);

        // Resize renderer to match this tile's canvas dimensions.
        renderer.setSize(canvasW, canvasH);
        renderer.setClearColor(0x000000, 0);

        const scene = buildScene();
        scene.add(model);
        renderer.render(scene, camera);

        const out = document.createElement("canvas");
        out.width = canvasW;
        out.height = canvasH;
        out.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
        cache.set(type, out);
      } catch {
        cache.set(type, makeFallback(fallback, canvasW, canvasH));
      }
    }

    // Restore renderer to default square size after all tiles are done.
    renderer.setSize(TILE_PX, TILE_PX);
  })();
  return loadPromise;
}
