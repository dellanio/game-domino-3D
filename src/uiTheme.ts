import logoDefault from './assets/domino-3d-logo.png';
import logoBrasil from './assets/domino-brasil-logo.png';
import { DEFAULT_THEME, type ThemeId } from './theme';

export const THEME_STORAGE_KEY = 'domino-3d-theme';

export function readTheme(): ThemeId {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'brasil' ? 'brasil' : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Menu presentation only: no renderer or game state is touched here. */
export function setupThemeMenu(form: HTMLFormElement) {
  let theme = readTheme();
  const radios = form.querySelectorAll<HTMLInputElement>('input[name="theme"]');
  const apply = () => {
    const brasil = theme === 'brasil';
    document.body.dataset.theme = theme;
    for (const id of ['menu-logo', 'hud-logo']) {
      const logo = document.getElementById(id) as HTMLImageElement;
      logo.src = brasil ? logoBrasil : logoDefault;
      logo.alt = brasil ? 'Dominó 3D — Brasil Edition' : 'Dominó 3D';
    }
    document.getElementById('menu-context')!.textContent = brasil
      ? 'Uma mesa de praça, uma boa partida'
      : 'Sua próxima jogada começa aqui';
    for (const radio of radios) radio.checked = radio.value === theme;
  };
  form.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name !== 'theme' || (input.value !== 'default' && input.value !== 'brasil')) return;
    theme = input.value;
    apply();
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Private storage may be unavailable. */ }
  });
  apply();
  return { current: () => theme };
}
