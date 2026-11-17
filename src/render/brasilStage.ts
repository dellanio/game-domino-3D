import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Local, deterministic aggregate grain, shared by color, bump and roughness. */
export function concreteTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  let seed = 429;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = seed / 0xffffffff;
    const x = i % size, y = Math.floor(i / size);
    const v = 193 + grain * 34 + Math.sin(x / 19) * Math.sin(y / 27) * 7;
    data.set([v, v - 3, v - 9, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function buildBrasilStage(width: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'brasil-stage';
  const grain = concreteTexture();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xeee9dd, map: grain,
    roughnessMap: grain, bumpMap: grain, bumpScale: 0.035, roughness: 0.96 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = result.receiveShadow = true;
    group.add(result);
    return result;
  };
  // The recessed playing surface remains exactly at y=0. Rounded lip stays outside it.
  mesh(new RoundedBoxGeometry(width + 1.4, 1.05, depth + 1.4, 5, 0.22), concrete, 0, -0.59, 0);
  const surface = mesh(new THREE.PlaneGeometry(width, depth), concrete, 0, 0, 0);
  surface.rotation.x = -Math.PI / 2;
  const lipMaterial = concrete.clone();
  lipMaterial.color.setHex(0xd7d2c7);
  for (const [x, z, w, d] of [
    [0, -depth / 2 - 0.22, width + 0.9, 0.44], [0, depth / 2 + 0.22, width + 0.9, 0.44],
    [-width / 2 - 0.22, 0, 0.44, depth], [width / 2 + 0.22, 0, 0.44, depth],
  ]) mesh(new RoundedBoxGeometry(w!, 0.18, d!, 3, 0.075), lipMaterial, x!, -0.035, z!);
  // Substantial concrete supports and a pale paved public square below the tabletop.
  for (const x of [-width * 0.32, width * 0.32]) {
    mesh(new RoundedBoxGeometry(1.4, 2.4, depth * 0.65, 3, 0.12), concrete, x, -2.2, 0);
  }
  const paving = new THREE.MeshStandardMaterial({ color: 0xc3bca9, map: grain, roughness: 1, bumpMap: grain, bumpScale: 0.06 });
  const floor = mesh(new THREE.PlaneGeometry(200, 200), paving, 0, -3.45, 0);
  floor.rotation.x = -Math.PI / 2;
  const dark = new THREE.MeshStandardMaterial({ color: 0x454841, roughness: 1 });
  // Geometric inlays along the perimeter leave the central tile arrangement unobstructed.
  for (const z of [-depth * 0.40, depth * 0.40]) {
    const line = mesh(new THREE.PlaneGeometry(width * 0.78, 0.045), dark, 0, 0.002, z);
    line.rotation.x = -Math.PI / 2;
    for (const x of [-width * 0.39, width * 0.39]) {
      const mark = mesh(new THREE.PlaneGeometry(0.8, 0.8), dark, x, 0.003, z);
      mark.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    }
  }
  const sun = new THREE.DirectionalLight(0xfff3da, 3.1);
  sun.position.set(-12, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 2;
  group.add(sun, sun.target, new THREE.HemisphereLight(0xcde7ff, 0xa59a82, 1.1));
  return group;
}
