import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/** Force correct material settings on all meshes (mirrors Brawler3DModel). */
function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m: THREE.Material) => {
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.opacity !== undefined && sm.opacity >= 0.98) m.transparent = false;
      m.needsUpdate = true;
    });
  });
}

export type CharAnim = "idle" | "run" | "attack" | "dead";
/** @deprecated use CharAnim */
export type MiyaAnim = CharAnim;

const SIZE = 512;
const MODEL_TARGET_H = 3.2;

// Exact animation clip names per character (extracted from the GLB files).
interface CharAnimNames {
  idle: string; idleIdx?: number;
  run: string;  runIdx?: number;
  attack: string; attackIdx?: number;
}

const CHAR_ANIM_NAMES: Record<string, CharAnimNames> = {
  miya:    { idle: "Walking",         idleIdx: 3, run: "Running", runIdx: 1, attack: "Attack",              attackIdx: 0 },
  sora:    { idle: "Walking",         idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast_2",   attackIdx: 2 },
  // goro/rin: name-only — exact GLB clip names found by THREE.js loader (no idx to avoid ordering ambiguity)
  goro:    { idle: "Running",                     run: "Running",            attack: "Double_Combo_Attack"              },
  rin:     { idle: "Running",                     run: "Running",            attack: "Left_Slash"                       },
  ronin:   { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 0, attack: "Step_Step_Turn_Kick", attackIdx: 1 },
  hana:    { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Archery_Shot_3",      attackIdx: 0 },
  kenji:   { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Axe_Spin_Attack",     attackIdx: 0 },
  yuki:    { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Axe_Spin_Attack",     attackIdx: 0 },
  taro:    { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Archery_Shot_1",      attackIdx: 0 },
  zafkiel: { idle: "Walking",         idleIdx: 2, run: "Archery_Shot_3", runIdx: 0, attack: "Running",           attackIdx: 1 },
};

function findClip(clips: THREE.AnimationClip[], name: string, idx?: number): THREE.AnimationClip | null {
  if (idx !== undefined && clips[idx]) return clips[idx];
  return clips.find(c => c.name === name) ?? null;
}

// ── Shared WebGL renderer ─────────────────────────────────────────────────────
// All CharacterTopDownRenderer instances share ONE WebGL context to avoid
// hitting the browser's ~8–16 simultaneous WebGL context limit.

let _sharedRenderer: THREE.WebGLRenderer | null = null;
let _sharedScene: THREE.Scene | null = null;
let _sharedCamera: THREE.OrthographicCamera | null = null;
let _sharedRendererReady = false;

function getSharedRenderer(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null {
  if (_sharedRendererReady && _sharedRenderer && _sharedScene && _sharedCamera) {
    if (!_sharedRenderer.getContext().isContextLost()) {
      return { renderer: _sharedRenderer, scene: _sharedScene, camera: _sharedCamera };
    }
    // Context was lost — recreate on next call.
    _sharedRendererReady = false;
    _sharedRenderer = null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  try {
    _sharedRenderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    return null;
  }

  canvas.addEventListener("webglcontextlost", () => {
    _sharedRendererReady = false;
    _sharedRenderer = null;
  }, { once: true });

  _sharedRenderer.setPixelRatio(1);
  _sharedRenderer.setSize(SIZE, SIZE, false);
  _sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
  _sharedRenderer.setClearColor(0x000000, 0);

  _sharedScene = new THREE.Scene();
  // 45° isometric elevation — matches the in-game ISO view
  _sharedCamera = new THREE.OrthographicCamera(-1.8, 1.8, 2.0, -1.4, 0.1, 30);
  _sharedCamera.position.set(0, 6, 6);
  _sharedCamera.up.set(0, 1, 0);
  _sharedCamera.lookAt(0, 1.5, 0);

  _sharedRendererReady = true;
  return { renderer: _sharedRenderer, scene: _sharedScene, camera: _sharedCamera };
}

// ── Per-character renderer ────────────────────────────────────────────────────

class CharacterTopDownRenderer {
  // Per-character 2D canvas — holds the last rendered frame.
  // This is what callers receive, so the shared WebGL canvas can be
  // overwritten by the next character without corrupting prior results.
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputCtx: CanvasRenderingContext2D | null = null;

  private modelTemplate: THREE.Group | null = null;
  private clips: THREE.AnimationClip[] = [];
  private animNames: CharAnimNames;

  private instances = new Map<string, {
    model: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Partial<Record<CharAnim, THREE.AnimationAction>>;
    currentAnim: CharAnim;
    lastTs: number;
  }>();

  private loading: Promise<void> | null = null;
  private ready = false;

  constructor(animNames: CharAnimNames) {
    this.animNames = animNames;
  }

  init(modelUrl: string): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise((resolve, reject) => {
      // Make sure the shared WebGL renderer exists before loading.
      if (!getSharedRenderer()) {
        return reject(new Error("[CharTopDown] WebGL unavailable"));
      }

      this.outputCanvas = document.createElement("canvas");
      this.outputCanvas.width = SIZE;
      this.outputCanvas.height = SIZE;
      this.outputCtx = this.outputCanvas.getContext("2d");

      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          this.modelTemplate = gltf.scene;
          this.clips = gltf.animations ?? [];
          fixMaterials(this.modelTemplate);

          const box = new THREE.Box3().setFromObject(this.modelTemplate);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const c = new THREE.Vector3();
          box.getCenter(c);
          const scale = sz.y > 0.001 ? MODEL_TARGET_H / sz.y : 1;
          this.modelTemplate.scale.setScalar(scale);
          const box2 = new THREE.Box3().setFromObject(this.modelTemplate);
          this.modelTemplate.position.set(-c.x * scale, -box2.min.y, -c.z * scale);

          this.ready = true;

          // Warmup: pre-compile shaders for this model on the shared renderer.
          try {
            const shared = getSharedRenderer();
            if (shared) {
              const warmModel = cloneSkinned(this.modelTemplate) as THREE.Object3D;
              shared.scene.add(new THREE.AmbientLight(0xffffff, 2.5));
              shared.scene.add(warmModel);
              shared.renderer.render(shared.scene, shared.camera);
              shared.scene.clear();
            }
          } catch { /* ignore warmup errors */ }

          resolve();
        },
        undefined,
        (err) => {
          console.warn("[CharTopDown] failed to load", modelUrl, err);
          reject(err);
        },
      );
    });

    return this.loading;
  }

  isReady(): boolean { return this.ready; }

  private getOrCreateInstance(instanceId: string) {
    let inst = this.instances.get(instanceId);
    if (inst) return inst;
    if (!this.modelTemplate) return null;

    const model = cloneSkinned(this.modelTemplate) as THREE.Object3D;
    const mixer = new THREE.AnimationMixer(model);
    const actions: Partial<Record<CharAnim, THREE.AnimationAction>> = {};

    const idleClip   = findClip(this.clips, this.animNames.idle,   this.animNames.idleIdx);
    const runClip    = findClip(this.clips, this.animNames.run,    this.animNames.runIdx);
    const attackClip = findClip(this.clips, this.animNames.attack, this.animNames.attackIdx);

    for (const [anim, clip] of [
      ["idle", idleClip] as const,
      ["run",  runClip]  as const,
      ["attack", attackClip] as const,
    ]) {
      if (clip) {
        const a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.clampWhenFinished = false;
        actions[anim] = a;
      }
    }

    inst = { model, mixer, actions, currentAnim: "idle", lastTs: 0 };
    actions.idle?.play();
    this.instances.set(instanceId, inst);
    return inst;
  }

  releaseInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  /**
   * Render the character for one frame and return a per-character 2D canvas.
   *
   * angleRad: 2D world facing angle (0 = right, π/2 = down, π = left, -π/2 = up).
   */
  render(instanceId: string, anim: CharAnim, angleRad: number): HTMLCanvasElement | null {
    if (!this.ready || !this.outputCanvas || !this.outputCtx) return null;

    const shared = getSharedRenderer();
    if (!shared) { this.ready = false; return null; }

    const inst = this.getOrCreateInstance(instanceId);
    if (!inst) return null;

    if (anim === "dead") {
      if (inst.currentAnim !== "dead") {
        for (const a of Object.values(inst.actions)) {
          if (a) a.stop();
        }
        inst.currentAnim = "dead";
      }
      inst.model.position.set(0, 0, 0);
      inst.model.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - angleRad);
    } else {
      if (inst.currentAnim !== anim) {
        const prev = inst.actions[inst.currentAnim as Exclude<CharAnim, "dead">];
        const next = inst.actions[anim as Exclude<CharAnim, "dead">];
        if (next) {
          next.reset();
          next.fadeIn(0.15);
          next.play();
        }
        if (prev && prev !== next) prev.fadeOut(0.15);
        inst.currentAnim = anim;
      }

      const now = performance.now();
      const dt = inst.lastTs ? Math.min(0.05, (now - inst.lastTs) / 1000) : 1 / 60;
      inst.lastTs = now;
      inst.mixer.update(dt);

      inst.model.position.set(0, 0, 0);
      inst.model.rotation.set(0, Math.PI / 2 - angleRad, 0);
    }

    shared.scene.clear();
    shared.scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(2, 6, 2);
    shared.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.5);
    fill.position.set(-2, 4, -2);
    shared.scene.add(fill);
    shared.scene.add(inst.model);

    shared.renderer.render(shared.scene, shared.camera);

    // Copy rendered frame from the shared WebGL canvas to this character's
    // dedicated 2D canvas so subsequent character renders don't overwrite it.
    this.outputCtx.clearRect(0, 0, SIZE, SIZE);
    this.outputCtx.drawImage(shared.renderer.domElement, 0, 0);

    return this.outputCanvas;
  }
}

// ── Lazy registry ─────────────────────────────────────────────────────────────

/** Character IDs that have a 3D GLB model for in-battle rendering. */
export const CHAR_3D_IDS = new Set(["miya", "ronin", "yuki", "kenji", "hana", "goro", "sora", "rin", "taro", "zafkiel"]);

let _base = "/";
const rendererRegistry = new Map<string, CharacterTopDownRenderer>();

/** Call once (on module import) to record the base URL for lazy GLB loading. */
export function setRenderersBase(base: string): void {
  _base = base;
}

/**
 * Eagerly preload every 3D character model and warm up the GPU.
 * Call this as soon as the player decides to enter battle (e.g. during the
 * loading screen) so that GLB downloads and shader compilation finish before
 * the game loop starts — eliminating the 2-D → 3-D pop and mid-game lag.
 */
export function preloadCharRenderers(base: string): Promise<void> {
  setRenderersBase(base);
  const promises = Array.from(CHAR_3D_IDS).map(id => {
    let r = rendererRegistry.get(id);
    if (!r) {
      const names = CHAR_ANIM_NAMES[id] ?? { idle: "Walking", run: "Running", attack: "Attack" };
      r = new CharacterTopDownRenderer(names);
      rendererRegistry.set(id, r);
    }
    return r.init(`${base}models/${id}.glb`).catch(() => {
      // Model failed to load — 2-D sprite fallback will be used in-game.
    });
  });
  return Promise.all(promises).then(() => {});
}

/** @deprecated use setRenderersBase */
export function initCharRenderers(base: string): void {
  setRenderersBase(base);
}

/**
 * Returns the renderer for the given character, creating and starting the load
 * if it hasn't been requested before. Falls back to null if the character has
 * no 3D model.
 */
export function getCharRenderer(id: string): CharacterTopDownRenderer | null {
  if (!CHAR_3D_IDS.has(id)) return null;
  let r = rendererRegistry.get(id);
  if (!r) {
    const names = CHAR_ANIM_NAMES[id] ?? { idle: "Walking", run: "Running", attack: "Attack" };
    r = new CharacterTopDownRenderer(names);
    r.init(`${_base}models/${id}.glb`).catch(() => { /* fall back to 2D sprite */ });
    rendererRegistry.set(id, r);
  }
  return r;
}

/** @deprecated kept for any lingering references — use getCharRenderer("miya") */
export const miyaTopDown = {
  init: (url: string) => rendererRegistry.get("miya")?.init(url) ?? Promise.resolve(),
  isReady: () => rendererRegistry.get("miya")?.isReady() ?? false,
  render: (id: string, anim: CharAnim, angle: number) =>
    rendererRegistry.get("miya")?.render(id, anim, angle) ?? null,
};
