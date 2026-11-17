// Peça de dominó modelada: corpo de resina marfim com cantos arredondados,
// pontos embutidos em preto brilhante, filete central de latão com pino.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TILE_L, TILE_W } from '../game/layout';
import type { ThemeId } from '../theme';
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
  setTheme(theme: ThemeId): void;
  dispose(): void;
  tile: Tile;
  /** Nó externo: posição e giro na mesa. */
  root: THREE.Group;
  /** Corpo (para destacar e para o clique). */
  body: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
}

export const BRASIL_PIP_COLORS = [0, 0xffffff, 0xf04b24, 0x101014, 0x168342, 0xffd526, 0xf04b24] as const;
const brasilPips = BRASIL_PIP_COLORS.map(color => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.7 }));
const whiteBar = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const steel = new THREE.MeshStandardMaterial({ color: 0xc4c9d0, metalness: 1, roughness: 0.23 });

/** Replace only the flat top with a perforated plate and real socket walls. */
function recessedBody(tile: Tile): THREE.BufferGeometry {
  const positions = bodyGeo.getAttribute('position');
  const keep: number[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    if (![0, 1, 2].every(j => Math.abs(positions.getY(i + j) - TILE_H / 2) < 1e-6)) {
      keep.push(i, i + 1, i + 2);
    }
  }
  const shell = bodyGeo.clone();
  shell.setIndex(keep);
  const shellTriangles = shell.toNonIndexed();
  shell.dispose();
  const face = new THREE.Shape();
  const x = TILE_L / 2 - 0.11;
  const z = TILE_W / 2 - 0.11;
  face.moveTo(-x, -z);
  face.lineTo(x, -z);
  face.lineTo(x, z);
  face.lineTo(-x, z);
  face.closePath();
  for (const [value, cx] of [[tile.a, -TILE_W / 2], [tile.b, TILE_W / 2]]) {
    for (const [px, pz] of PIP_LAYOUT[value]!) {
      const hole = new THREE.Path();
      hole.absarc(cx + px, -pz, 0.086, 0, Math.PI * 2, true);
      face.holes.push(hole);
    }
  }
  const plate = new THREE.ExtrudeGeometry(face, {
    depth: 0.024, bevelEnabled: false, steps: 1, curveSegments: 28,
  });
  plate.rotateX(-Math.PI / 2);
  plate.translate(0, TILE_H / 2 - 0.024, 0);
  const result = mergeGeometries([shellTriangles, plate]);
  shellTriangles.dispose();
  plate.dispose();
  return result;
}

function addPips(group: THREE.Group, value: number, cx: number): void {
  for (const [px, pz] of PIP_LAYOUT[value]!) {
    const pip = new THREE.Mesh(pipGeo, materials.pip);
    // Disco preto embutido na face, rente à superfície: ponto pintado e envernizado.
    pip.position.set(cx + px, TILE_H / 2 - 0.006, pz);
    pip.userData.pipValue = value;
    pip.castShadow = false;
    group.add(pip);
  }
}

export function createTileView(tile: Tile): TileView {
  let brasilBody: THREE.BufferGeometry | undefined;
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // primeiro vira (X), depois gira na mesa (Y)
  root.name = `tile-${tile.a}-${tile.b}`;

  // Cada peça tem seu próprio material do corpo, para poder brilhar quando jogável.
  const bodyMaterial = materials.body.clone();
  const body = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>(bodyGeo, bodyMaterial);
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

  const setTheme = (theme: ThemeId) => {
    const brasil = theme === 'brasil';
    if (brasil) brasilBody ??= recessedBody(tile);
    body.geometry = brasil ? brasilBody! : bodyGeo;
    bodyMaterial.color.setHex(brasil ? 0x164bcc : 0xf3ecdc);
    bodyMaterial.sheenColor.setHex(brasil ? 0x719aff : 0xfff6e0);
    bar.material = brasil ? whiteBar : materials.brass;
    pin.material = backPin.material = brasil ? steel : materials.brass;
    for (const child of root.children) {
      if (child instanceof THREE.Mesh && child.userData.pipValue !== undefined) {
        child.material = brasil ? brasilPips[child.userData.pipValue]! : materials.pip;
        // Colored floor is 0.018 below the face, inside the open socket.
        child.position.y = TILE_H / 2 - (brasil ? 0.028 : 0.006);
      }
    }
  };
  return { tile, root, body, bodyMaterial, setTheme, dispose: () => {
    bodyMaterial.dispose();
    brasilBody?.dispose();
  } };
}
