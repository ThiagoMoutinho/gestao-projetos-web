import path from "node:path";

/** Arquivo da sessão criada pelo passo de autenticação (fora do versionamento). */
export const STORAGE_STATE = path.join(__dirname, ".auth", "user.json");
