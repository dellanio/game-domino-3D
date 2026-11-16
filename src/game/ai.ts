// IA do adversário: heurística de quem joga dominó de verdade.
// - livra-se das peças pesadas e das dobradas cedo;
// - mantém na mão números que casam com as pontas (não se tranca);
// - "corta" o adversário: deixa nas pontas números que ele já mostrou não ter;
// - evita abrir pontas com números que ele claramente tem de sobra.

import { DominoRound, type Move, type PlayerId, hasValue, isDouble, otherValue, pipCount } from './rules';

export interface AiOptions {
  /** 0 = joga perfeito segundo a heurística; valores maiores = mais erros. */
  noise?: number;
  rng?: () => number;
}

export function scoreMove(round: DominoRound, move: Move, me: PlayerId): number {
  const opp = (1 - me) as PlayerId;
  const { tile } = move;
  let score = 0;

  score += pipCount(tile) * 1.0;
  if (isDouble(tile)) score += 4;

  // Pontas depois da jogada.
  let left = round.left;
  let right = round.right;
  if (round.isEmpty) {
    left = tile.a;
    right = tile.b;
  } else if (move.side === 'left') {
    left = otherValue(tile, round.left);
  } else {
    right = otherValue(tile, round.right);
  }

  // Quantas peças que sobram na minha mão ainda encaixam.
  const rest = round.hands[me].filter((t) => t.id !== tile.id);
  const playableAfter = rest.filter((t) => hasValue(t, left) || hasValue(t, right)).length;
  score += playableAfter * 1.5;

  // Controle de um número: quantas peças eu tenho com ele.
  for (const end of new Set([left, right])) {
    const mine = rest.filter((t) => hasValue(t, end)).length;
    score += mine * 1.2;
  }

  // Cortar o adversário: ele não tem esses números.
  const lacks = round.lacks[opp];
  if (lacks.has(left)) score += 3;
  if (lacks.has(right)) score += 3;
  if (lacks.has(left) && lacks.has(right)) score += 4;

  // Fechar o jogo só compensa se eu estiver com menos pontos na mão.
  const visible = countVisible(round, tile);
  for (const end of new Set([left, right])) {
    if (visible(end) >= 7) {
      const myPips = rest.reduce((s, t) => s + pipCount(t), 0);
      score += myPips < 10 ? 2 : -2;
    }
  }

  return score;
}

/** Quantas peças com o número v já estão na mesa (contando a que vou jogar). */
function countVisible(round: DominoRound, playing: { id: number; a: number; b: number }) {
  return (v: number): number => {
    let n = hasValue(playing, v) ? 1 : 0;
    for (const p of round.chain) if (hasValue(p.tile, v)) n++;
    return n;
  };
}

export function chooseMove(round: DominoRound, opts: AiOptions = {}): Move | null {
  const me = round.turn;
  const moves = round.legalMoves(me);
  if (moves.length === 0) return null;
  const rng = opts.rng ?? Math.random;
  const noise = opts.noise ?? 1.5;
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(round, m, me) + (rng() - 0.5) * noise;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}
