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

export type EapAccess = {
  userId: string;
  globalRole: string;
  memberRoles: readonly GetProject200RolesItem[];
  canManageStructure: boolean;
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
    canManageStructure,
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

export function canUpdateTaskProgress(access: EapAccess, assigneeId: string | null) {
  if (access.canManageStructure) {
    return true;
  }

  if (!assigneeId || assigneeId !== access.userId) {
    return false;
  }

  return (
    access.globalRole === "FORNECEDOR" ||
    access.memberRoles.includes("FORNECEDOR") ||
    access.memberRoles.includes("DESENVOLVEDOR")
  );
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
