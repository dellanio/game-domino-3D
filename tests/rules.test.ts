import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/game/ai';
import { ChainLayout, TILE_L, TILE_W, type TilePose } from '../src/game/layout';
import { DominoRound, createSet, handPips, isDouble, openingTile, type HandSize, type Tile, type PlayerId } from '../src/game/rules';

const t = (a: number, b: number, id = a * 10 + b): Tile => ({ id, a, b });

/** Gerador determinístico para os testes. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('conjunto de peças', () => {
  it('tem 28 peças únicas, de [0|0] a [6|6]', () => {
    const set = createSet();
    expect(set).toHaveLength(28);
    expect(new Set(set.map((x) => `${x.a}|${x.b}`)).size).toBe(28);
    expect(set.filter(isDouble)).toHaveLength(7);
  });
});

describe('abertura', () => {
  it('começa quem tem a maior dobrada', () => {
    expect(openingTile([[t(1, 1), t(5, 6)], [t(4, 4), t(0, 2)]])).toMatchObject({ player: 1, tile: { a: 4, b: 4 } });
  });
  it('sem dobradas, começa a peça mais pesada', () => {
    expect(openingTile([[t(5, 6), t(0, 1)], [t(4, 6), t(2, 3)]])).toMatchObject({ player: 0, tile: { a: 5, b: 6 } });
  });
  it('a primeira jogada é obrigatoriamente a peça de abertura', () => {
    const r = new DominoRound({ rng: seeded(1) });
    const moves = r.legalMoves();
    expect(moves).toHaveLength(1);
    expect(moves[0]!.tile.id).toBe(r.forcedOpening!.id);
  });
});

/** Monta uma rodada com mãos e monte definidos (ordem: mão 0, mão 1, monte). */
function rigged(h0: Tile[], h1: Tile[], boneyard: Tile[], starter: PlayerId = 0) {
  const r = new DominoRound({ tiles: [...h0, ...h1, ...boneyard], starter });
  r.hands = [h0, h1];
  r.boneyard = boneyard;
  return r;
}

describe('jogadas', () => {
  it('encaixa nas duas pontas e atualiza o que fica exposto', () => {
    const r = rigged([t(3, 5), t(1, 2)], [t(5, 6), t(0, 3)], []);
    r.play({ tile: t(3, 5), side: 'right' });
    expect([r.left, r.right]).toEqual([3, 5]);
    r.play({ tile: t(5, 6), side: 'right' });
    expect(r.right).toBe(6);
    expect(() => r.play({ tile: t(1, 2), side: 'left' })).toThrow(/ilegal/);
  });

  it('peça que serve nas duas pontas iguais aparece uma vez só', () => {
    const r = rigged([t(4, 4), t(1, 2)], [t(4, 6), t(0, 3)], [], 0);
    r.play({ tile: t(4, 4), side: 'right' });
    expect(r.legalMoves().map((m) => m.side)).toEqual(['left']);
  });

  it('sem jogada, compra do monte; sem monte, passa', () => {
    const r = rigged([t(6, 6), t(1, 1)], [t(0, 2), t(0, 3)], [t(2, 4)], 0);
    r.play({ tile: t(6, 6), side: 'right' });
    expect(r.canPlay()).toBe(false);
    expect(r.canDraw()).toBe(true);
    r.draw();
    expect(r.hands[1]).toHaveLength(3);
    expect(r.lacks[1].has(6)).toBe(true);
    expect(r.canPass()).toBe(true);
    r.pass();
    expect(r.turn).toBe(0);
  });

  it('batida: vence quem acaba as peças e leva os pontos da mão do outro', () => {
    const r = rigged([t(2, 3)], [t(5, 6), t(1, 1)], [], 0);
    r.play({ tile: t(2, 3), side: 'right' });
    expect(r.result).toEqual({ kind: 'domino', winner: 0, points: 13 });
  });

  it('jogo fechado: vence quem tem menos pontos', () => {
    const r = rigged([t(6, 6), t(0, 1)], [t(2, 3), t(4, 5)], [], 0);
    r.play({ tile: t(6, 6), side: 'right' });
    r.pass(); // IA
    r.pass(); // humano (só tem [0|1])
    expect(r.result).toEqual({ kind: 'blocked', winner: 0, points: 14, totals: [1, 14] });
  });
});

