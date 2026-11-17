import { setupThemeMenu } from './uiTheme';
import { playGatheringSound, playTileSound, stopGatheringSound } from './music';
// Controlador do jogo: liga regras, IA, cena 3D e interface.

import * as THREE from 'three';
import { chooseMove } from './game/ai';
import { ChainLayout, type TilePose } from './game/layout';
import { createSet, DominoRound, otherValue, type Move, type PlacedTile, type PlayerId, type Side } from './game/rules';
import { createStage } from './render/scene';
import { createTileView, TILE_H, type TileView } from './render/tileMesh';
import { sleep, target, Tweener } from './render/tween';

const MATCH_TARGET = 100;
const REST_Y = TILE_H / 2;
const HAND_Z = { 0: 8.3, 1: -8.6 } as const;
const HAND_SPACING = 1.18;
/** Inclinação da mão do jogador para a câmera; a peça sobe para não afundar na mesa. */
const HAND_TILT = 0.55;
const HAND_Y = REST_Y + Math.sin(HAND_TILT) * 1.0 + 0.02;
const AI_THINK_MS = 750;

// ---------- DOM ----------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  menu: $('menu'),
  menuForm: $<HTMLFormElement>('menu-form'),
  game: $('game-ui'),
  menuBtn: $<HTMLButtonElement>('btn-menu'),
  modalMenu: $<HTMLButtonElement>('modal-menu'),
  mode: $('current-mode'),
  scoreYou: $('score-you'),
  scoreAi: $('score-ai'),
  target: $('target'),
  round: $('round'),
  status: $('status'),
  btnDraw: $<HTMLButtonElement>('btn-draw'),
  btnPass: $<HTMLButtonElement>('btn-pass'),
  boneyardCount: $('boneyard-count'),
  modal: $('modal'),
  modalTitle: $('modal-title'),
  modalText: $('modal-text'),
  modalBtn: $<HTMLButtonElement>('modal-btn'),
};
ui.target.textContent = String(MATCH_TARGET);
const themeMenu = setupThemeMenu(ui.menuForm);

// ---------- Cena ----------
const stage = createStage($('stage'));
let tweener = new Tweener();
const layout = new ChainLayout();
const views = new Map<number, TileView>();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function viewOf(id: number): TileView {
  const v = views.get(id);
  if (!v) throw new Error(`peça ${id} sem visual`);
  return v;
}

// Peças-fantasma que mostram onde a peça vai cair quando ela serve nas duas pontas.
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.28, depthWrite: false });
const ghostGeo = new THREE.BoxGeometry(2.04, 0.06, 1.04);
const ghosts: { mesh: THREE.Mesh; move: Move }[] = [];

// ---------- Estado da partida ----------
type HandSize = 3 | 5 | 7;
const modeNames = { 7: 'Clássico', 3: 'Rápido', 5: 'Compacto' } as const;
let handSize: HandSize = 7;
let session = 0;
let inMenu = true;
const isCurrent = (token: number) => token === session && !inMenu;
let round!: DominoRound;
let scores: [number, number] = [0, 0];
let roundNo = 0;
let nextStarter: PlayerId | null = null;
let busy = false;
let hovered: TileView | null = null;
let selected: TileView | null = null;

function setStatus(text: string) {
  ui.status.textContent = text;
}

function updateHud() {
  ui.scoreYou.textContent = String(scores[0]);
  ui.scoreAi.textContent = String(scores[1]);
  ui.round.textContent = String(roundNo);
  const humanTurn = !round.isOver && round.turn === 0 && !busy;
  ui.btnDraw.hidden = !(humanTurn && round.canDraw());
  ui.btnPass.hidden = !(humanTurn && round.canPass());
  ui.boneyardCount.textContent = `(${round.boneyard.length})`;
}

// ---------- Posições ----------
function handPose(player: PlayerId, index: number, count: number): { x: number; z: number } {
  const x = (index - (count - 1) / 2) * HAND_SPACING;
  return { x, z: HAND_Z[player] };
}

function boneyardPose(index: number): { x: number; z: number } {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 11.0 + col * 2.12, z: -4.6 + row * 1.1 };
}

function legalIds(): Set<number> {
  if (round.isOver || round.turn !== 0) return new Set();
  return new Set(round.legalMoves(0).map((m) => m.tile.id));
}

