import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBrasilProps } from '../src/render/brasilProps';

describe('Brasil props', () => {
  it('keeps every mesh outside play and within a modest geometry budget', () => {
    for (const [width, depth] of [[30, 22], [36, 26]]) {
      const group = buildBrasilProps(width, depth);
      group.updateMatrixWorld(true);
      let nodes = 0, triangles = 0;
      group.traverse(object => {
        nodes++;
        expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        if (!(object instanceof THREE.Mesh)) return;
        const bounds = new THREE.Box3().setFromObject(object);
        expect(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite)).toBe(true);
        expect(bounds.max.x <= -width / 2 || bounds.min.x >= width / 2 ||
          bounds.max.z <= -depth / 2 || bounds.min.z >= depth / 2).toBe(true);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-3.451);
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      });
      expect(nodes).toBeLessThan(65);
      expect(triangles).toBeLessThan(15000);
    }
  });

  it('grounds three four-legged chairs with curved seats and genuinely open backs', () => {
    const group = buildBrasilProps(30, 22);
    const chairs = group.children.filter(child => child.name.startsWith('chair-'));
    expect(chairs).toHaveLength(3);
    for (const chair of chairs) {
      chair.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(chair).min.y).toBeCloseTo(-3.45, 4);
      const back = chair.getObjectByName('slotted-back') as THREE.Mesh<THREE.ExtrudeGeometry>;
      expect((back.geometry.parameters.shapes as THREE.Shape).holes).toHaveLength(3);
      expect(chair.children.filter(child => child.name.startsWith('leg-'))).toHaveLength(4);
      const seat = chair.getObjectByName('curved-seat')!;
      expect(seat.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0);
    }
    expect(chairs[0].rotation.y).not.toBe(-chairs[1].rotation.y);
  });

  it('owns resources per build and exposes them to the stage disposal traversal', () => {
    const a = buildBrasilProps(30, 22), b = buildBrasilProps(30, 22);
    const resources = (root: THREE.Group) => {
      const result = new Set<THREE.BufferGeometry | THREE.Material>();
      root.traverse(object => {
        if (object instanceof THREE.Mesh) {
          result.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => result.add(m));
        }
      });
      return result;
    };
    const first = resources(a), second = resources(b);
    expect([...first].every(resource => !second.has(resource))).toBe(true);
    expect(first.size).toBeLessThan(35);
    let disposed = 0;
    first.forEach(resource => {
      resource.addEventListener('dispose', () => disposed++);
      resource.dispose();
    });
    expect(disposed).toBe(first.size);
  });
});
