import type { GetProject200RolesItem } from "@/lib/api/generated/model/getProject200RolesItem";

const STRUCTURE_GLOBALS = new Set(["ADMIN", "PMO", "COORDENADOR"]);
const BLOCKED_STRUCTURE_GLOBALS = new Set(["FORNECEDOR", "COLABORADOR"]);
const MANAGEMENT_ROLES = new Set<GetProject200RolesItem>(["DONO_PROJETO", "GESTOR"]);
const EVIDENCE_ROLES = new Set<GetProject200RolesItem>([
  "DONO_PROJETO",
  "GESTOR",
  "PO",
  "DESENVOLVEDOR",
  "RESPONSAVEL_TECNICO",
  "FORNECEDOR",
]);
const CREATOR_ROLES = new Set<GetProject200RolesItem>([
  "DONO_PROJETO",
  "GESTOR",
  "PO",
  "RESPONSAVEL_TECNICO",
  "DESENVOLVEDOR",
  "FORNECEDOR",
]);

export type EapAccess = {
  userId: string;
  globalRole: string;
  memberRoles: readonly GetProject200RolesItem[];
  linked: boolean;
  /** Dono do projeto ou participante com DONO_PROJETO/GESTOR. */
  isProjectManager: boolean;
  canManageStructure: boolean;
  canCreateItems: boolean;
  canRegisterEvidence: boolean;
  canDeliverMilestone: boolean;
};

export function buildEapAccess(input: {
  userId: string;
  globalRole: string;
  ownerId: string;
  memberRoles: readonly GetProject200RolesItem[];
}): EapAccess {
  const canManageStructure = canManage(input);
  const linked =
    STRUCTURE_GLOBALS.has(input.globalRole) ||
    input.userId === input.ownerId ||
    input.memberRoles.length > 0;

  return {
    userId: input.userId,
    globalRole: input.globalRole,
    memberRoles: input.memberRoles,
    linked,
    isProjectManager:
      input.userId === input.ownerId || input.memberRoles.some((role) => MANAGEMENT_ROLES.has(role)),
    canManageStructure,
    canCreateItems:
      STRUCTURE_GLOBALS.has(input.globalRole) ||
      input.userId === input.ownerId ||
      input.memberRoles.some((role) => CREATOR_ROLES.has(role)),
    canRegisterEvidence:
      linked &&
      (STRUCTURE_GLOBALS.has(input.globalRole) ||
        input.userId === input.ownerId ||
        input.memberRoles.some((role) => EVIDENCE_ROLES.has(role))),
    canDeliverMilestone:
      canManageStructure ||
      (linked &&
        (input.globalRole === "FORNECEDOR" || input.memberRoles.includes("FORNECEDOR"))),
  };
}

export function canEditItem(access: EapAccess, createdBy: string) {
  return access.canManageStructure || (access.canCreateItems && createdBy === access.userId);
}

export function canUpdateTaskProgress(access: EapAccess, task: { assigneeId: string | null; createdBy: string }) {
  if (canEditItem(access, task.createdBy)) {
    return true;
  }

  return access.linked && task.assigneeId != null && task.assigneeId === access.userId;
}

export function canRegisterEvidenceOn(
  access: EapAccess,
  parent: { assigneeId: string | null; createdBy: string },
) {
  return access.canRegisterEvidence || canUpdateTaskProgress(access, parent);
}

/** Espelha a política da API: o homologador designado ou, sem designação, o dono e a gestão vinculada; nunca quem entregou. */
export function canHomologateMilestone(
  access: EapAccess,
  milestone: { reviewerId: string | null; deliveredById: string | null },
) {
  if (actsAsSupplier(access) || milestone.deliveredById === access.userId) {
    return false;
  }

  if (milestone.reviewerId) {
    return milestone.reviewerId === access.userId;
  }

  return access.isProjectManager;
}

/** Espelha a política da API: ADMIN, PMO ou a gestão do projeto; COORDENADOR não reprograma. */
/** Encerramento formal (mesma regra da API): PMO, coordenação, administração ou a gestão do projeto. */
export function canCloseProject(access: EapAccess) {
  if (access.globalRole === "ADMIN" || access.globalRole === "PMO" || access.globalRole === "COORDENADOR") {
    return true;
  }

  return !BLOCKED_STRUCTURE_GLOBALS.has(access.globalRole) && access.isProjectManager;
}

export function canReschedule(access: EapAccess) {
  if (access.globalRole === "ADMIN" || access.globalRole === "PMO") {
    return true;
  }

  return !BLOCKED_STRUCTURE_GLOBALS.has(access.globalRole) && access.isProjectManager;
}

export function canAuthorizeResubmission(access: EapAccess) {
  if (access.globalRole === "ADMIN" || access.globalRole === "PMO") {
    return true;
  }

  return access.globalRole !== "FORNECEDOR" && access.isProjectManager;
}

function actsAsSupplier(access: EapAccess) {
  return access.globalRole === "FORNECEDOR" || access.memberRoles.includes("FORNECEDOR");
}

function canManage(input: {
  userId: string;
  globalRole: string;
  ownerId: string;
  memberRoles: readonly GetProject200RolesItem[];
}) {
  if (STRUCTURE_GLOBALS.has(input.globalRole)) {
    return true;
  }

  if (BLOCKED_STRUCTURE_GLOBALS.has(input.globalRole)) {
    return false;
  }

  return (
    input.userId === input.ownerId ||
    input.memberRoles.some((role) => MANAGEMENT_ROLES.has(role))
  );
}