/** Coloca cada peça das mãos e do monte no lugar certo (animado). */
function arrangeHands(duration = 380): Promise<void> {
  const jobs: Promise<void>[] = [];
  const legal = legalIds();
  ([0, 1] as PlayerId[]).forEach((p) => {
    const hand = round.hands[p];
    hand.forEach((tile, i) => {
      const v = viewOf(tile.id);
      const { x, z } = handPose(p, i, hand.length);
      const isLegal = legal.has(tile.id);
      const lift = p === 0 ? (v === selected ? 0.9 : v === hovered && isLegal ? 0.55 : isLegal ? 0.28 : 0) : 0;
      // Mão do jogador: peças em pé (eixo longo apontando para a mesa), levemente inclinadas para a câmera.
      const t =
        p === 0
          ? target(x, HAND_Y + lift, z, Math.PI / 2, false, HAND_TILT)
          : target(x, REST_Y, z, Math.PI / 2, true);
      jobs.push(tweener.to(v.root, t, { duration }));
      v.bodyMaterial.emissive.setHex(isLegal ? 0x6b4a10 : 0x000000);
      v.bodyMaterial.emissiveIntensity = isLegal ? (v === hovered || v === selected ? 0.55 : 0.28) : 0;
    });
  });
  round.boneyard.forEach((tile, i) => {
    const v = viewOf(tile.id);
    const { x, z } = boneyardPose(i);
    v.bodyMaterial.emissiveIntensity = 0;
    jobs.push(tweener.to(v.root, target(x, REST_Y, z, 0, true), { duration }));
  });
  return Promise.all(jobs).then(() => undefined);
}

// ---------- Jogadas ----------
function placedFor(move: Move): PlacedTile {
  if (round.isEmpty) return { tile: move.tile, side: 'start', inner: move.tile.a, outer: move.tile.b };
  const end = move.side === 'left' ? round.left : round.right;
  return { tile: move.tile, side: move.side, inner: end, outer: otherValue(move.tile, end) };
}

async function animateToTable(view: TileView, pose: TilePose, token: number) {
  // Sobe, vira de face para cima e pousa na corrente.
  await tweener.to(view.root, target(pose.x, REST_Y, pose.z, pose.yaw), { duration: 620, arc: 2.2 });
  if (isCurrent(token)) playTileSound();
}

async function doMove(move: Move) {
  const token = session;
  if (!isCurrent(token)) return;
  busy = true;
  clearGhosts();
  selected = null;
  hovered = null;
  updateHud();
  const view = viewOf(move.tile.id);
  const placed = round.play(move);
  const pose = layout.place(placed);
  view.bodyMaterial.emissiveIntensity = 0;
  await Promise.all([animateToTable(view, pose, token), arrangeHands(420)]);
  if (!isCurrent(token)) return;
  busy = false;
  void step();
}

async function doDraw() {
  const token = session;
  if (!isCurrent(token)) return;
  busy = true;
  updateHud();
  round.draw();
  await arrangeHands(480);
  if (!isCurrent(token)) return;
  busy = false;
}

// ---------- Turnos ----------
async function step() {
  const token = session;
  if (!isCurrent(token)) return;
  updateHud();
  if (round.isOver) return showRoundEnd();

  if (round.turn === 1) {
    busy = true;
    setStatus('A IA está pensando…');
    updateHud();
    await sleep(AI_THINK_MS);
    if (!isCurrent(token)) return;
    while (!round.isOver && round.turn === 1) {
      const m = chooseMove(round);
      if (m) {
        busy = false;
        return doMove(m);
      }
      if (round.canDraw()) {
        setStatus('A IA está comprando…');
        await doDraw();
        if (!isCurrent(token)) return;
        busy = true;
        await sleep(320);
        if (!isCurrent(token)) return;
      } else {
        round.pass();
        setStatus('A IA passou a vez.');
        await sleep(900);
        if (!isCurrent(token)) return;
      }
    }
    busy = false;
    return step();
  }

  // Vez do humano.
  await arrangeHands();
  if (!isCurrent(token)) return;
  if (round.isEmpty && round.forcedOpening) {
    setStatus(`Você começa: jogue a peça [${round.forcedOpening.a}|${round.forcedOpening.b}].`);
  } else if (round.canPlay()) {
    setStatus('Sua vez: clique em uma peça destacada.');
  } else if (round.canDraw()) {
    setStatus('Nenhuma peça serve. Compre do monte.');
  } else {
    setStatus('Nenhuma peça serve e o monte acabou. Passe a vez.');
  }
  updateHud();
}

