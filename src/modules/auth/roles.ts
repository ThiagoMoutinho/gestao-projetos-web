const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  PMO: "PMO",
  COORDENADOR: "Coordenador",
  GESTOR: "Gestor",
  FORNECEDOR: "Fornecedor",
  COLABORADOR: "Colaborador",
};

export function roleLabel(role: string | null | undefined) {
  if (!role) {
    return "Não informado";
  }

  return ROLE_LABELS[role] ?? role;
}
