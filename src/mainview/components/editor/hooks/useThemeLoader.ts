import { useEffect } from 'react';

const STYLE_ID = 'milkdown-theme';

export function useThemeLoader(darkMode: boolean): void {
  useEffect(() => {
    const loadTheme = async () => {
      let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.appendChild(style);
      }

      try {
        if (darkMode) {
          // @ts-ignore
          const module = await import('@milkdown/crepe/theme/frame-dark.css?inline');
          style.textContent = module.default || '';
        } else {
          // @ts-ignore
          const module = await import('@milkdown/crepe/theme/frame.css?inline');
          style.textContent = module.default || '';
        }
      } catch (e) {
        console.error('Failed to load theme:', e);
      }
    };

    loadTheme();
  }, [darkMode]);
}
