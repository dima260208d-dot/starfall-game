import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Off-screen renderer for the Miya 3D model used in battle.
 *
 * The world is viewed from a true top-down camera. Each frame the game calls
 * `render(state)` with the brawler's current angle and animation choice; the
 * function returns an HTMLCanvasElement that the 2D game canvas blits onto
 * the main scene via `ctx.drawImage` in place of the static PNG sprite.
 *
 * One shared WebGL context is reused for every Miya in the match. Per-frame,
 * the renderer is reconfigured for the requested instance (yaw + animation
 * clip), the scene re-rendered, and then drawn into the main canvas. Since
 * `drawImage` snapshots immediately, multiple instances per frame work fine
 * without race conditions.
 */
export type MiyaAnim = "idle" | "run" | "attack";

const ANIM_TO_CLIP: Record<MiyaAnim, string> = {
  idle: "Thoughtful_Walk",
  run: "Running",
  attack: "Attack",
};

const SIZE = 256;            // offscreen render size in CSS px
const MODEL_TARGET_H = 2.2;  // normalize all models to this world height

class MiyaTopDownRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;

  private modelTemplate: THREE.Group | null = null;
  private clips: THREE.AnimationClip[] = [];

  // Per-instance state keyed by stable id (e.g. brawler.id). Each instance
  // tracks its own last-render timestamp so its mixer always advances by
  // wall-clock delta even when several instances render in the same frame.
  private instances = new Map<string, {
    model: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Partial<Record<MiyaAnim, THREE.AnimationAction>>;
    currentAnim: MiyaAnim;
    lastTs: number;
  }>();

  private loading: Promise<void> | null = null;
  private ready = false;

  /** Lazily load the GLB and set up the WebGL context on first call. */
  init(modelUrl: string): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise((resolve, reject) => {
      // Render to a CSS-sized canvas; the WebGL framebuffer matches.
      this.canvas = document.createElement("canvas");
      this.canvas.width = SIZE;
      this.canvas.height = SIZE;

      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas, antialias: true, alpha: true,
          preserveDrawingBuffer: true,
        });
      } catch (err) {
        // WebGL unavailable in this environment — leave `ready` false so the
        // caller falls back to the 2D sprite path.
        console.warn("[miyaTopDown] WebGL unavailable, falling back to 2D", err);
        return reject(err);
      }
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(SIZE, SIZE, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x000000, 0);

      this.scene = new THREE.Scene();

      // True top-down ortho camera. The model stands along +Y; we look down
      // the -Y axis. World units roughly match the model's height.
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

          // Normalize the template's scale & footprint so per-instance clones
          // start centered and at a known size.
          const box = new THREE.Box3().setFromObject(this.modelTemplate);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const c = new THREE.Vector3();
          box.getCenter(c);
          const scale = sz.y > 0.001 ? MODEL_TARGET_H / sz.y : 1;
          this.modelTemplate.scale.setScalar(scale);
          // Re-measure after scaling so we can set y so feet sit at y=0.
          const box2 = new THREE.Box3().setFromObject(this.modelTemplate);
          this.modelTemplate.position.set(-c.x * scale, -box2.min.y, -c.z * scale);

          this.ready = true;
          resolve();
        },
        undefined,
        (err) => {
          console.warn("[miyaTopDown] failed to load", err);
          reject(err);
        },
      );
    });

    return this.loading;
  }

  /** Returns true if the model is loaded and ready to render. */
  isReady(): boolean {
    return this.ready;
  }

  private getOrCreateInstance(instanceId: string) {
    let inst = this.instances.get(instanceId);
    if (inst) return inst;
    if (!this.modelTemplate) return null;

    // SkeletonUtils.clone() is required for skinned meshes — a plain
    // Object3D.clone() shares the skeleton across clones, which causes all
    // instances to animate identically (or visually overlap). Meshy exports
    // are skinned, so use SkeletonUtils for proper per-instance isolation.
    const model = cloneSkinned(this.modelTemplate) as THREE.Object3D;
    const mixer = new THREE.AnimationMixer(model);
    const actions: Partial<Record<MiyaAnim, THREE.AnimationAction>> = {};
    for (const anim of ["idle", "run", "attack"] as const) {
      const clip = THREE.AnimationClip.findByName(this.clips, ANIM_TO_CLIP[anim]);
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

  /** Drop an instance's resources when its brawler dies / leaves. */
  releaseInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  /**
   * Render the requested instance with the requested animation+yaw and
   * return the offscreen canvas. The caller should immediately drawImage it
   * onto the main canvas before another `render` call overwrites it.
   *
   * `angleRad` is the brawler's facing angle in 2D world coordinates (+X →
   * facing right). It is mapped onto a Y-axis rotation in 3D space.
   */
  render(instanceId: string, anim: MiyaAnim, angleRad: number): HTMLCanvasElement | null {
    if (!this.ready || !this.renderer || !this.scene || !this.camera) return null;
    const inst = this.getOrCreateInstance(instanceId);
    if (!inst) return null;

    // Switch animations with a short cross-fade.
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

    // Advance this instance's mixer by the wall-clock delta since IT was
    // last rendered. Using a per-instance timestamp means several Miyas
    // rendered back-to-back in one game tick each get a real ~16ms delta
    // rather than the second/third instance getting near-zero.
    const now = performance.now();
    const dt = inst.lastTs ? Math.min(0.05, (now - inst.lastTs) / 1000) : 1 / 60;
    inst.lastTs = now;
    inst.mixer.update(dt);

    // Place the instance at origin and rotate to match the requested facing.
    // 2D angle 0 = +X (right). In top-down 3D with camera looking down -Y
    // and `up = -Z`, +X in world is +X on screen and +Z is down on screen,
    // so we rotate around Y by `-angleRad - PI/2` so the model "faces" the
    // requested direction (model's default forward is +Z).
    inst.model.position.set(0, 0, 0);
    inst.model.rotation.set(0, -angleRad - Math.PI / 2, 0);

    // Swap the model into the scene (other instance models are not in the
    // scene; that way Three only renders the one we want).
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

// Singleton instance. Multiple brawlers share one renderer and one WebGL
// context; per-instance state (mixer, clones) is keyed by brawler id.
export const miyaTopDown = new MiyaTopDownRenderer();
