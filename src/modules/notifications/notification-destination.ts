/**
 * Para onde cada notificação leva. Só usa rotas que existem na aplicação: o projeto tem a Visão Geral em
 * `/projetos/[id]` (onde ficam o card do Resumo Executivo, a validação semanal e o histórico) e a EAP em `?aba=eap`.
 * Ainda não há rota, âncora ou parâmetro próprio para o resumo pendente nem para a pendência escalada, então os três
 * tipos levam à Visão Geral do projeto. Quando surgir um destino específico, basta trocar a entrada do tipo aqui.
 */
import type { NotificationKind } from "./notification-state.ts";

export const NOTIFICATION_DESTINATION: Record<NotificationKind, (projectId: string) => string> = {
  /** Prazo da validação: o resumo executivo que precisa ser validado está na Visão Geral. */
  PREVENTIVE: (projectId) => `/projetos/${encodeURIComponent(projectId)}`,
  /** Ciclo sem validação: o acompanhamento do resumo pendente está na Visão Geral. */
  OVERDUE: (projectId) => `/projetos/${encodeURIComponent(projectId)}`,
  /** Escalonamento: a pendência escalada é a mesma validação do resumo, na Visão Geral. */
  ESCALATION: (projectId) => `/projetos/${encodeURIComponent(projectId)}`,
};

export function notificationHref(item: { kind: NotificationKind; projectId: string }): string {
  return NOTIFICATION_DESTINATION[item.kind](item.projectId);
}

/** Só a entrega do próprio usuário ainda não lida precisa de leitura; "Todas" (sem entrega) e lidas não disparam nada. */
export function needsRead(item: { deliveryId: string | null; readAt: string | null }): boolean {
  return item.deliveryId !== null && item.readAt === null;
}

/** Clique simples com o botão principal. Ctrl/Cmd/Shift/Alt ou botão do meio ficam com o navegador (nova aba/janela). */
export function isPlainClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
