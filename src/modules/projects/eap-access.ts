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

export function canReviewMilestone(access: EapAccess, deliveredById: string | null) {
  return access.canManageStructure && deliveredById !== access.userId;
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
