import * as THREE from 'three';
import { brasilPavement } from './brasilPavement';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Seamless, deterministic cement mottling with fine aggregate and small pores. */
export function concreteTexture(): THREE.DataTexture {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  let seed = 429;
  const noise = (x: number, y: number, cells: number): number => {
    const gx = x / size * cells, gy = y / size * cells;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const smooth = (v: number) => v * v * (3 - 2 * v);
    const tx = smooth(gx - ix), ty = smooth(gy - iy);
    const hash = (a: number, b: number) => {
      let h = Math.imul(a % cells + 37, 374761393) ^ Math.imul(b % cells + 71, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
    };
    const a = hash(ix, iy) * (1 - tx) + hash(ix + 1, iy) * tx;
    const b = hash(ix, iy + 1) * (1 - tx) + hash(ix + 1, iy + 1) * tx;
    return a * (1 - ty) + b * ty - 0.5;
  };
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = seed / 0xffffffff;
    const x = i % size, y = Math.floor(i / size);
    const mottling = noise(x, y, 4) * 36 + noise(x, y, 16) * 18 + noise(x, y, 64) * 9;
    const pore = grain < 0.012 ? -32 : 0;
    const v = Math.round(166 + mottling + (grain - 0.5) * 13 + pore);
    data.set([v, v, v + 1, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function buildBrasilStage(width: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'brasil-stage';
  const grain = concreteTexture();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8babd, map: grain,
    bumpMap: grain, bumpScale: 0.065, roughness: 0.98 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    // World-scaled concrete coordinates avoid stretching grain into stripes on long rims.
    if (geometry instanceof RoundedBoxGeometry) {
      const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        const u = nx > ny && nx > nz ? p.getZ(i) + z : p.getX(i) + x;
        const v = ny >= nx && ny >= nz ? p.getZ(i) + z : p.getY(i) + y;
        uv.setXY(i, u * 0.08, v * 0.08);
      }
    }
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = result.receiveShadow = true;
    group.add(result);
    return result;
  };
  // The recessed playing surface remains exactly at y=0. Rounded lip stays outside it.
  mesh(new RoundedBoxGeometry(width + 3, 1.35, depth + 3, 5, 0.22), concrete, 0, -0.78, 0);
  const surface = mesh(new THREE.PlaneGeometry(width, depth), concrete, 0, 0, 0);
  surface.rotation.x = -Math.PI / 2;
  const lipMaterial = concrete.clone();
  lipMaterial.color.setHex(0xa3a6aa);
  for (const [x, z, w, d] of [
    [0, -depth / 2 - 0.625, width + 2.5, 1.25], [0, depth / 2 + 0.625, width + 2.5, 1.25],
    [-width / 2 - 0.625, 0, 1.25, depth], [width / 2 + 0.625, 0, 1.25, depth],
  ]) mesh(new RoundedBoxGeometry(w!, 0.55, d!, 5, 0.13), lipMaterial, x!, 0.125, z!);
  // Substantial concrete supports and a pale paved public square below the tabletop.
  for (const x of [-width * 0.32, width * 0.32]) {
    mesh(new RoundedBoxGeometry(1.4, 2.4, depth * 0.65, 3, 0.12), concrete, x, -2.2, 0);
  }
  const pavingTextures = brasilPavement();
  const paving = new THREE.MeshStandardMaterial({ color: 0xffffff, ...pavingTextures, roughness: 1, bumpScale: 0.045 });
  const floor = mesh(new THREE.PlaneGeometry(200, 200), paving, 0, -3.45, 0);
  floor.rotation.x = -Math.PI / 2;
  const sun = new THREE.DirectionalLight(0xffbf80, 3);
  sun.position.set(-32, 15, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 38, bottom: -38, near: 1, far: 110 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 4;
  group.add(sun, sun.target, new THREE.HemisphereLight(0xf5f7ff, 0xaaa49a, 0.5));
  return group;
}
