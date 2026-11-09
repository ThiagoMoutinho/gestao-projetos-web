import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { notificationAccess } from "./notification-access.ts";

describe("acesso às notificações por perfil (exibição; o backend autoriza)", () => {
  it("ADMIN vê tudo e é o único que altera configuração e vê a auditoria", () => {
    assert.deepEqual(notificationAccess("ADMIN"), { canViewAll: true, canManage: true, canViewConfigAudit: true });
  });

  it("PMO consulta tudo, mas não altera configuração nem vê a auditoria de configuração", () => {
    assert.deepEqual(notificationAccess("PMO"), { canViewAll: true, canManage: false, canViewConfigAudit: false });
  });

  it("demais perfis e perfil ausente: somente as próprias notificações", () => {
    for (const role of ["COORDENADOR", "GESTOR", "FORNECEDOR", "COLABORADOR", "", null, undefined, "QUALQUER"]) {
      assert.deepEqual(notificationAccess(role), { canViewAll: false, canManage: false, canViewConfigAudit: false }, String(role));
    }
  });
});
