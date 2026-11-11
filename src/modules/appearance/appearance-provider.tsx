"use client";

import { useTheme } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  parsePalette,
  parseTheme,
  readAppearance,
  writeAppearance,
  type PaletteId,
  type ThemeId,
} from "./appearance";

type AppearanceContextValue = {
  theme: ThemeId;
  palette: PaletteId;
  setTheme: (theme: ThemeId) => void;
  setPalette: (palette: PaletteId) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** Liga a classe de transição só durante a troca (CSS em globals.css), para a mudança de cores ser suave. */
let transitionTimer: number | undefined;
function animateChange() {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 350);
}

/** A paleta vive no atributo data-palette do <html> (aplicado antes da hidratação); este mini-store avisa o React quando muda. */
const paletteListeners = new Set<() => void>();
function subscribePalette(listener: () => void) {
  paletteListeners.add(listener);
  return () => {
    paletteListeners.delete(listener);
  };
}
function readPalette(): PaletteId {
  return parsePalette(document.documentElement.getAttribute("data-palette")) ?? DEFAULT_PALETTE;
}
function applyPalette(palette: PaletteId) {
  document.documentElement.setAttribute("data-palette", palette);
  paletteListeners.forEach((listener) => listener());
}

/**
 * Tema (via next-themes, que aplica a classe `dark`) e paleta (atributo `data-palette` no <html>) de um usuário.
 * A preferência é individual (chave por usuário) e persistente. Hoje fica no navegador; para sincronizar entre
 * dispositivos, basta trocar a leitura/gravação por um campo do perfil na API.
 */
export function AppearanceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { theme: activeTheme, setTheme: applyTheme } = useTheme();
  const palette = useSyncExternalStore(subscribePalette, readPalette, () => DEFAULT_PALETTE);

  // Ao montar: aplica a preferência do usuário; sem preferência salva, mantém o que o dispositivo já usava.
  useEffect(() => {
    let stored: ReturnType<typeof readAppearance> = {};
    try {
      stored = readAppearance(window.localStorage, userId);
    } catch {
      stored = {};
    }
    if (stored.palette) {
      applyPalette(stored.palette);
    }
    if (stored.theme) {
      applyTheme(stored.theme);
    }
  }, [userId, applyTheme]);

  const theme = parseTheme(activeTheme) ?? DEFAULT_THEME;

  const persist = useCallback(
    (next: { theme: ThemeId; palette: PaletteId }) => {
      try {
        writeAppearance(window.localStorage, userId, next);
      } catch {
        // sem armazenamento: vale só nesta sessão
      }
    },
    [userId],
  );

  const setPalette = useCallback(
    (next: PaletteId) => {
      animateChange();
      applyPalette(next);
      persist({ theme, palette: next });
    },
    [persist, theme],
  );

  const setTheme = useCallback(
    (next: ThemeId) => {
      animateChange();
      applyTheme(next);
      persist({ theme: next, palette });
    },
    [applyTheme, persist, palette],
  );

  const value = useMemo(() => ({ theme, palette, setTheme, setPalette }), [theme, palette, setTheme, setPalette]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance deve ser usado dentro de AppearanceProvider.");
  }
  return context;
}
