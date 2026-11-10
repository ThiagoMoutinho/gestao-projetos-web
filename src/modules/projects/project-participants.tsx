"use client";

import type { ProjectDetail } from "./eap-present";
import { PlanningSection } from "./project-planning";

/** Nomes (sem repetição) de quem tem o papel no projeto; vazio vira "Não informado". */
function namesOf(members: NonNullable<ProjectDetail["members"]>, role: string) {
  const found = [...new Set(members.filter((member) => member.role === role).map((member) => member.name))];
  return found.length > 0 ? found.join(", ") : "Não informado";
}

/** Seção Participantes do cartão Planejamento: gestor, fornecedor e a equipe com a responsabilidade de cada pessoa. */
export function ProjectParticipants({ members }: { members: ProjectDetail["members"] }) {
  return (
    <PlanningSection
      title="Participantes"
      summary={
        members === null
          ? "Não foi possível consultar os participantes."
          : `Gestor: ${namesOf(members, "GESTOR")} · Fornecedor: ${namesOf(members, "FORNECEDOR")} · ${members.length} ${members.length === 1 ? "participante" : "participantes"}`
      }
    >
      {members === null ? (
        <p className="text-xs text-muted-foreground">Não foi possível consultar os participantes.</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum participante vinculado a este projeto.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border px-3">
          {members.map((member) => (
            <li key={member.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
              <span className="min-w-0 truncate text-xs font-semibold">{member.name}</span>
              <span className="text-xs text-muted-foreground">
                {member.roleLabel} · {member.email}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PlanningSection>
  );
}
