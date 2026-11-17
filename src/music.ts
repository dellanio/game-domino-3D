// Reprodução local; inicia somente após interação e respeita a preferência do jogador.
const toggle = document.getElementById('music-toggle') as HTMLButtonElement;
const status = document.getElementById('music-status')!;
const audio = new Audio(`${import.meta.env.BASE_URL}audio/backbay-lounge.mp3`);
const gatheringSound = new Audio(`${import.meta.env.BASE_URL}audio/som-inicial-2.mp3`);
gatheringSound.preload = 'auto';
gatheringSound.volume = 0.3;
audio.loop = true;
audio.preload = 'none';
let enabled = true;
let interacted = false;
let pending = false;
let effectContext: AudioContext | undefined;
let tileSound: AudioBuffer | undefined;
let tileSoundLoading: Promise<void> | undefined;
let musicVolume = 0.22;
try {
  enabled = localStorage.getItem('domino-music-enabled') !== 'false';
  const stored = localStorage.getItem('domino-music-volume');
  if (stored !== null && Number.isFinite(Number(stored))) musicVolume = Math.max(0, Math.min(100, Number(stored))) / 100;
} catch { /* O jogo também funciona sem armazenamento local. */ }
audio.volume = musicVolume;

// Impacto curto fornecido pelo usuário, carregado antes das jogadas.
function loadTileSound(ctx: AudioContext) {
  if (tileSound || tileSoundLoading) return;
  tileSoundLoading = (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/pedra-na-mesa-curto.mp3`);
      if (!response.ok) throw new Error('Áudio da pedra indisponível');
      tileSound = await ctx.decodeAudioData(await response.arrayBuffer());
    } catch {
      // Permite uma nova tentativa na próxima interação sem interromper a partida.
    } finally {
      tileSoundLoading = undefined;
    }
  })();
}

function unlockEffects() {
  if (!enabled) return;
  try {
    effectContext ??= new AudioContext();
    loadTileSound(effectContext);
    if (effectContext.state === 'suspended') void effectContext.resume().catch(() => {});
  } catch { /* Sem Web Audio, a partida continua normalmente. */ }
}

export function playTileSound() {
  if (!enabled || document.hidden || effectContext?.state !== 'running' || !tileSound) return;
  const ctx = effectContext;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = tileSound;
  const impact = ctx.createGain();
  impact.gain.value = 0.3;
  source.connect(impact).connect(ctx.destination);
  source.onended = () => { source.disconnect(); impact.disconnect(); };
  source.start(now);
}

export function stopGatheringSound() {
  gatheringSound.pause();
  gatheringSound.currentTime = 0;
}

export function playGatheringSound() {
  stopGatheringSound();
  if (!enabled || document.hidden) return;
  // Chamado no início do movimento, sem aguardar distribuição ou animação de pouso.
  void gatheringSound.play().catch(() => {});
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Preferência vale nesta sessão. */ }
}
function update() {
  toggle.setAttribute('aria-label', enabled ? 'Desligar som' : 'Ligar som');
  toggle.setAttribute('aria-pressed', String(enabled));
}
async function start() {
  if (!enabled || !interacted || document.hidden || pending || !audio.paused) return;
  pending = true;
  try {
    await audio.play();
    status.textContent = '';
    if (!enabled || document.hidden) audio.pause();
  } catch {
    status.textContent = 'Toque em Música para tentar reproduzir.';
  } finally { pending = false; }
}
toggle.addEventListener('click', () => {
  interacted = true;
  enabled = !enabled;
  save('domino-music-enabled', String(enabled));
  status.textContent = '';
  update();
  if (enabled) { unlockEffects(); void start(); }
  else {
    audio.pause();
    stopGatheringSound();
    if (effectContext?.state === 'running') void effectContext.suspend().catch(() => {});
  }
});
function activate(event: Event) {
  if ((event.target as Element | null)?.closest?.('.music-panel')) return;
  interacted = true;
  unlockEffects();
  void start();
}
document.addEventListener('pointerdown', activate);
document.addEventListener('keydown', activate);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.pause();
    stopGatheringSound();
  } else void start();
});
audio.addEventListener('error', () => { status.textContent = 'Música indisponível. Tente recarregar o jogo.'; });
update();
