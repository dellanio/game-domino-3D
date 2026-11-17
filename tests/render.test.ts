import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createTileView, materials, BRASIL_PIP_COLORS } from '../src/render/tileMesh';
import { buildBrasilStage } from '../src/render/brasilStage';

describe('Brasil rendering', () => {
  it('selects the body at every pip center across repeated theme changes', () => {
    for (let value = 1; value <= 6; value++) {
      const view = createTileView({ id: value, a: value, b: value });
      view.root.position.set(3, 0.5, -2);
      view.root.rotation.y = 0.7;
      for (const theme of ['brasil', 'default', 'brasil', 'default'] as const) {
        view.setTheme(theme);
        view.root.updateMatrixWorld(true);
        for (const pip of view.root.children.filter(child => child.userData.pipValue !== undefined)) {
          const target = pip.getWorldPosition(new THREE.Vector3());
          const ray = new THREE.Raycaster(target.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, -1, 0));
          const hits = ray.intersectObjects([view.body], false);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits[0].object).toBe(view.body);
          expect(hits[0].object.userData.tileId).toBe(value);
          // The internal body stays below the visible paint in Brasil.
          if (theme === 'brasil') expect(hits[0].point.y).toBeLessThan(target.y);
        }
      }
      view.dispose();
    }
  });
  it('exposes recessed colored floors through real holes from multiple viewing angles', () => {
    for (let value = 1; value <= 6; value++) {
      const view = createTileView({ id: value, a: value, b: value });
      const defaultGeometry = view.body.geometry;
      view.setTheme('brasil');
      const recessedGeometry = view.body.geometry;
      view.root.updateMatrixWorld(true);
      const pips = view.root.children.filter(child => child.userData.pipValue !== undefined) as THREE.Mesh[];
      for (const pip of pips) {
        pip.geometry.computeBoundingBox();
        const top = pip.position.y + pip.geometry.boundingBox!.max.y;
        expect(0.21 - top).toBeGreaterThan(0.015);
        for (const direction of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.6, 1, 0.4), new THREE.Vector3(-0.6, 1, -0.4)]) {
          direction.normalize();
          const target = new THREE.Vector3(pip.position.x, top, pip.position.z);
          const ray = new THREE.Raycaster(target.clone().addScaledVector(direction, 2), direction.clone().negate());
          const hits = ray.intersectObjects([view.body, pip]);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits[0].object).toBe(pip);
        }
      }
      view.setTheme('default');
      expect(view.body.geometry).toBe(defaultGeometry);
      view.setTheme('brasil');
      expect(view.body.geometry).toBe(recessedGeometry);
      let disposed = false;
      recessedGeometry.addEventListener('dispose', () => { disposed = true; });
      view.dispose();
      expect(disposed).toBe(true);
    }
  });
  it('colors each half by its value and restores the same body and default materials', () => {
    expect(BRASIL_PIP_COLORS.slice(1)).toEqual([0xffffff, 0xf04b24, 0x101014, 0x168342, 0xffd526, 0xf04b24]);
    for (let value = 0; value <= 6; value++) {
      const view = createTileView({ id: value, a: value, b: 6 });
      const original = view.bodyMaterial;
      const children = [...view.root.children];
      const cached = new Set<THREE.Material>();
      for (let repeat = 0; repeat < 20; repeat++) {
        view.setTheme('brasil');
        expect(view.bodyMaterial).toBe(original);
        expect(original.color.getHex()).toBe(0x082777);
        const pips = view.root.children.filter(child => child.userData.pipValue !== undefined) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[];
        expect(pips).toHaveLength(value + 6);
        for (const pip of pips) {
          expect(pip.material.color.getHex()).toBe(BRASIL_PIP_COLORS[pip.userData.pipValue]);
          cached.add(pip.material);
        }
        view.setTheme('default');
        expect(original.color.getHex()).toBe(materials.body.color.getHex());
        expect(pips.every(pip => pip.material === materials.pip)).toBe(true);
        expect(view.root.children).toEqual(children);
      }
      expect(cached.size).toBeLessThanOrEqual(2);
      expect(view.body.userData.tileId).toBe(value);
      view.dispose();
    }
  });
  it('keeps the playing plane at zero with local concrete maps and a volumetric slab', () => {
    const group = buildBrasilStage(30, 22);
    const surface = group.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry && child.position.y === 0) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    expect(surface.geometry.parameters).toMatchObject({ width: 30, height: 22 });
    expect(surface.material.map).toBe(surface.material.bumpMap);
    expect(surface.material.roughness).toBe(0.98);
    expect(surface.material.map).toBeInstanceOf(THREE.DataTexture);
    const floor = group.children.find(child => child instanceof THREE.Mesh && child.position.y === -3.45) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    // Sidewalk joints must never leak onto the seamless tabletop texture.
    expect(floor.material.map!.source).not.toBe(surface.material.map!.source);
    expect(surface.material.map!.repeat.toArray()).toEqual([2, 2]);
    expect(group.children.some(child => child instanceof THREE.DirectionalLight && child.castShadow)).toBe(true);
  });
});
