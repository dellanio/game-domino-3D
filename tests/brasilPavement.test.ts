import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { brasilPavement } from '../src/render/brasilPavement';
import { buildBrasilStage, concreteTexture } from '../src/render/brasilStage';

describe('Portuguese pavement', () => {
  it('generates deterministic separate color and relief pixels with broad wavy bands', () => {
    const first = brasilPavement(), second = brasilPavement();
    const a = first.map.image.data as Uint8Array, b = second.map.image.data as Uint8Array;
    expect(a.every((value, index) => value === b[index])).toBe(true);
    expect(first.map.source === second.map.source).toBe(false);
    expect(first.map.source === first.bumpMap.source).toBe(false);
    const pixels = first.map.image.data as Uint8Array;
    const heights = first.bumpMap.image.data as Uint8Array;
    const size = first.map.image.width;
    const darkColumns: number[] = [];
    for (const y of [8, 264]) {
      let dark = 0, light = 0, transitions = 0, previous = false, firstDark = -1;
      for (let x = 8; x < size; x += 16) {
        const offset = (y * size + x) * 4;
        const value = pixels[offset];
        if (value >= 70 && value <= 200) continue;
        const isDark = value < 70;
        if (isDark) dark++;
        if (value > 200) { light++; if (firstDark < 0) firstDark = x; }
        if (x > 8 && previous !== isDark) transitions++;
        previous = isDark;
        // Black and ivory stones occupy the same relief range.
        if (value < 70 || value > 200) expect(heights[offset]).toBeGreaterThan(145);
      }
      expect(dark).toBeGreaterThan(20);
      expect(light).toBeGreaterThan(20);
      expect(transitions).toBeGreaterThanOrEqual(3);
      expect(transitions).toBeLessThanOrEqual(4);
      darkColumns.push(firstDark);
    }
    expect(darkColumns[0]).not.toBe(darkColumns[1]);
    expect(heights.some(value => value < 100)).toBe(true); // recessed fine mortar
    expect(first.map.repeat.toArray()).toEqual([12.5, 12.5]);
    expect(first.bumpMap.colorSpace).toBe(THREE.NoColorSpace);
    Object.values(first).forEach(texture => texture.dispose());
    Object.values(second).forEach(texture => texture.dispose());
  });

  it('preserves the concrete surface and exposes all maps to disposal traversal', () => {
    const stage = buildBrasilStage(30, 22);
    expect(stage.getObjectByName('brasil-background')).toBeUndefined();
    expect(stage.getObjectByName('urban-plaster-wall')).toBeUndefined();
    expect(stage.getObjectByName('almond-trunk')).toBeUndefined();
    expect(stage.getObjectByName('chair-0')).toBeUndefined();
    expect(stage.getObjectByName('boteco-rim')).toBeUndefined();
    expect(stage.getObjectByName('bottle-cap')).toBeUndefined();
    const meshes = stage.children.filter(child => child instanceof THREE.Mesh) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
    const surface = meshes.find(mesh => mesh.position.y === 0)!;
    const floor = meshes.find(mesh => mesh.position.y === -3.45)!;
    expect((surface.geometry as THREE.PlaneGeometry).parameters).toMatchObject({ width: 30, height: 22 });
    const reference = concreteTexture();
    const actual = (surface.material.map as THREE.DataTexture).image.data as Uint8Array;
    const expected = reference.image.data as Uint8Array;
    expect(actual.every((value, index) => value === expected[index])).toBe(true);
    expect(surface.material.map!.repeat.toArray()).toEqual([2, 2]);
    const maps = new Set<THREE.Texture>();
    stage.traverse(object => {
      if (object instanceof THREE.Mesh) {
        Object.values(object.material).forEach(value => { if (value instanceof THREE.Texture) maps.add(value); });
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    expect([...maps]).toEqual(expect.arrayContaining([
      surface.material.map, floor.material.map, floor.material.bumpMap,
    ]));
    expect(floor.material.map!.source === surface.material.map!.source).toBe(false);
    const sun = stage.children.find(object => object instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
    expect(sun.position.y / Math.hypot(sun.position.x, sun.position.z)).toBeLessThan(0.4);
    stage.updateMatrixWorld(true);
    sun.shadow.updateMatrices(sun);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(sun.shadow.camera.projectionMatrix, sun.shadow.camera.matrixWorldInverse));
    for (const x of [-22, 22]) for (const z of [-18, 18]) {
      expect(frustum.containsPoint(new THREE.Vector3(x, -3.45, z))).toBe(true);
    }
    maps.forEach(texture => texture.dispose());
    reference.dispose();
    sun.dispose();
  });
});







