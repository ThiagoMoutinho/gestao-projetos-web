import { toast } from "sonner";

import { ApiError } from "@/lib/api/fetcher";

export function notifySuccess(message: string) {
  toast.success(message, { id: message, duration: 3000 });
}

export function notifyWarning(message: string, description: string) {
  toast.warning(message, { id: message, description, duration: 7000, closeButton: true });
}

/**
 * Falhas de conexão ou do servidor viram toast e retornam null.
 * Erros de regra de negócio (4xx) retornam a mensagem para exibição no formulário.
 */
export function reportFailure(error: unknown, fallback: string): string | null {
  if (error instanceof ApiError && error.status < 500) {
    return error.message;
  }
  toast.error(fallback, {
    id: fallback,
    description: "Verifique a conexão e tente novamente.",
    duration: 7000,
    closeButton: true,
  });
  return null;
}
