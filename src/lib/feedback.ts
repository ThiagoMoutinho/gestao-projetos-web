import { toast } from "sonner";

import { ApiError } from "@/lib/api/fetcher";

export function notifySuccess(message: string) {
  toast.success(message, { id: message });
}

export function notifyWarning(message: string, description: string) {
  toast.warning(message, { id: message, description, closeButton: true });
}

/** Alerta de erro (validação ou regra de negócio) no toast do shadcn (Sonner). */
export function notifyError(message: string, description?: string) {
  toast.error(message, { id: message, description, closeButton: true });
}

/** Substitui o estado de erro dos formulários: uma mensagem vira toast; null (limpar) não faz nada. */
export function showAlert(message: string | null) {
  if (message) {
    notifyError(message);
  }
}

/**
 * Toda falha vira toast. Erros de regra de negócio (4xx) mostram a mensagem da API; falhas de conexão
 * ou do servidor mostram a mensagem padrão. Retorna null: os formulários não exibem mais o erro em linha.
 */
export function reportFailure(error: unknown, fallback: string): null {
  if (error instanceof ApiError && error.status < 500) {
    notifyError(error.message);
    return null;
  }
  notifyError(fallback, "Verifique a conexão e tente novamente.");
  return null;
}
