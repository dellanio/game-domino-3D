// Posição de cada peça na mesa. A corrente cresce para os dois lados a partir
// do centro e faz curva (em "cobrinha") quando chega perto da borda.
// Unidades: peça com W = 1 de largura e L = 2 de comprimento. Plano XZ.

import { isDouble, type PlacedTile, type Tile } from './rules';

export const TILE_W = 1;
export const TILE_L = 2;
export const GAP = 0.04;

export interface Vec2 {
  x: number;
  z: number;
}

/** Transformação de uma peça na mesa. `yaw`: rotação em Y (local +X = metade "b"). */
export interface TilePose {
  x: number;
  z: number;
  yaw: number;
}

interface EndState {
  p: Vec2; // ponto (no eixo da corrente) onde a próxima peça encosta
  seg: number; // índice na sequência de direções
  stepsInSeg: number;
}

type Computed =
  | { kind: 'start'; pose: TilePose; ends: Record<'left' | 'right', EndState> }
  | { kind: 'end'; pose: TilePose; side: 'left' | 'right'; next: EndState };

const RIGHT_DIRS: Vec2[] = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
];
const LEFT_DIRS: Vec2[] = [
  { x: -1, z: 0 },
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
];

const add = (a: Vec2, b: Vec2, k = 1): Vec2 => ({ x: a.x + b.x * k, z: a.z + b.z * k });
/** yaw para que o +X local da peça aponte na direção d. */
const yawFor = (d: Vec2): number => Math.atan2(-d.z, d.x);

export class ChainLayout {
  private ends: Record<'left' | 'right', EndState> | null = null;

  constructor(private readonly xLimit = 8.5) {}

  reset(): void {
    this.ends = null;
  }

  /** Calcula a pose sem alterar o estado (para pré-visualizar onde a peça vai cair). */
  preview(placed: PlacedTile): TilePose {
    return this.compute(placed).pose;
  }

  place(placed: PlacedTile): TilePose {
    const r = this.compute(placed);
    if (r.kind === 'start') this.ends = r.ends;
    else this.ends![r.side] = r.next;
    return r.pose;
  }

  private compute(placed: PlacedTile): Computed {
    const { tile } = placed;
    const dbl = isDouble(tile);
    const step = TILE_L + GAP;
    const stepW = TILE_W + GAP;

    if (placed.side === 'start' || !this.ends) {
      // Primeira peça no centro. Dobrada fica atravessada.
      const half = dbl ? stepW / 2 : step / 2;
      const ends = {
        left: { p: { x: -half, z: 0 }, seg: 0, stepsInSeg: 0 },
        right: { p: { x: half, z: 0 }, seg: 0, stepsInSeg: 0 },
      };
      // a metade "a" (local -X) fica do lado esquerdo = ponta esquerda
      return { kind: 'start', pose: { x: 0, z: 0, yaw: dbl ? Math.PI / 2 : 0 }, ends };
    }

    const side = placed.side;
    const dirs = side === 'right' ? RIGHT_DIRS : LEFT_DIRS;
    const end = this.ends[side];
    let seg = end.seg;
    let steps = end.stepsInSeg;
    const d = dirs[seg % 4]!;
    const horizontal = seg % 2 === 0;

    let turn = false;
    if (horizontal) {
      const need = dbl ? stepW : step;
      if (Math.abs(end.p.x + d.x * need) > this.xLimit) turn = true;
    } else if (steps >= 1) {
      turn = true;
    }

    let center: Vec2;
    let p: Vec2;
    let dir: Vec2;
    let alongDir = true; // peça deitada no sentido da corrente
    if (turn) {
      seg++;
      steps = 0;
      dir = dirs[seg % 4]!;
      // Curva: a metade de dentro encosta na ponta anterior, a peça segue na nova direção.
      const q = add(end.p, d, stepW / 2);
      center = add(q, dir, stepW / 2);
      p = add(q, dir, stepW / 2 + step / 2);
    } else {
      dir = d;
      if (dbl) {
        alongDir = false;
        center = add(end.p, dir, stepW / 2);
        p = add(end.p, dir, stepW);
      } else {
        center = add(end.p, dir, step / 2);
        p = add(end.p, dir, step);
      }
    }
    steps++;

    let yaw: number;
    if (!alongDir) {
      yaw = yawFor(dir) + Math.PI / 2;
    } else {
      // A metade que encosta (local -X = "a") deve mostrar `inner`.
      yaw = yawFor(dir);
      if (!dbl && tile.b === placed.inner) yaw += Math.PI;
    }

    return { kind: 'end', pose: { x: center.x, z: center.z, yaw }, side, next: { p, seg, stepsInSeg: steps } };
  }
}

export function tileKey(t: Tile): string {
  return `${t.a}|${t.b}`;
}
