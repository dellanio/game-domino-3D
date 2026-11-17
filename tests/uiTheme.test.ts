import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTheme, setupThemeMenu, THEME_STORAGE_KEY } from '../src/uiTheme';

afterEach(() => vi.unstubAllGlobals());

describe('theme menu', () => {
  it('defaults safely for missing, invalid or inaccessible storage', () => {
    for (const value of [null, 'unknown', 'default']) {
      vi.stubGlobal('localStorage', { getItem: () => value });
      expect(readTheme()).toBe('default');
    }
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); } });
    expect(readTheme()).toBe('default');
  });

  it('previews, persists and restores both themes without submitting a game', () => {
    const storage = new Map<string, string>([[THEME_STORAGE_KEY, 'brasil']]);
    const setItem = vi.fn((key: string, value: string) => storage.set(key, value));
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem });
    const elements = Object.fromEntries(['menu-logo', 'hud-logo', 'menu-context'].map(id => [id, { src: '', alt: '', textContent: '' }]));
    const body = { dataset: { theme: '' } };
    vi.stubGlobal('document', { body, getElementById: (id: string) => elements[id] });
    const radios = [{ value: 'default', checked: true }, { value: 'brasil', checked: false }];
    let change!: (event: unknown) => void;
    const form = { querySelectorAll: () => radios, addEventListener: vi.fn((name, listener) => {
      expect(name).toBe('change');
      change = listener;
    }) };
    const menu = setupThemeMenu(form as unknown as HTMLFormElement);
    expect(menu.current()).toBe('brasil');
    expect(body.dataset.theme).toBe('brasil');
    expect(elements['menu-logo'].src).toContain('domino-brasil-logo');
    expect(elements['hud-logo'].alt).toContain('Brasil Edition');
    expect(radios.map(r => r.checked)).toEqual([false, true]);
    change({ target: { name: 'mode', value: '7' } });
    expect(menu.current()).toBe('brasil');
    change({ target: { name: 'theme', value: 'default' } });
    expect(body.dataset.theme).toBe('default');
    expect(elements['menu-logo'].src).toContain('domino-3d-logo');
    expect(elements['hud-logo'].src).toBe(elements['menu-logo'].src);
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'default');
    expect(readTheme()).toBe('default');
    // A refused write must still leave the selected presentation usable.
    setItem.mockImplementation(() => { throw Error('blocked'); });
    expect(() => change({ target: { name: 'theme', value: 'brasil' } })).not.toThrow();
    expect(menu.current()).toBe('brasil');
  });
});
