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

const SIZE = 256;
const MODEL_TARGET_H = 2.2;

// Exact animation clip names per character (extracted from the GLB files).
interface CharAnimNames { idle: string; run: string; attack: string; }

const CHAR_ANIM_NAMES: Record<string, CharAnimNames> = {
  miya:  { idle: "Thoughtful_Walk",    run: "Running", attack: "Attack" },
  sora:  { idle: "Walking",            run: "Running", attack: "mage_soell_cast_2" },
  goro:  { idle: "Walking",            run: "Running", attack: "Double_Combo_Attack" },
  ronin: { idle: "Walking",            run: "Running", attack: "Step_Step_Turn_Kick" },
  hana:  { idle: "Walking",            run: "Running", attack: "Archery_Shot_3" },
  kenji: { idle: "Walking",            run: "Running", attack: "Axe_Spin_Attack" },
  yuki:  { idle: "Walking",            run: "Running", attack: "Axe_Spin_Attack" },
  rin:   { idle: "Walking",            run: "Running", attack: "Left_Slash" },
  taro:  { idle: "Walking",            run: "Running", attack: "Archery_Shot_1" },
};

function findClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | null {
  return clips.find(c => c.name === name) ?? null;
}

class CharacterTopDownRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;

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
      this.canvas = document.createElement("canvas");
      this.canvas.width = SIZE;
      this.canvas.height = SIZE;

      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas, antialias: true, alpha: true,
          preserveDrawingBuffer: true,
        });
      } catch (err) {
        console.warn("[CharTopDown] WebGL unavailable, falling back to 2D", err);
        return reject(err);
      }

      this.renderer.setPixelRatio(1);
      this.renderer.setSize(SIZE, SIZE, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x000000, 0);

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 20);
      this.camera.position.set(0, 6, 0);
      this.camera.up.set(0, 0, -1);
      this.camera.lookAt(0, 0, 0);

      this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 1.0);
      key.position.set(2, 6, 2);
      this.scene.add(key);

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
          resolve();
        },
        undefined,
        (err) => {
          console.warn("[CharTopDown] failed to load", err);
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

    const idleClip   = findClip(this.clips, this.animNames.idle);
    const runClip    = findClip(this.clips, this.animNames.run);
    const attackClip = findClip(this.clips, this.animNames.attack);

    for (const [anim, clip] of [
      ["idle", idleClip] as const,
      ["run",  runClip]  as const,
      ["attack", attackClip] as const,
    ]) {
      if (clip) {
        const a = mixer.clipAction(clip);
        a.setLoop(anim === "attack" ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        if (anim === "attack") a.clampWhenFinished = true;
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
   * Render the character for one frame and return the offscreen canvas.
   *
   * angleRad: 2D world facing angle (0 = right, π/2 = down, π = left, -π/2 = up).
   * The corrected formula `Math.PI/2 - angleRad` maps this to the 3D Y-rotation
   * so the model faces the correct screen direction.
   */
  render(instanceId: string, anim: CharAnim, angleRad: number): HTMLCanvasElement | null {
    if (!this.ready || !this.renderer || !this.scene || !this.camera) return null;
    const inst = this.getOrCreateInstance(instanceId);
    if (!inst) return null;

    if (anim === "dead") {
      // On the first frame of death: freeze all animations.
      if (inst.currentAnim !== "dead") {
        for (const a of Object.values(inst.actions)) {
          if (a) a.stop();
        }
        inst.currentAnim = "dead";
      }
      // Lay model flat on the ground — rotate 90° around X so it falls forward.
      // The top-down camera sees the model as a prone silhouette on the map.
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

    this.scene.clear();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(2, 6, 2);
    this.scene.add(key);
    this.scene.add(inst.model);

    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }
}

// ── Lazy registry ─────────────────────────────────────────────────────────────
// Renderers are created on-demand the first time a character is rendered
// in-battle. This avoids loading all ~300 MB of GLBs at startup.

/** Character IDs that have a 3D GLB model for in-battle rendering. */
export const CHAR_3D_IDS = new Set(["miya", "ronin", "yuki", "kenji", "hana", "goro", "sora", "rin", "taro"]);

let _base = "/";
const rendererRegistry = new Map<string, CharacterTopDownRenderer>();

/** Call once (on module import) to record the base URL for lazy GLB loading. */
export function setRenderersBase(base: string): void {
  _base = base;
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
