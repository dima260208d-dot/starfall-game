import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface Brawler3DModelProps {
  modelUrl: string;
  /** Name of the GLTF animation clip to loop (e.g. "Thoughtful_Walk"). */
  animation: string;
  /** Glow color used for the radial backdrop. */
  color: string;
  size?: number;
  autoRotateInitial?: boolean;
}

/**
 * Standalone 3D model viewer for menu / collection screens. The user looks at
 * the brawler "head-on" (camera in front, pointing at chest height) and can
 * drag horizontally to spin the model 360°. Double-click toggles auto-rotation.
 *
 * One animation clip plays on a loop. Switching the `animation` prop cross-
 * fades into the new clip.
 */
export default function Brawler3DModel({
  modelUrl,
  animation,
  color,
  size = 320,
  autoRotateInitial = false,
}: Brawler3DModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    mixer?: THREE.AnimationMixer;
    clips?: THREE.AnimationClip[];
    currentAction?: THREE.AnimationAction;
    rootGroup?: THREE.Group;
    yaw: number;
    autoRotate: boolean;
    dragging: boolean;
    dragStartX: number;
    dragStartYaw: number;
    raf: number;
    lastTs: number;
  }>({
    yaw: 0,
    autoRotate: autoRotateInitial,
    dragging: false,
    dragStartX: 0,
    dragStartYaw: 0,
    raf: 0,
    lastTs: 0,
  });

  // ---------------- One-time scene setup ----------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      // WebGL unavailable (e.g. headless preview). Render nothing — the
      // surrounding card UI is still useful as a graceful fallback.
      console.warn("[Brawler3DModel] WebGL unavailable, skipping", err);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.4, 5.5);
    camera.lookAt(0, 1.0, 0);

    // Lighting — three-point setup so the cel-shaded model reads cleanly.
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(color), 0.6);
    rim.position.set(-2, 2, -3);
    scene.add(rim);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    stateRef.current.renderer = renderer;
    stateRef.current.scene = scene;
    stateRef.current.camera = camera;
    stateRef.current.rootGroup = rootGroup;

    // ---------------- Load the GLB ----------------
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;

        // Center & scale to a unit-ish footprint so different exports show at
        // the same on-screen size.
        const box = new THREE.Box3().setFromObject(model);
        const sizeVec = new THREE.Vector3();
        box.getSize(sizeVec);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const targetHeight = 2.2;
        const scale = sizeVec.y > 0.001 ? targetHeight / sizeVec.y : 1;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        rootGroup.add(model);

        const mixer = new THREE.AnimationMixer(model);
        stateRef.current.mixer = mixer;
        stateRef.current.clips = gltf.animations;
        playClip(animation);
      },
      undefined,
      (err) => console.warn("[Brawler3DModel] failed to load", modelUrl, err),
    );

    // ---------------- Render loop ----------------
    const tick = (ts: number) => {
      const s = stateRef.current;
      const dt = s.lastTs ? Math.min(0.05, (ts - s.lastTs) / 1000) : 0;
      s.lastTs = ts;

      if (s.autoRotate && !s.dragging) {
        s.yaw += dt * 0.6;
      }
      if (s.rootGroup) s.rootGroup.rotation.y = s.yaw;
      if (s.mixer) s.mixer.update(dt);
      if (s.renderer && s.scene && s.camera) s.renderer.render(s.scene, s.camera);

      s.raf = requestAnimationFrame(tick);
    };
    stateRef.current.raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(stateRef.current.raf);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      // Dispose of geometries/materials in the root group to free GPU memory.
      rootGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, size]);

  // ---------------- Animation switching ----------------
  const playClip = (name: string) => {
    const s = stateRef.current;
    if (!s.mixer || !s.clips) return;
    const clip = THREE.AnimationClip.findByName(s.clips, name) ?? s.clips[0];
    if (!clip) return;
    const next = s.mixer.clipAction(clip);
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(0.25);
    next.play();
    if (s.currentAction && s.currentAction !== next) {
      s.currentAction.fadeOut(0.25);
    }
    s.currentAction = next;
  };

  useEffect(() => {
    playClip(animation);
  }, [animation]);

  // ---------------- Pointer drag ----------------
  const onPointerDown = (e: React.PointerEvent) => {
    const s = stateRef.current;
    s.dragging = true;
    s.autoRotate = false;
    s.dragStartX = e.clientX;
    s.dragStartYaw = s.yaw;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.dragStartX;
    s.yaw = s.dragStartYaw + dx * 0.012;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    stateRef.current.dragging = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        userSelect: "none",
        touchAction: "none",
        cursor: "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => { stateRef.current.autoRotate = !stateRef.current.autoRotate; }}
      title="Перетащи, чтобы повернуть. Двойной клик — авто-вращение."
    >
      {/* radial glow backdrop */}
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 50% 55%, ${color}55 0%, ${color}15 35%, transparent 70%)`,
          filter: "blur(2px)", pointerEvents: "none",
        }}
      />
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }} />
      <div
        style={{
          position: "absolute", bottom: 4, left: 0, right: 0,
          textAlign: "center", fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: 1.5, fontWeight: 600,
          pointerEvents: "none",
        }}
      >
        ↔ ПЕРЕТАЩИ • 2× КЛИК — АВТО
      </div>
    </div>
  );
}
