import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface Props {
  modelPath: string;
  size?: number;
  color?: string;
}

const base = (import.meta as any).env?.BASE_URL ?? "/";
function assetUrl(path: string) {
  const b = base.endsWith("/") ? base : base + "/";
  return b + path.replace(/^\//, "");
}

export default function SpinningModel3D({ modelPath, size = 48, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 0.6, 3);
    camera.lookAt(0, 0.2, 0);

    const amb = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 2.5);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const back = new THREE.DirectionalLight(color ? new THREE.Color(color) : 0x8888ff, 0.8);
    back.position.set(-2, -1, -3);
    scene.add(back);

    let modelGroup: THREE.Group | null = null;
    let rafId = 0;

    const loader = new GLTFLoader();
    loader.load(assetUrl(modelPath), (gltf) => {
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
      modelGroup = new THREE.Group();
      modelGroup.add(model);
      scene.add(modelGroup);
    });

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (modelGroup) modelGroup.rotation.y += 0.025;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
    };
  }, [modelPath, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: "block" }} />;
}
