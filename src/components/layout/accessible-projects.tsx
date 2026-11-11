"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { listProjects } from "@/lib/api/generated/projetos/projetos";

export type AccessibleProject = { id: string; name: string; glpiTicketId: string | null };

type State = { projects: AccessibleProject[] | null; status: "loading" | "ready" | "error" };

const AccessibleProjectsContext = createContext<State>({ projects: null, status: "loading" });

/**
 * Projetos que o usuário pode acessar (a API aplica as permissões), consultados uma única vez e compartilhados
 * entre o menu lateral e a busca da barra superior. `projects` é null enquanto carrega ou se a consulta falhar.
 */
export function AccessibleProjectsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ projects: null, status: "loading" });

  useEffect(() => {
    let active = true;
    listProjects()
      .then((response) => {
        if (!active) {
          return;
        }
        if (response.status === 200) {
          setState({
            status: "ready",
            projects: response.data.data
              .map((project) => ({ id: project.id, name: project.name, glpiTicketId: project.glpiTicketId }))
              .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
          });
        } else {
          setState({ projects: null, status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setState({ projects: null, status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AccessibleProjectsContext.Provider value={value}>{children}</AccessibleProjectsContext.Provider>;
}

export function useAccessibleProjects() {
  return useContext(AccessibleProjectsContext);
}
