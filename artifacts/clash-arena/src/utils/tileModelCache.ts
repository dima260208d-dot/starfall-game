import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TileType } from "../game/TileMap";

const TILE_PX = 256;

// Scale multiplier — larger value = model fills more of the TILE_PX canvas.
// 2.3 keeps the whole model visible while filling the cell snugly.
const MODEL_SCALE_FILL = 2.3;

export const PYRAMID_TILE = 12; // new tile type for pyramid blocks

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

// Which tile types are "tall" and should overflow above their cell when rendered.
// Stored as a Set for O(1) lookup inside the render loop.
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

function makeFallback(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE_PX;
  c.height = TILE_PX;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, TILE_PX - 4, TILE_PX - 4);
  return c;
}

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getOrCreateRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(TILE_PX, TILE_PX);
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = false;
    sharedRenderer = r;
    return r;
  } catch {
    return null;
  }
}

function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xffffff, 1.6);
  scene.add(ambient);
  const dir1 = new THREE.DirectionalLight(0xfff5e0, 1.1);
  dir1.position.set(4, 10, 4);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xd0e8ff, 0.5);
  dir2.position.set(-4, 6, -2);
  scene.add(dir2);
  return scene;
}

// 45° isometric-style camera. Frustum half-size chosen so a unit cube fills
// almost the full TILE_PX canvas once model-scale is applied.
function buildCamera(): THREE.OrthographicCamera {
  const half = 3.8;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
  cam.position.set(0, 7, 7);
  cam.lookAt(0, 0, 0);
  return cam;
}

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

export function getTileCanvas(type: number): HTMLCanvasElement | null {
  return cache.get(type) ?? null;
}

export function loadAllTileModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // Try to create the renderer first — if WebGL is unavailable, fall back
    // instantly to solid-colour placeholders without fetching any GLBs.
    const renderer = getOrCreateRenderer();
    if (!renderer) {
      for (const [typeStr, color] of Object.entries(TILE_FALLBACK_COLOR) as [string, string][]) {
        cache.set(Number(typeStr), makeFallback(color));
      }
      return;
    }

    const baseUrl: string = (import.meta as any).env?.BASE_URL ?? "/";
    const base = baseUrl.replace(/\/$/, "");

    const entries = Object.entries(TILE_MODEL) as [string, string][];

    // Load and render each model one at a time so we don't create too many
    // simultaneous fetches, and so each render pass starts from a clean state.
    for (const [typeStr, filename] of entries) {
      const type = Number(typeStr);
      const fallback = TILE_FALLBACK_COLOR[type] ?? "#888888";
      const url = `${base}/models/${filename}`;
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise<any>((res, rej) =>
          loader.load(url, res, undefined, rej)
        );
        const model = gltf.scene.clone(true);
        fixMaterials(model);

        // Water asset is stored vertically — rotate it flat.
        if (type === TileType.WATER) {
          model.rotation.x = -Math.PI / 2;
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z, size.y) || 1;
        const half = 3.8;
        const scale = (half * MODEL_SCALE_FILL) / maxDim;

        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        model.scale.setScalar(scale);

        const scene = buildScene();
        scene.add(model);
        const camera = buildCamera();

        renderer.setClearColor(0x000000, 0);
        renderer.render(scene, camera);

        const out = document.createElement("canvas");
        out.width = TILE_PX;
        out.height = TILE_PX;
        const ctx2d = out.getContext("2d")!;
        ctx2d.drawImage(renderer.domElement, 0, 0);
        cache.set(type, out);
      } catch {
        cache.set(type, makeFallback(fallback));
      }
    }
  })();
  return loadPromise;
}
