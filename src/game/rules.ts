// Regras do dominó "mano a mano" (você × IA), com compra do monte.
// Lógica pura, sem nada de 3D: testável isoladamente.

export interface Tile {
  id: number;
  a: number; // a <= b
  b: number;
}

export type PlayerId = 0 | 1; // 0 = humano, 1 = IA
export type Side = 'left' | 'right';

export interface Move {
  tile: Tile;
  side: Side;
}

/** Uma peça já na mesa: `inner` é o número que encaixou, `outer` o que ficou exposto. */
export interface PlacedTile {
  tile: Tile;
  side: Side | 'start';
  inner: number;
  outer: number;
}

export type RoundEnd =
  | { kind: 'domino'; winner: PlayerId; points: number }
  | { kind: 'blocked'; winner: PlayerId | null; points: number; totals: [number, number] };

export const HAND_SIZE = 7;

export const pipCount = (t: Tile): number => t.a + t.b;
export const isDouble = (t: Tile): boolean => t.a === t.b;
export const handPips = (hand: Tile[]): number => hand.reduce((s, t) => s + pipCount(t), 0);
export const hasValue = (t: Tile, v: number): boolean => t.a === v || t.b === v;
export const otherValue = (t: Tile, v: number): number => (t.a === v ? t.b : t.a);

export function createSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push({ id: id++, a, b });
  return tiles;
}

export type Rng = () => number;

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Peça de abertura: a maior dobrada; sem dobradas, a peça mais pesada. */
export function openingTile(hands: [Tile[], Tile[]]): { player: PlayerId; tile: Tile } {
  let best: { player: PlayerId; tile: Tile; score: number } | null = null;
  hands.forEach((hand, p) => {
    for (const t of hand) {
      const score = isDouble(t) ? 100 + t.a : pipCount(t) + t.b / 10;
      if (!best || score > best.score) best = { player: p as PlayerId, tile: t, score };
    }
  });
  if (!best) throw new Error('mãos vazias');
  const { player, tile } = best;
  return { player, tile };
}

export class DominoRound {
  hands: [Tile[], Tile[]];
  boneyard: Tile[];
  chain: PlacedTile[] = [];
  left = -1;
  right = -1;
  turn: PlayerId;
  /** Se definido, a primeira jogada é obrigatoriamente esta peça. */
  forcedOpening: Tile | null;
  consecutivePasses = 0;
  result: RoundEnd | null = null;
  /** Números que cada jogador mostrou não ter (comprou ou passou com eles na ponta). */
  lacks: [Set<number>, Set<number>] = [new Set(), new Set()];

  constructor(opts: { rng?: Rng; starter?: PlayerId | null; tiles?: Tile[] } = {}) {
    const deck = opts.tiles ?? shuffle(createSet(), opts.rng);
    this.hands = [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, HAND_SIZE * 2)];
    this.boneyard = deck.slice(HAND_SIZE * 2);
    if (opts.starter === undefined || opts.starter === null) {
      const open = openingTile(this.hands);
      this.turn = open.player;
      this.forcedOpening = open.tile;
    } else {
      this.turn = opts.starter;
      this.forcedOpening = null;
    }
  }

  get isEmpty(): boolean {
    return this.chain.length === 0;
  }

  get isOver(): boolean {
    return this.result !== null;
  }

  legalMoves(player: PlayerId = this.turn): Move[] {
    const hand = this.hands[player];
    if (this.isEmpty) {
      const tiles = this.forcedOpening ? hand.filter((t) => t.id === this.forcedOpening!.id) : hand;
      return tiles.map((tile) => ({ tile, side: 'right' as Side }));
    }
    const moves: Move[] = [];
    for (const tile of hand) {
      if (hasValue(tile, this.left)) moves.push({ tile, side: 'left' });
      if (hasValue(tile, this.right) && !(this.left === this.right && hasValue(tile, this.left))) {
        moves.push({ tile, side: 'right' });
      }
    }
    return moves;
  }

  canPlay(player: PlayerId = this.turn): boolean {
    return this.legalMoves(player).length > 0;
  }

  canDraw(): boolean {
    return !this.isOver && !this.canPlay() && this.boneyard.length > 0;
  }

  canPass(): boolean {
    return !this.isOver && !this.canPlay() && this.boneyard.length === 0;
  }

  play(move: Move): PlacedTile {
    if (this.isOver) throw new Error('rodada encerrada');
    const legal = this.legalMoves().some((m) => m.tile.id === move.tile.id && m.side === move.side);
    if (!legal) throw new Error(`jogada ilegal: [${move.tile.a}|${move.tile.b}] ${move.side}`);

    const hand = this.hands[this.turn];
    hand.splice(
      hand.findIndex((t) => t.id === move.tile.id),
      1,
    );

    let placed: PlacedTile;
    if (this.isEmpty) {
      placed = { tile: move.tile, side: 'start', inner: move.tile.a, outer: move.tile.b };
      this.left = move.tile.a;
      this.right = move.tile.b;
      this.forcedOpening = null;
    } else if (move.side === 'left') {
      const outer = otherValue(move.tile, this.left);
      placed = { tile: move.tile, side: 'left', inner: this.left, outer };
      this.left = outer;
    } else {
      const outer = otherValue(move.tile, this.right);
      placed = { tile: move.tile, side: 'right', inner: this.right, outer };
      this.right = outer;
    }
    this.chain.push(placed);
    this.consecutivePasses = 0;

    if (hand.length === 0) {
      const loser = (1 - this.turn) as PlayerId;
      this.result = { kind: 'domino', winner: this.turn, points: handPips(this.hands[loser]) };
    } else {
      this.nextTurn();
    }
    return placed;
  }

  draw(): Tile {
    if (!this.canDraw()) throw new Error('não pode comprar agora');
    this.noteLacks();
    const tile = this.boneyard.pop()!;
    this.hands[this.turn].push(tile);
    return tile;
  }

  pass(): void {
    if (!this.canPass()) throw new Error('não pode passar agora');
    this.noteLacks();
    this.consecutivePasses++;
    if (this.consecutivePasses >= 2) {
      this.result = this.blockedResult();
    } else {
      this.nextTurn();
    }
  }

  private noteLacks(): void {
    if (this.isEmpty) return;
    this.lacks[this.turn].add(this.left);
    this.lacks[this.turn].add(this.right);
  }

  private nextTurn(): void {
    this.turn = (1 - this.turn) as PlayerId;
  }

  /** Jogo fechado: vence quem tem menos pontos na mão e leva os pontos do adversário. */
  private blockedResult(): RoundEnd {
    const totals: [number, number] = [handPips(this.hands[0]), handPips(this.hands[1])];
    if (totals[0] === totals[1]) return { kind: 'blocked', winner: null, points: 0, totals };
    const winner: PlayerId = totals[0] < totals[1] ? 0 : 1;
    return { kind: 'blocked', winner, points: totals[1 - winner]!, totals };
  }
}
