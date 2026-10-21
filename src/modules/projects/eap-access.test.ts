import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GetProject200RolesItem } from "@/lib/api/generated/model/getProject200RolesItem";

import {
  buildEapAccess,
  canEditItem,
  canRegisterEvidenceOn,
  canReviewMilestone,
  canUpdateTaskProgress,
} from "./eap-access.ts";

function access(globalRole: string, memberRoles: GetProject200RolesItem[] = [], userId = "user-1") {
  return buildEapAccess({ userId, globalRole, ownerId: "owner-1", memberRoles });
}

describe("acesso à EAP no frontend", () => {
  it("libera criação às funções de edição, independentemente do perfil global", () => {
    for (const role of ["DONO_PROJETO", "GESTOR", "PO", "RESPONSAVEL_TECNICO", "DESENVOLVEDOR", "FORNECEDOR"] as const) {
      assert.equal(access("COLABORADOR", [role]).canCreateItems, true, role);
      assert.equal(access("FORNECEDOR", [role]).canCreateItems, true, role);
    }
    assert.equal(access("PMO").canCreateItems, true);
    assert.equal(access("COLABORADOR", [], "owner-1").canCreateItems, true);
    assert.equal(access("GESTOR", ["OBSERVADOR"]).canCreateItems, false);
    assert.equal(access("COLABORADOR").canCreateItems, false);
  });

  it("libera edição só dos próprios itens para quem não gerencia", () => {
    const dev = access("COLABORADOR", ["DESENVOLVEDOR"], "dev-1");
    assert.equal(dev.canManageStructure, false);
    assert.equal(canEditItem(dev, "dev-1"), true);
    assert.equal(canEditItem(dev, "outro"), false);
    assert.equal(canEditItem(access("GESTOR", ["OBSERVADOR"], "obs-1"), "obs-1"), false);
    assert.equal(canEditItem(access("GESTOR", ["GESTOR"]), "outro"), true);
  });

  it("libera andamento e evidência ao responsável vinculado", () => {
    const observer = access("GESTOR", ["OBSERVADOR"], "obs-1");
    const task = { assigneeId: "obs-1", createdBy: "pmo-1" };
    assert.equal(canUpdateTaskProgress(observer, task), true);
    assert.equal(canRegisterEvidenceOn(observer, task), true);
    assert.equal(canUpdateTaskProgress(observer, { ...task, assigneeId: "outro" }), false);
    assert.equal(canRegisterEvidenceOn(observer, { assigneeId: null, createdBy: "pmo-1" }), false);
    assert.equal(canUpdateTaskProgress(access("COLABORADOR", [], "ex-1"), { assigneeId: "ex-1", createdBy: "pmo-1" }), false);
  });

  it("mantém a decisão de marco restrita à gestão e separada de quem entregou", () => {
    assert.equal(canReviewMilestone(access("PMO", [], "pmo-1"), "forn-1"), true);
    assert.equal(canReviewMilestone(access("PMO", [], "pmo-1"), "pmo-1"), false);
    assert.equal(canReviewMilestone(access("COLABORADOR", ["DESENVOLVEDOR"], "dev-1"), "forn-1"), false);
  });
});