describe('modos de rodada', () => {
  it('mantém sete peças por mão por padrão', () => {
    const r = new DominoRound();
    expect(r.hands.map((hand) => hand.length)).toEqual([7, 7]);
    expect(r.boneyard).toHaveLength(14);
  });

  it.each([null, 0, 1, 4, 6, 8, -3, 3.5, NaN, Infinity, '3', true])('rejeita handSize inválido: %s', (handSize) => {
    expect(() => new DominoRound({ handSize: handSize as HandSize })).toThrow(RangeError);
  });

  it.each([3, 5, 7] as const)('distribui %i peças por mão na ordem do baralho fornecido', (handSize) => {
    const deck = createSet();
    const r = new DominoRound({ tiles: deck, handSize });
    expect(r.hands).toEqual([deck.slice(0, handSize), deck.slice(handSize, handSize * 2)]);
    expect(r.boneyard).toEqual(deck.slice(handSize * 2));
    expect(deck).toEqual(createSet());
  });

  it.each([3, 5, 7] as const)('preserva abertura, peças e término em 300 jogos com mãos de %i', (handSize) => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const r = new DominoRound({ rng, handSize });
      expect(r.hands.map((hand) => hand.length)).toEqual([handSize, handSize]);
      expect(r.boneyard).toHaveLength(28 - 2 * handSize);
      const dealt = r.hands.flat();
      const doubles = dealt.filter(isDouble);
      const expectedOpening = doubles.length
        ? doubles.reduce((best, tile) => tile.a > best.a ? tile : best)
        : dealt.reduce((best, tile) => handPips([tile]) * 10 + tile.b > handPips([best]) * 10 + best.b ? tile : best);
      expect(r.forcedOpening).toEqual(expectedOpening);
      expect(r.legalMoves()).toEqual([{ tile: expectedOpening, side: 'right' }]);
      expect(r.hands[r.turn]).toContainEqual(expectedOpening);
      const conserve = () => {
        const tiles = [...r.hands.flat(), ...r.boneyard, ...r.chain.map((placed) => placed.tile)];
        expect(tiles.slice().sort((a, b) => a.id - b.id)).toEqual(createSet());
      };
      conserve();
      let guard = 0;
      while (!r.isOver && guard++ < 200) {
        const m = chooseMove(r, { rng });
        if (m) {
          expect(r.legalMoves()).toContainEqual(m);
          r.play(m);
        }
        else if (r.canDraw()) r.draw();
        else r.pass();
        conserve();
      }
      expect(r.isOver).toBe(true);
      const result = r.result!;
      if (result.kind === 'domino') expect(r.hands[result.winner]).toHaveLength(0);
      else {
        expect(r.boneyard).toHaveLength(0);
        expect(result.totals).toEqual(r.hands.map(handPips));
        expect(result.winner).toBe(result.totals[0] === result.totals[1] ? null : result.totals[0] < result.totals[1] ? 0 : 1);
      }
      expect(result.points).toBe(result.winner === null ? 0 : handPips(r.hands[(1 - result.winner) as PlayerId]));
    }
  });
});

describe('IA', () => {
  it('prefere cortar o adversário quando sabe que ele não tem o número', () => {
    const r = rigged([t(1, 2), t(0, 0)], [t(2, 6), t(2, 5), t(3, 3)], [], 1);
    r.hands = [[t(0, 0), t(1, 1)], [t(2, 6), t(2, 5), t(3, 3)]];
    r.chain = [{ tile: t(1, 2), side: 'start', inner: 1, outer: 2 }];
    r.left = 1;
    r.right = 2;
    r.forcedOpening = null;
    r.lacks[0] = new Set([5, 2]);
    const m = chooseMove(r, { noise: 0 })!;
    expect(m.tile).toMatchObject({ a: 2, b: 5 });
  });
});

/** Retângulo ocupado por uma peça na mesa (com tolerância). */
function rect(p: TilePose) {
  const along = Math.abs(Math.cos(p.yaw)) > 0.5; // eixo longo em X
  const hx = (along ? TILE_L : TILE_W) / 2 - 0.01;
  const hz = (along ? TILE_W : TILE_L) / 2 - 0.01;
  return { x0: p.x - hx, x1: p.x + hx, z0: p.z - hz, z1: p.z + hz };
}

describe('posicionamento na mesa', () => {
  it('nenhuma peça se sobrepõe, mesmo em partidas longas com curvas', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const r = new DominoRound({ rng });
      const layout = new ChainLayout();
      const poses: TilePose[] = [];
      let guard = 0;
      while (!r.isOver && guard++ < 200) {
        const m = chooseMove(r, { rng });
        if (m) poses.push(layout.place(r.play(m)));
        else if (r.canDraw()) r.draw();
        else r.pass();
      }
      const rects = poses.map(rect);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
          if (overlap) throw new Error(`seed ${seed}: peças ${i} e ${j} se sobrepõem`);
        }
      for (const p of poses) {
        expect(Math.abs(p.x)).toBeLessThan(10);
        expect(Math.abs(p.z)).toBeLessThan(6.5);
      }
    }
  });
});

describe('orientação das peças na mesa', () => {
  it('a metade com o número que casou fica encostada na peça anterior', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const r = new DominoRound({ rng });
      const layout = new ChainLayout();
      const last: Record<'left' | 'right', { x: number; z: number } | null> = { left: null, right: null };
      let guard = 0;
      while (!r.isOver && guard++ < 200) {
        const m = chooseMove(r, { rng });
        if (!m) {
          if (r.canDraw()) r.draw();
          else r.pass();
          continue;
        }
        const placed = r.play(m);
        const pose = layout.place(placed);
        if (placed.side === 'start') {
          last.left = last.right = { x: pose.x, z: pose.z };
          continue;
        }
        const prev = last[placed.side]!;
        last[placed.side] = { x: pose.x, z: pose.z };
        if (isDouble(placed.tile)) continue;
        // Centro de cada metade no mundo: metade "a" em -X local, "b" em +X local.
        const half = (lx: number) => ({ x: pose.x + Math.cos(pose.yaw) * lx, z: pose.z - Math.sin(pose.yaw) * lx });
        const innerHalf = half(placed.tile.a === placed.inner ? -TILE_W / 2 : TILE_W / 2);
        const outerHalf = half(placed.tile.a === placed.inner ? TILE_W / 2 : -TILE_W / 2);
        const dist = (p: { x: number; z: number }) => Math.hypot(p.x - prev.x, p.z - prev.z);
        if (dist(innerHalf) >= dist(outerHalf)) throw new Error(`seed ${seed}: peça virada ao contrário`);
      }
    }
  });
});
