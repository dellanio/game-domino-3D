import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBrasilBackground } from '../src/render/brasilBackground';

describe('Brasil background', () => {
  it.each([[30, 22], [40, 30]])('keeps bounded finite scenery outside a %s x %s table', (width, depth) => {
    const group = buildBrasilBackground(width, depth);
    group.updateMatrixWorld(true);
    let nodes = 0;
    group.traverse(node => {
      nodes++;
      expect(node.matrixWorld.elements.every(Number.isFinite)).toBe(true);
      if (!(node instanceof THREE.Mesh)) return;
      const bounds = new THREE.Box3().setFromObject(node);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      // The leaning trunk is planted a few centimetres into the ground.
      expect(bounds.min.y).toBeGreaterThanOrEqual(-3.5);
      expect(bounds.max.y).toBeLessThan(10);
      expect(bounds.max.x < -width / 2 - 1.5 || bounds.max.z < -depth / 2 - 1.5).toBe(true);
    });
    expect(nodes).toBeLessThan(30);
    const wall = new THREE.Box3().setFromObject(group.getObjectByName('urban-plaster-wall')!);
    expect(wall.max.z).toBeLessThan(-22);
    expect(wall.max.y - wall.min.y).toBeGreaterThanOrEqual(6);
    const foliage = group.getObjectByName('almond-foliage') as THREE.InstancedMesh;
    expect(foliage.count).toBe(18);
    const material = foliage.material as THREE.MeshStandardMaterial;
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.roughness).toBeGreaterThan(0.9);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < foliage.count; i++) {
      foliage.getMatrixAt(i, matrix);
      expect(matrix.elements.every(Number.isFinite)).toBe(true);
    }
  });

  it('owns independent deterministic textures reachable by disposal traversal', () => {
    const a = buildBrasilBackground(30, 22);
    const b = buildBrasilBackground(30, 22);
    const wallMaterial = (group: THREE.Group) =>
      (group.getObjectByName('urban-plaster-wall') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const first = wallMaterial(a).map! as THREE.DataTexture;
    const second = wallMaterial(b).map! as THREE.DataTexture;
    expect(first === second).toBe(false);
    expect(first.image.data === second.image.data).toBe(false);
    const firstPixels = first.image.data as Uint8Array;
    const secondPixels = second.image.data as Uint8Array;
    // Compare every byte without the generic matcher's per-index metadata cost.
    expect(firstPixels.length).toBe(secondPixels.length);
    expect(firstPixels.every((value, index) => value === secondPixels[index])).toBe(true);
    expect(new Set(first.image.data).size).toBeGreaterThan(30);
    let disposed = false;
    first.addEventListener('dispose', () => { disposed = true; });
    a.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    expect(disposed).toBe(true);
  });

  it('rejects dimensions that would produce invalid placement', () => {
    for (const value of [0, -1, NaN, Infinity]) {
      expect(() => buildBrasilBackground(value, 22)).toThrow(RangeError);
      expect(() => buildBrasilBackground(30, value)).toThrow(RangeError);
    }
  });
});
