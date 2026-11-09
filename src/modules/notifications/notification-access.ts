/**
 * O que cada perfil vê na interface de notificações. É só exibição: o backend autoriza cada chamada e devolve 403 a quem não
 * pode, mesmo que um controle apareça por engano.
 *
 * ADMIN: tudo, e é o único que altera configuração. PMO: consulta tudo (exceto a auditoria de configuração).
 * Demais perfis: apenas as próprias notificações.
 */
export type NotificationAccess = {
  /** Aba "Todas as notificações" e telas de administração em leitura. */
  canViewAll: boolean;
  /** Ativação, destinatários, ocorrências. */
  canManage: boolean;
  /** Histórico de alterações da configuração. */
  canViewConfigAudit: boolean;
};

export function notificationAccess(role: string | null | undefined): NotificationAccess {
  return {
    canViewAll: role === "ADMIN" || role === "PMO",
    canManage: role === "ADMIN",
    canViewConfigAudit: role === "ADMIN",
  };
}
