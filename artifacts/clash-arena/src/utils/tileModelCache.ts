import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TileType } from "../game/TileMap";

const TILE_PX = 64;

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
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, TILE_PX - 2, TILE_PX - 2);
  return c;
}

async function renderGLBToCanvas(url: string, fallbackColor: string): Promise<HTMLCanvasElement> {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(TILE_PX, TILE_PX);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const half = 4;
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
    camera.position.set(0, 50, 0);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 0, -1);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xfff8e0, 0.6);
    dir.position.set(3, 10, 3);
    scene.add(dir);

    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((res, rej) => loader.load(url, res, undefined, rej));
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z, size.y) || 1;
    const scale = (half * 2 * 0.92) / maxDim;

    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    model.scale.setScalar(scale);
    scene.add(model);

    renderer.render(scene, camera);

    const out = document.createElement("canvas");
    out.width = TILE_PX;
    out.height = TILE_PX;
    const ctx2d = out.getContext("2d")!;
    ctx2d.drawImage(renderer.domElement, 0, 0);
    renderer.dispose();
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
    const baseUrl: string = (import.meta as any).env?.BASE_URL ?? "/";
    const base = baseUrl.replace(/\/$/, "");
    const jobs: Promise<void>[] = [];
    for (const [typeStr, filename] of Object.entries(TILE_MODEL)) {
      const type = Number(typeStr);
      const url = `${base}/models/${filename}`;
      const fallback = TILE_FALLBACK_COLOR[type] ?? "#888";
      jobs.push(
        renderGLBToCanvas(url, fallback).then(c => { cache.set(type, c); })
      );
    }
    await Promise.allSettled(jobs);
  })();
  return loadPromise;
}