// ---------- Fim de rodada / partida ----------
function showRoundEnd() {
  const r = round.result!;
  setStatus('');
  updateHud();
  revealAiHand();
  let title: string;
  let text: string;
  if (r.kind === 'domino') {
    scores[r.winner] += r.points;
    title = r.winner === 0 ? 'Você bateu!' : 'A IA bateu.';
    text = `${r.winner === 0 ? 'Você ganha' : 'A IA ganha'} ${r.points} pontos (as peças que sobraram na mão ${r.winner === 0 ? 'da IA' : 'sua'}).`;
  } else {
    title = 'Jogo fechado';
    if (r.winner === null) {
      text = `Empate: os dois ficaram com ${r.totals[0]} pontos na mão. Ninguém pontua.`;
    } else {
      scores[r.winner] += r.points;
      text = `Ninguém tem jogada. Você tem ${r.totals[0]} pontos na mão e a IA ${r.totals[1]}. ${r.winner === 0 ? 'Você leva' : 'A IA leva'} ${r.points} pontos.`;
    }
  }
  nextStarter = r.winner;
  updateHud();

  const champion = scores[0] >= MATCH_TARGET ? 0 : scores[1] >= MATCH_TARGET ? 1 : null;
  if (champion !== null) {
    title = champion === 0 ? '🏆 Você venceu a partida!' : 'A IA venceu a partida.';
    text += ` Placar final: você ${scores[0]} × ${scores[1]} IA.`;
    openModal(title, text, 'Nova partida', () => newMatch());
  } else {
    openModal(title, text, 'Próxima rodada', () => newRound());
  }
}

function revealAiHand() {
  const hand = round.hands[1];
  hand.forEach((tile, i) => {
    const { x, z } = handPose(1, i, hand.length);
    void tweener.to(viewOf(tile.id).root, target(x, REST_Y, z, Math.PI / 2, false), { duration: 600, arc: 0.8, delay: i * 60 });
  });
}

function openModal(title: string, text: string, btn: string, onClick: () => void) {
  ui.modalTitle.textContent = title;
  ui.modalText.textContent = text;
  ui.modalBtn.textContent = btn;
  ui.modal.hidden = false;
  ui.game.inert = true;
  stage.controls.enabled = false;
  ui.modalBtn.focus();
  ui.modalBtn.onclick = () => {
    ui.game.inert = false;
    stage.controls.enabled = true;
    ui.menuBtn.focus();
    ui.modal.hidden = true;
    onClick();
  };
}

// ---------- Início ----------
async function newRound() {
  const token = session;
  if (!isCurrent(token)) return;
  roundNo++;
  clearGhosts();
  selected = hovered = null;
  const options = { starter: nextStarter, handSize };
  round = new DominoRound(options);
  layout.reset();
  busy = true;
  updateHud();

  // Todas as peças voltam para o monte, viradas; depois são distribuídas.
  playGatheringSound();
  const all = [...round.hands[0], ...round.hands[1], ...round.boneyard];
  await Promise.all(
    all.map((tile, i) => {
      const v = viewOf(tile.id);
      v.bodyMaterial.emissiveIntensity = 0;
      return tweener.to(v.root, target(12 + (i % 4) * 0.08, REST_Y + i * 0.02, 0, 0.3 * (i % 3), true), {
        duration: 500,
        arc: 1.2,
        delay: i * 12,
      });
    }),
  );
  if (!isCurrent(token)) return;
  setStatus('Embaralhando e distribuindo…');
  await sleep(250);
  if (!isCurrent(token)) return;
  await arrangeHands(650);
  if (!isCurrent(token)) return;
  const starter = round.turn === 0 ? 'Você começa' : 'A IA começa';
  setStatus(round.forcedOpening ? `${starter} com a maior peça.` : `${starter} (ganhou a rodada anterior).`);
  await sleep(900);
  if (!isCurrent(token)) return;
  busy = false;
  void step();
}

function newMatch() {
  scores = [0, 0];
  roundNo = 0;
  nextStarter = null;
  void newRound();
}

// ---------- Entrada do jogador ----------
function pickHandTile(ev: PointerEvent): TileView | null {
  const rect = stage.renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, stage.camera);
  const legal = legalIds();
  const bodies = round.hands[0].filter((t) => legal.has(t.id)).map((t) => viewOf(t.id).body);
  const hit = raycaster.intersectObjects(bodies, false)[0];
  return hit ? viewOf(hit.object.userData.tileId as number) : null;
}

function pickGhost(ev: PointerEvent): Move | null {
  if (!ghosts.length) return null;
  const rect = stage.renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, stage.camera);
  const hit = raycaster.intersectObjects(
    ghosts.map((g) => g.mesh),
    false,
  )[0];
  return hit ? ghosts.find((g) => g.mesh === hit.object)!.move : null;
}

function clearGhosts() {
  for (const g of ghosts) stage.scene.remove(g.mesh);
  ghosts.length = 0;
}

function showGhosts(moves: Move[]) {
  clearGhosts();
  for (const move of moves) {
    const pose = layout.preview(placedFor(move));
    const mesh = new THREE.Mesh(ghostGeo, ghostMat);
    mesh.position.set(pose.x, 0.04, pose.z);
    mesh.rotation.y = pose.yaw;
    stage.scene.add(mesh);
    ghosts.push({ mesh, move });
  }
}

function canAct() {
  return !inMenu && !busy && round && !round.isOver && round.turn === 0 && ui.modal.hidden;
}

