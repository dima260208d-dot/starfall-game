/**
 * SpinningModel3D — uses a single shared WebGL renderer (singleton) to avoid
 * exceeding the browser's WebGL context limit (~16 contexts).
 *
 * Architecture:
 *  - One THREE.WebGLRenderer renders to an OffscreenCanvas
 *  - Each mounted icon registers itself; the shared loop renders each icon's
 *    scene into the renderer, then copies the result to the icon's 2D canvas
 *    via drawImage(renderer.domElement)
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BASE_URL = (import.meta as any).env?.BASE_URL ?? "/";
function assetUrl(path: string) {
  const b = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";
  return b + path.replace(/^\//, "");
}

// ─── Shared renderer singleton ──────────────────────────────────────────────

const RENDER_SIZE = 128; // internal render resolution

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedRafId = 0;

type IconEntry = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group | null;
  canvas2d: HTMLCanvasElement;
  size: number;
};

const icons: Set<IconEntry> = new Set();
const gltfCache = new Map<string, THREE.Group>();

function getRenderer() {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    sharedRenderer.setPixelRatio(1);
    sharedRenderer.setSize(RENDER_SIZE, RENDER_SIZE);
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.shadowMap.enabled = false;
  }
  return sharedRenderer;
}

function startLoop() {
  if (sharedRafId) return;
  const loop = () => {
    sharedRafId = requestAnimationFrame(loop);
    const renderer = getRenderer();
    for (const entry of icons) {
      if (entry.group) entry.group.rotation.y += 0.025;
      renderer.setSize(RENDER_SIZE, RENDER_SIZE);
      renderer.render(entry.scene, entry.camera);
      const ctx = entry.canvas2d.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, entry.size, entry.size);
        ctx.drawImage(renderer.domElement, 0, 0, entry.size, entry.size);
      }
    }
  };
  loop();
}

function stopLoop() {
  if (icons.size === 0 && sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  modelPath: string;
  size?: number;
  color?: string;
  ambientMult?: number;
  dirMult?: number;
  style?: React.CSSProperties;
}

export default function SpinningModel3D({
  modelPath,
  size = 48,
  color,
  ambientMult = 1,
  dirMult = 1,
  style,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entryRef = useRef<IconEntry | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 0.6, 3);
    camera.lookAt(0, 0.2, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8 * ambientMult));
    const dir = new THREE.DirectionalLight(0xffffff, 3.0 * dirMult);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffffff, 1.2 * dirMult);
    fill.position.set(-2, 1, 2);
    scene.add(fill);
    const back = new THREE.DirectionalLight(color ? new THREE.Color(color) : 0x8888ff, 0.8 * dirMult);
    back.position.set(-2, -1, -3);
    scene.add(back);

    const entry: IconEntry = { scene, camera, group: null, canvas2d: canvas, size };
    entryRef.current = entry;
    icons.add(entry);
    startLoop();

    const url = assetUrl(modelPath);
    if (gltfCache.has(url)) {
      const g = gltfCache.get(url)!.clone();
      entry.group = g;
      scene.add(g);
    } else {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const c = new THREE.Vector3();
        box.getCenter(c);
        const sz = new THREE.Vector3();
        box.getSize(sz);
        const maxDim = Math.max(sz.x, sz.y, sz.z);
        const scale = maxDim > 0.001 ? 1.2 / maxDim : 1;
        model.scale.setScalar(scale);
        model.position.set(-c.x * scale, -c.y * scale, -c.z * scale);
        const group = new THREE.Group();
        group.add(model);
        gltfCache.set(url, group);
        // clone for this instance so each can rotate independently
        const g2 = group.clone();
        entry.group = g2;
        scene.add(g2);
      });
    }

    return () => {
      icons.delete(entry);
      stopLoop();
    };
  }, [modelPath, size, ambientMult, dirMult, color]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    />
  );
}
