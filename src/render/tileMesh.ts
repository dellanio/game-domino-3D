// Peça de dominó modelada: corpo de resina marfim com cantos arredondados,
// pontos embutidos em preto brilhante, filete central de latão com pino.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TILE_L, TILE_W } from '../game/layout';
import type { Tile } from '../game/rules';

export const TILE_H = 0.42;

const bodyGeo = new RoundedBoxGeometry(TILE_L, TILE_H, TILE_W, 5, 0.11);
const pipGeo = new THREE.CylinderGeometry(0.086, 0.078, 0.02, 28);
const barGeo = new RoundedBoxGeometry(0.035, 0.02, TILE_W * 0.72, 2, 0.008);
const pinGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.03, 28);

/** Textura sutil de "resina": leve variação de cor e rugosidade, gerada em canvas. */
function resinTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const v = 118 + Math.random() * 20;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    const r = Math.random() * 3 + 0.5;
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const resinRough = typeof document !== 'undefined' ? resinTexture() : null;

export const materials = {
  body: new THREE.MeshPhysicalMaterial({
    color: 0xf3ecdc,
    roughness: 0.32,
    roughnessMap: resinRough,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xfff6e0),
    sheenRoughness: 0.6,
  }),
  pip: new THREE.MeshPhysicalMaterial({
    color: 0x0d0d10,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.28 }),
};

/** Posições dos pontos (em unidades de meia-peça), padrões clássicos de 0 a 6. */
const O = 0.27;
const PIP_LAYOUT: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [
    [-O, -O],
    [O, O],
  ],
  3: [
    [-O, -O],
    [0, 0],
    [O, O],
  ],
  4: [
    [-O, -O],
    [O, -O],
    [-O, O],
    [O, O],
  ],
  5: [
    [-O, -O],
    [O, -O],
    [0, 0],
    [-O, O],
    [O, O],
  ],
  6: [
    [-O, -O],
    [0, -O],
    [O, -O],
    [-O, O],
    [0, O],
    [O, O],
  ],
};

export interface TileView {
  tile: Tile;
  /** Nó externo: posição e giro na mesa. */
  root: THREE.Group;
  /** Corpo (para destacar e para o clique). */
  body: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
}

function addPips(group: THREE.Group, value: number, cx: number): void {
  for (const [px, pz] of PIP_LAYOUT[value]!) {
    const pip = new THREE.Mesh(pipGeo, materials.pip);
    // Disco preto embutido na face, rente à superfície: ponto pintado e envernizado.
    pip.position.set(cx + px, TILE_H / 2 - 0.006, pz);
    pip.castShadow = false;
    group.add(pip);
  }
}

export function createTileView(tile: Tile): TileView {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // primeiro vira (X), depois gira na mesa (Y)
  root.name = `tile-${tile.a}-${tile.b}`;

  // Cada peça tem seu próprio material do corpo, para poder brilhar quando jogável.
  const bodyMaterial = materials.body.clone();
  const body = new THREE.Mesh(bodyGeo, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.tileId = tile.id;
  root.add(body);

  // Metade "a" no lado -X, metade "b" no +X.
  addPips(root, tile.a, -TILE_W / 2);
  addPips(root, tile.b, TILE_W / 2);

  const bar = new THREE.Mesh(barGeo, materials.brass);
  bar.position.y = TILE_H / 2 + 0.002;
  root.add(bar);
  const pin = new THREE.Mesh(pinGeo, materials.brass);
  pin.position.y = TILE_H / 2 + 0.008;
  root.add(pin);

  // Fundo: um pino de latão discreto, para a peça virada não parecer um bloco liso.
  const backPin = new THREE.Mesh(pinGeo, materials.brass);
  backPin.position.y = -TILE_H / 2 - 0.008;
  root.add(backPin);

  return { tile, root, body, bodyMaterial };
}