let downAt: { x: number; y: number } | null = null;
const canvas = stage.renderer.domElement;
canvas.addEventListener('pointerdown', (ev) => (downAt = { x: ev.clientX, y: ev.clientY }));
canvas.addEventListener('pointerup', (ev) => {
  // Arrastar gira a câmera; só conta como clique se o mouse quase não andou.
  if (!downAt || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 6) return;
  downAt = null;
  if (!canAct()) return;

  const ghostMove = pickGhost(ev);
  if (ghostMove) return void doMove(ghostMove);

  const v = pickHandTile(ev);
  if (!v) {
    if (selected) {
      selected = null;
      clearGhosts();
      setStatus('Sua vez: clique em uma peça destacada.');
      void arrangeHands(250);
    }
    return;
  }
  const moves = round.legalMoves(0).filter((m) => m.tile.id === v.tile.id);
  if (moves.length === 1) return void doMove(moves[0]!);
  selected = v;
  showGhosts(moves);
  setStatus('Essa peça serve nas duas pontas: clique onde quer jogar.');
  void arrangeHands(250);
});

canvas.addEventListener('pointermove', (ev) => {
  if (!canAct()) {
    document.body.classList.remove('pointer');
    return;
  }
  const v = pickHandTile(ev);
  const overGhost = !!pickGhost(ev);
  document.body.classList.toggle('pointer', !!v || overGhost);
  for (const g of ghosts) (g.mesh.material as THREE.MeshBasicMaterial).opacity = 0.28;
  if (v !== hovered) {
    hovered = v;
    void arrangeHands(180);
  }
});

ui.btnDraw.addEventListener('click', async () => {
  if (!canAct() || !round.canDraw()) return;
  const token = session;
  await doDraw();
  if (isCurrent(token)) void step();
});

ui.btnPass.addEventListener('click', () => {
  if (!canAct() || !round.canPass()) return;
  round.pass();
  setStatus('Você passou a vez.');
  void step();
});

// ---------- Montagem ----------
function buildViews() {
  // Uma peça visual para cada uma das 28 (ids estáveis entre rodadas).
  for (const tile of createSet()) {
    const v = createTileView(tile);
    v.root.position.set(12, REST_Y, 0);
    v.root.quaternion.copy(target(0, 0, 0, 0, true).quaternion);
    stage.scene.add(v.root);
    views.set(tile.id, v);
  }
}

buildViews();

function frame(now: number) {
  if (!inMenu) {
    tweener.update(now);
    if (stage.controls.enabled) stage.controls.update();
    stage.renderer.render(stage.scene, stage.camera);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Ganchos para testes automatizados no navegador.
(window as unknown as { domino: unknown }).domino = {
  get round() {
    return round;
  },
  play: (tileId: number, side: Side) => {
    if (!canAct()) return;
    const m = round.legalMoves(0).find((x) => x.tile.id === tileId && x.side === side);
    if (m && canAct()) void doMove(m);
  },
};

function showMenu() {
  stopGatheringSound();
  ++session;
  inMenu = true;
  busy = false;
  // Resolve and stop every old tween; continuations are rejected by their token.
  for (const v of views.values()) {
    void tweener.to(v.root, { position: v.root.position.clone(), quaternion: v.root.quaternion.clone() }, { duration: 1 });
    v.root.visible = false;
  }
  tweener.update(performance.now() + 2);
  tweener = new Tweener();
  clearGhosts();
  selected = hovered = null;
  downAt = null;
  document.body.classList.remove('pointer');
  ui.modal.hidden = true;
  ui.modalBtn.onclick = null;
  ui.game.hidden = true;
  ui.game.inert = true;
  stage.controls.enabled = false;
  ui.menu.hidden = false;
  ui.menuForm.querySelector<HTMLInputElement>('input:checked')?.focus();
}

ui.menuForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = Number(new FormData(ui.menuForm).get('mode'));
  if (value !== 3 && value !== 5 && value !== 7) return;
  const theme = themeMenu.current();
  stage.setTheme(theme);
  for (const v of views.values()) {
    v.setTheme(theme);
  }
  handSize = value;
  ++session;
  inMenu = false;
  ui.mode.textContent = `${modeNames[handSize]} · ${handSize} pedras`;
  ui.menu.hidden = true;
  ui.game.hidden = false;
  ui.game.inert = false;
  stage.controls.enabled = true;
  for (const v of views.values()) v.root.visible = true;
  stage.resize();
  ui.menuBtn.focus();
  newMatch();
});
ui.menuBtn.addEventListener('click', showMenu);
ui.modalMenu.addEventListener('click', showMenu);
// Native radios provide arrow-key selection. Keep dialog focus inside its controls.
ui.modal.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const controls = [...ui.modal.querySelectorAll<HTMLElement>('button, a[href]')];
  const first = controls[0]!;
  const last = controls[controls.length - 1]!;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
showMenu();
