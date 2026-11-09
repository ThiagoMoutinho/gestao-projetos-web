/**
 * Escrito à mão, no formato do cliente gerado: `pnpm api:generate` substitui este arquivo.
 * Gestão de projetos API
 */

/**
 * Situação do prazo calculada sobre as datas vigentes; reprogramações não entram no cálculo.
 */
export type GetScheduleMonitoring200DeadlineSituation = {
  /** Nula em projeto suspenso. */
  status: 'CONCLUIDO' | 'ATRASADO' | 'EM_ATENCAO' | 'NO_PRAZO' | null;
  /** Falso quando não há compromisso datado: No prazo, nesse caso, não indica prazo validado. */
  hasDatedCommitments: boolean;
  /** Itens em atraso pela regra única, mais o prazo final do projeto, se vencido. */
  overdueCommitments: number;
  /** Compromissos com vencimento na janela de atenção e indicador objetivo de risco. */
  attentionItems: {
    entityType: 'TASK' | 'MILESTONE';
    entityId: string;
    reason: 'ACTIVE_IMPEDIMENT' | 'NOT_STARTED_AFTER_PLANNED_START';
  }[];
  /** Indicadores do critério sem registro no sistema: não foram avaliados. */
  unevaluatedIndicators: ('DEPENDENCIES' | 'FORMAL_RISKS')[];
};
