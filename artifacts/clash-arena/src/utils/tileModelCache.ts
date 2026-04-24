import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TileType } from "../game/TileMap";

const TILE_PX = 256;

const TILE_MODEL: Partial<Record<number, string>> = {
  [TileType.WALL]:       "stone_wall.glb",
  [TileType.MOUNTAIN]:   "mountain.glb",
  [TileType.BUSH]:       "bush2.glb",
  [TileType.WATER]:      "water.glb",
  [TileType.DECORATION]: "decoration.glb",
  [TileType.FENCE]:      "fence.glb",
  [TileType.HEAL]:       "heal_platform.glb",
  [TileType.TREE]:       "tree.glb",
  [TileType.CACTUS]:     "cactus.glb",
  [TileType.WOOD]:       "wood.glb",
  [TileType.SAND_WALL]:  "sand_wall.glb",
};

const TILE_FALLBACK_COLOR: Partial<Record<number, string>> = {
  [TileType.WALL]:       "#6E6E6E",
  [TileType.MOUNTAIN]:   "#404040",
  [TileType.BUSH]:       "#2D7A2D",
  [TileType.WATER]:      "#1565C0",
  [TileType.DECORATION]: "#8B4513",
  [TileType.FENCE]:      "#C8A45A",
  [TileType.HEAL]:       "#C2185B",
  [TileType.TREE]:       "#1B5E20",
  [TileType.CACTUS]:     "#558B2F",
  [TileType.WOOD]:       "#A0522D",
  [TileType.SAND_WALL]:  "#C2A04A",
};

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
  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambient);
  const dir1 = new THREE.DirectionalLight(0xfff5e0, 0.9);
  dir1.position.set(4, 10, 4);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xd0e8ff, 0.4);
  dir2.position.set(-4, 6, -2);
  scene.add(dir2);
  return scene;
}

// Camera positioned at 45° elevation for an isometric-style top-angled view
function buildCamera(): THREE.OrthographicCamera {
  const half = 3.8;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
  // 45° elevation from the south (negative Z) side
  cam.position.set(0, 7, 7);
  cam.lookAt(0, 0, 0);
  return cam;
}

async function renderModelToCanvas(
  renderer: THREE.WebGLRenderer,
  url: string,
  type: number,
  fallbackColor: string
): Promise<HTMLCanvasElement> {
  try {
    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((res, rej) =>
      loader.load(url, res, undefined, rej)
    );
    const model = gltf.scene.clone(true);

    // Water fix: the model stands on its edge — rotate it flat
    if (type === TileType.WATER) {
      model.rotation.x = -Math.PI / 2;
    }

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z, size.y) || 1;
    const half = 3.8;
    const scale = (half * 1.85) / maxDim;

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
    return out;
  } catch {
    return makeFallback(fallbackColor);
  }
}

export function getTileCanvas(type: number): HTMLCanvasElement | null {
  return cache.get(type) ?? null;
}

export function loadAllTileModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const renderer = getOrCreateRenderer();
    if (!renderer) {
      // WebGL unavailable — fill cache with colour swatches
      for (const [typeStr, color] of Object.entries(TILE_FALLBACK_COLOR) as [string, string][]) {
        cache.set(Number(typeStr), makeFallback(color));
      }
      return;
    }

    const baseUrl: string = (import.meta as any).env?.BASE_URL ?? "/";
    const base = baseUrl.replace(/\/$/, "");

    // Load all models in parallel — each gets the shared renderer in sequence
    // (Three.js renderer is not concurrent, so we queue renders after all
    //  GLTFs are loaded in parallel)
    const entries = Object.entries(TILE_MODEL) as [string, string][];

    // Phase 1: load all GLTFs in parallel
    const results = await Promise.allSettled(
      entries.map(async ([typeStr, filename]) => {
        const type = Number(typeStr);
        const url = `${base}/models/${filename}`;
        const loader = new GLTFLoader();
        const gltf = await new Promise<any>((res, rej) =>
          loader.load(url, res, undefined, rej)
        );
        return { type, gltf };
      })
    );

    // Phase 2: render each model synchronously through the shared renderer
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const type = Number(entries[i][0]);
      const fallback = TILE_FALLBACK_COLOR[type] ?? "#888888";
      if (r.status === "rejected") {
        cache.set(type, makeFallback(fallback));
        continue;
      }
      try {
        const { gltf } = r.value;
        const model = gltf.scene.clone(true);

        if (type === TileType.WATER) {
          model.rotation.x = -Math.PI / 2;
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z, size.y) || 1;
        const half = 3.8;
        const scale = (half * 1.85) / maxDim;

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
