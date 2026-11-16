// Reprodução local; inicia somente após interação e respeita a preferência do jogador.
const toggle = document.getElementById('music-toggle') as HTMLButtonElement;
const status = document.getElementById('music-status')!;
const audio = new Audio(`${import.meta.env.BASE_URL}audio/backbay-lounge.mp3`);
audio.loop = true;
audio.preload = 'none';
let enabled = true;
let interacted = false;
let pending = false;
let effectContext: AudioContext | undefined;
let musicVolume = 0.22;
try {
  enabled = localStorage.getItem('domino-music-enabled') !== 'false';
  const stored = localStorage.getItem('domino-music-volume');
  if (stored !== null && Number.isFinite(Number(stored))) musicVolume = Math.max(0, Math.min(100, Number(stored))) / 100;
} catch { /* O jogo também funciona sem armazenamento local. */ }
audio.volume = musicVolume;

// Impacto original sintetizado: estalo de resina e ressonância curta da mesa.
function unlockEffects() {
  if (!enabled) return;
  try {
    effectContext ??= new AudioContext();
    if (effectContext.state === 'suspended') void effectContext.resume().catch(() => {});
  } catch { /* Sem Web Audio, a partida continua normalmente. */ }
}

export function playTileSound() {
  if (!enabled || document.hidden || effectContext?.state !== 'running') return;
  const ctx = effectContext;
  const now = ctx.currentTime;
  const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.065), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1900 + Math.random() * 350;
  filter.Q.value = 0.65;
  const impact = ctx.createGain();
  impact.gain.setValueAtTime(0.0001, now);
  impact.gain.exponentialRampToValueAtTime(0.3, now + 0.002);
  impact.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  source.connect(filter).connect(impact).connect(ctx.destination);
  source.onended = () => { source.disconnect(); filter.disconnect(); impact.disconnect(); };
  source.start(now);
  source.stop(now + 0.07);
  const body = ctx.createOscillator();
  const resonance = ctx.createGain();
  body.frequency.setValueAtTime(310 + Math.random() * 25, now);
  body.frequency.exponentialRampToValueAtTime(145, now + 0.09);
  resonance.gain.setValueAtTime(0.0001, now);
  resonance.gain.exponentialRampToValueAtTime(0.18, now + 0.003);
  resonance.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  body.connect(resonance).connect(ctx.destination);
  body.onended = () => { body.disconnect(); resonance.disconnect(); };
  body.start(now);
  body.stop(now + 0.13);
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
  if (document.hidden) audio.pause(); else void start();
});
audio.addEventListener('error', () => { status.textContent = 'Música indisponível. Tente recarregar o jogo.'; });
update();
