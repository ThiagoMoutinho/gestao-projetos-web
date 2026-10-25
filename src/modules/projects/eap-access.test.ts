import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GetProject200RolesItem } from "@/lib/api/generated/model/getProject200RolesItem";

import {
  buildEapAccess,
  canAuthorizeResubmission,
  canEditItem,
  canHomologateMilestone,
  canRegisterEvidenceOn,
  canReschedule,
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

  it("restringe a homologação à gestão vinculada ou ao designado, nunca a quem entregou", () => {
    const delivered = { reviewerId: null, deliveredById: "forn-1" };
    assert.equal(canHomologateMilestone(access("PMO", [], "pmo-1"), delivered), false);
    assert.equal(canHomologateMilestone(access("GESTOR", ["GESTOR"], "g-1"), delivered), true);
    assert.equal(canHomologateMilestone(access("COLABORADOR", [], "owner-1"), delivered), true);
    assert.equal(canHomologateMilestone(access("GESTOR", ["GESTOR"], "g-1"), { ...delivered, deliveredById: "g-1" }), false);
    assert.equal(canHomologateMilestone(access("GESTOR", ["GESTOR", "FORNECEDOR"], "g-1"), delivered), false);
    assert.equal(canHomologateMilestone(access("COLABORADOR", ["DESENVOLVEDOR"], "dev-1"), delivered), false);

    const designated = { reviewerId: "obs-1", deliveredById: "forn-1" };
    assert.equal(canHomologateMilestone(access("COLABORADOR", ["OBSERVADOR"], "obs-1"), designated), true);
    assert.equal(canHomologateMilestone(access("GESTOR", ["GESTOR"], "g-1"), designated), false);
  });

  it("libera a autorização de nova submissão ao PMO/ADMIN e à gestão do projeto", () => {
    assert.equal(canAuthorizeResubmission(access("PMO")), true);
    assert.equal(canAuthorizeResubmission(access("ADMIN")), true);
    assert.equal(canAuthorizeResubmission(access("GESTOR", ["GESTOR"])), true);
    assert.equal(canAuthorizeResubmission(access("COORDENADOR")), false);
    assert.equal(canAuthorizeResubmission(access("FORNECEDOR", ["FORNECEDOR"])), false);
  });

  it("libera a reprogramação de prazo só ao ADMIN, PMO e à gestão do projeto", () => {
    assert.equal(canReschedule(access("ADMIN")), true);
    assert.equal(canReschedule(access("PMO")), true);
    assert.equal(canReschedule(access("GESTOR", [], "owner-1")), true);
    assert.equal(canReschedule(access("GESTOR", ["DONO_PROJETO"])), true);
    assert.equal(canReschedule(access("COORDENADOR")), false);
    assert.equal(canReschedule(access("GESTOR")), false);
    assert.equal(canReschedule(access("GESTOR", ["PO"])), false);
    assert.equal(canReschedule(access("FORNECEDOR", ["GESTOR"])), false);
  });
});
