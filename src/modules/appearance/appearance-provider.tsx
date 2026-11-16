"use client";

import { useTheme } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  DEVICE_PALETTE_KEY,
  effectivePalette,
  paletteLockedFor,
  parsePalette,
  parseTheme,
  readAppearance,
  writeAppearance,
  type PaletteId,
  type ThemeId,
} from "./appearance";

type AppearanceContextValue = {
  theme: ThemeId;
  /** Paleta em uso na tela: a institucional no Padrão IGEPPS; nas outras aparências, a escolhida. */
  palette: PaletteId;
  /** No Padrão IGEPPS a paleta é fixa e a troca fica desativada. */
  paletteLocked: boolean;
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

/**
 * Paleta ESCOLHIDA pelo usuário (vale em Claro e Escuro). Fica em memória e no dispositivo; a paleta aplicada ao <html>
 * (atributo data-palette) é calculada a partir dela e do tema, porque o Padrão IGEPPS força a institucional.
 * Este mini-store avisa o React quando a escolha muda.
 */
let chosenPalette: PaletteId | null = null;
const paletteListeners = new Set<() => void>();
function subscribePalette(listener: () => void) {
  paletteListeners.add(listener);
  return () => {
    paletteListeners.delete(listener);
  };
}
function readPalette(): PaletteId {
  if (chosenPalette) {
    return chosenPalette;
  }
  try {
    return parsePalette(window.localStorage.getItem(DEVICE_PALETTE_KEY)) ?? DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}
function chooseStoredPalette(palette: PaletteId) {
  chosenPalette = palette;
  paletteListeners.forEach((listener) => listener());
}

/**
 * Tema (via next-themes, que aplica a classe `dark`) e paleta (atributo `data-palette` no <html>) de um usuário.
 * A preferência é individual (chave por usuário) e persistente. Hoje fica no navegador; para sincronizar entre
 * dispositivos, basta trocar a leitura/gravação por um campo do perfil na API.
 */
export function AppearanceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { theme: activeTheme, setTheme: applyTheme } = useTheme();
  const chosen = useSyncExternalStore(subscribePalette, readPalette, () => DEFAULT_PALETTE);

  // Ao montar: aplica a preferência do usuário; sem preferência salva, mantém o que o dispositivo já usava.
  useEffect(() => {
    let stored: ReturnType<typeof readAppearance> = {};
    try {
      stored = readAppearance(window.localStorage, userId);
    } catch {
      stored = {};
    }
    if (stored.palette) {
      chooseStoredPalette(stored.palette);
    }
    if (stored.theme) {
      applyTheme(stored.theme);
    }
  }, [userId, applyTheme]);

  const theme = parseTheme(activeTheme) ?? DEFAULT_THEME;
  const locked = paletteLockedFor(theme);
  const palette = effectivePalette(theme, chosen);

  // Aplica ao <html> a paleta que vale agora (institucional no Padrão IGEPPS).
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

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
      if (locked) {
        return;
      }
      animateChange();
      chooseStoredPalette(next);
      persist({ theme, palette: next });
    },
    [persist, theme, locked],
  );

  const setTheme = useCallback(
    (next: ThemeId) => {
      animateChange();
      applyTheme(next);
      persist({ theme: next, palette: chosen });
    },
    [applyTheme, persist, chosen],
  );

  const value = useMemo(
    () => ({ theme, palette, paletteLocked: locked, setTheme, setPalette }),
    [theme, palette, locked, setTheme, setPalette],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance deve ser usado dentro de AppearanceProvider.");
  }
  return context;
}
