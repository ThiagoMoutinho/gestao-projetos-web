/** Protocolos aceitos em links dos textos narrativos. Qualquer outro (javascript:, data:, etc.) é descartado. */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Devolve a URL normalizada se for segura; senão `null`. Endereços sem protocolo (ex.: www.x.com) viram https. */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0 || /\s/.test(value)) {
    return null;
  }
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Tamanho real do Markdown que será persistido (é o que a API valida). */
export const markdownLength = (markdown: string) => markdown.trim().length;
