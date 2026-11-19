/**
 * Preferências de aparência (tema e paleta). Funções puras, sem React, para testar e para trocar o
 * armazenamento depois (hoje o navegador; no futuro um campo do perfil do usuário na API).
 */

/** Três aparências independentes: o Padrão IGEPPS não é só outro nome do tema claro. */
export const THEME_IDS = ["igepps", "light", "dark"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const PALETTE_IDS = ["institucional", "petroleo", "violeta", "esmeralda", "rosa", "grafite", "azulvidro"] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export const DEFAULT_THEME: ThemeId = "igepps";
export const DEFAULT_PALETTE: PaletteId = "institucional";

export const PALETTES: ReadonlyArray<{ id: PaletteId; label: string }> = [
  { id: "institucional", label: "Azul institucional" },
  { id: "azulvidro", label: "Azul institucional vidro" },
  { id: "petroleo", label: "Azul petróleo" },
  { id: "violeta", label: "Violeta" },
  { id: "esmeralda", label: "Esmeralda" },
  { id: "rosa", label: "Rosa" },
  { id: "grafite", label: "Grafite vidro" },
];

/**
 * Paletas que o usuário pode escolher em Claro e Escuro. A institucional não é mais uma opção do seletor: ela continua
 * existindo só como a paleta fixa do Padrão IGEPPS (e como valor antigo guardado no dispositivo, que vale como Azul institucional vidro).
 */
export const SELECTABLE_PALETTES: ReadonlyArray<{ id: PaletteId; label: string }> = PALETTES.filter((item) => item.id !== "institucional");

/** Paleta aplicada no lugar da institucional quando o tema é Claro ou Escuro. */
export const FALLBACK_PALETTE: PaletteId = "azulvidro";

export const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: "igepps", label: "Padrão IGEPPS" },
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
];

/**
 * O Padrão IGEPPS usa só as cores do instituto (azul institucional): a troca de paleta fica desativada nele e só as
 * aparências Claro e Escuro aceitam outra paleta. A escolha do usuário continua guardada e volta ao sair do Padrão IGEPPS.
 */
export function paletteLockedFor(theme: ThemeId): boolean {
  return theme === "igepps";
}

/** Paleta que realmente vale na tela: a institucional no Padrão IGEPPS; nas demais aparências, a escolhida. */
export function effectivePalette(theme: ThemeId, chosen: PaletteId): PaletteId {
  if (paletteLockedFor(theme)) {
    return DEFAULT_PALETTE;
  }
  return chosen === DEFAULT_PALETTE ? FALLBACK_PALETTE : chosen;
}

/** Última paleta escolhida neste dispositivo; lida por um script antes da hidratação para evitar piscar. */
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

/**
 * Script executado antes da hidratação: aplica ao <html> a última paleta do dispositivo, exceto no Padrão IGEPPS
 * (tema salvo pelo next-themes na chave "theme"; sem valor salvo vale o padrão), que usa sempre a institucional.
 */
export function paletteBootstrapScript() {
  const ids = JSON.stringify(PALETTE_IDS);
  return `try{var t=localStorage.getItem("theme")||${JSON.stringify(DEFAULT_THEME)};var p=t==="igepps"?${JSON.stringify(DEFAULT_PALETTE)}:localStorage.getItem(${JSON.stringify(DEVICE_PALETTE_KEY)});if(p===${JSON.stringify(DEFAULT_PALETTE)}&&t!=="igepps")p=${JSON.stringify(FALLBACK_PALETTE)};if(p&&${ids}.indexOf(p)!==-1)document.documentElement.setAttribute("data-palette",p)}catch(e){}`;
}
