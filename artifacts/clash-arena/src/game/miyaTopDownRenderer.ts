import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export type CharAnim = "idle" | "run" | "attack";
/** @deprecated use CharAnim */
export type MiyaAnim = CharAnim;

const SIZE = 256;
const MODEL_TARGET_H = 2.2;

/** Try clip names in order, fall back to the first available clip. */
function findClip(clips: THREE.AnimationClip[], ...names: string[]): THREE.AnimationClip | null {
  for (const name of names) {
    const c = THREE.AnimationClip.findByName(clips, name);
    if (c) return c;
  }
  return clips[0] ?? null;
}

const IDLE_NAMES   = ["Thoughtful_Walk", "Idle", "idle", "Walk", "walk", "Standing"];
const RUN_NAMES    = ["Running", "Run", "run", "Sprint", "Jog", "jog"];
const ATTACK_NAMES = ["Attack", "attack", "Slash", "slash", "Strike", "strike", "Punch"];

class CharacterTopDownRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;

  private modelTemplate: THREE.Group | null = null;
  private clips: THREE.AnimationClip[] = [];

  private instances = new Map<string, {
    model: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Partial<Record<CharAnim, THREE.AnimationAction>>;
    currentAnim: CharAnim;
    lastTs: number;
  }>();

  private loading: Promise<void> | null = null;
  private ready = false;

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

    const idleClip   = findClip(this.clips, ...IDLE_NAMES);
    const runClip    = findClip(this.clips, ...RUN_NAMES);
    const attackClip = findClip(this.clips, ...ATTACK_NAMES);

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

    if (inst.currentAnim !== anim) {
      const prev = inst.actions[inst.currentAnim];
      const next = inst.actions[anim];
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

// ── Registry ─────────────────────────────────────────────────────────────────

/** Character IDs that have a 3D GLB model for in-battle rendering. */
export const CHAR_3D_IDS = new Set(["miya", "ronin", "yuki", "kenji", "hana", "goro", "sora"]);

const rendererRegistry = new Map<string, CharacterTopDownRenderer>();

export function initCharRenderers(base: string): void {
  const models: Record<string, string> = {
    miya:  "models/miya.glb",
    ronin: "models/ronin.glb",
    yuki:  "models/yuki.glb",
    kenji: "models/kenji.glb",
    hana:  "models/hana.glb",
    goro:  "models/goro.glb",
    sora:  "models/sora.glb",
  };
  for (const [id, path] of Object.entries(models)) {
    const r = new CharacterTopDownRenderer();
    r.init(`${base}${path}`).catch(() => { /* fall back to 2D sprite */ });
    rendererRegistry.set(id, r);
  }
}

export function getCharRenderer(id: string): CharacterTopDownRenderer | null {
  return rendererRegistry.get(id) ?? null;
}

/** @deprecated kept for any lingering references — use getCharRenderer("miya") */
export const miyaTopDown = {
  init: (url: string) => rendererRegistry.get("miya")?.init(url) ?? Promise.resolve(),
  isReady: () => rendererRegistry.get("miya")?.isReady() ?? false,
  render: (id: string, anim: CharAnim, angle: number) =>
    rendererRegistry.get("miya")?.render(id, anim, angle) ?? null,
};
