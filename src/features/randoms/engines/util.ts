import type * as THREE from "three";

/** Frees every geometry, material and texture in a scene, then the renderer and its canvas. */
export function teardown(
  scene: THREE.Scene,
  renderer: { dispose(): void; domElement: HTMLCanvasElement },
) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material)
      ? m.material
      : m.material
        ? [m.material]
        : [];
    for (const x of mats) {
      for (const v of Object.values(x as unknown as Record<string, unknown>))
        if (v && typeof v === "object" && "isTexture" in v)
          (v as THREE.Texture).dispose();
      x.dispose();
    }
  });
  renderer.dispose();
  renderer.domElement.remove();
}
