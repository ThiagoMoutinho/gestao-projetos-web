/**
 * Valor de um campo de texto pronto para exibir, ou `null` quando ele não tem conteúdo útil: vazio, só espaços,
 * só símbolos soltos (por exemplo "-", "\\" ou "."), ou um único caractere. Só afeta a exibição; o dado gravado não muda.
 * O chamador mostra "Não informado" no lugar.
 */
export function meaningfulText(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  const useful = text.replace(/[^\p{L}\p{N}]/gu, "");
  return useful.length >= 2 ? text : null;
}
