/**
 * Preferências de aparência (tema e paleta). Funções puras, sem React, para testar e para trocar o
 * armazenamento depois (hoje o navegador; no futuro um campo do perfil do usuário na API).
 */

/** Três aparências independentes: o Padrão IGEPPS não é só outro nome do tema claro. */
export const THEME_IDS = ["igepps", "light", "dark"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const PALETTE_IDS = ["institucional", "petroleo", "violeta", "esmeralda"] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export const DEFAULT_THEME: ThemeId = "igepps";
export const DEFAULT_PALETTE: PaletteId = "institucional";

export const PALETTES: ReadonlyArray<{ id: PaletteId; label: string }> = [
  { id: "institucional", label: "Azul institucional" },
  { id: "petroleo", label: "Azul petróleo" },
  { id: "violeta", label: "Violeta" },
  { id: "esmeralda", label: "Esmeralda" },
];

export const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: "igepps", label: "Padrão IGEPPS" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
];

/** Última paleta aplicada neste dispositivo; lida por um script antes da hidratação para evitar piscar. */
export const DEVICE_PALETTE_KEY = "igepps:palette";

export type Appearance = { theme: ThemeId; palette: PaletteId };

/** Subconjunto de Storage usado aqui (facilita testes e a troca por outra origem de dados). */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export function parseTheme(value: unknown): ThemeId | null {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value) ? (value as ThemeId) : null;
}

export function parsePalette(value: unknown): PaletteId | null {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value) ? (value as PaletteId) : null;
}

/** Chave individual: cada usuário tem a própria preferência neste dispositivo. */
export function appearanceKey(userId: string) {
  return `igepps:appearance:${userId}`;
}

/** Lê a preferência do usuário; valores ausentes ou inválidos viram null (o chamador decide o padrão). */
export function readAppearance(store: KeyValueStore, userId: string): Partial<Appearance> {
  try {
    const raw = store.getItem(appearanceKey(userId));
    if (!raw) {
      return {};
    }
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) {
      return {};
    }
    const record = data as Record<string, unknown>;
    const theme = parseTheme(record.theme);
    const palette = parsePalette(record.palette);
    return { ...(theme ? { theme } : {}), ...(palette ? { palette } : {}) };
  } catch {
    return {};
  }
}

export function writeAppearance(store: KeyValueStore, userId: string, appearance: Appearance) {
  try {
    store.setItem(appearanceKey(userId), JSON.stringify(appearance));
    store.setItem(DEVICE_PALETTE_KEY, appearance.palette);
  } catch {
    // Armazenamento indisponível (modo privado, cota): a escolha vale só para a sessão atual.
  }
}

/** Script executado antes da hidratação: aplica a última paleta do dispositivo ao <html>. */
export function paletteBootstrapScript() {
  const ids = JSON.stringify(PALETTE_IDS);
  return `try{var p=localStorage.getItem(${JSON.stringify(DEVICE_PALETTE_KEY)});if(p&&${ids}.indexOf(p)!==-1)document.documentElement.setAttribute("data-palette",p)}catch(e){}`;
}
