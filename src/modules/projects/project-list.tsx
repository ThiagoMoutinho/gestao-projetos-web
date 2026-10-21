"use client";

import { FolderKanban, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

import type { ProjectListRow } from "./load-project-list";
import { projectStatusLabel, projectStatusVariant } from "./project-status";

export function ProjectList({ projects, eapPrompt = false }: { projects: ProjectListRow[]; eapPrompt?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ListProjects200DataItemStatus | "all">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const statuses = useMemo(() => {
    const present = new Set(projects.map((project) => project.status));

    return [...present].sort((left, right) =>
      projectStatusLabel(left).localeCompare(projectStatusLabel(right), "pt-BR"),
    );
  }, [projects]);
  const visible = projects.filter((project) => {
    const matchesName =
      normalizedQuery.length === 0 ||
      project.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    const matchesStatus = status === "all" || project.status === status;

    return matchesName && matchesStatus;
  });
  const filtering = normalizedQuery.length > 0 || status !== "all";

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Projetos</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length === 1 ? "1 projeto no seu acesso." : `${projects.length} projetos no seu acesso.`}
        </p>
        {eapPrompt ? (
          <p className="max-w-xl rounded-[7px] border border-[#d8e6f8] bg-[#f7faff] px-3 py-2 text-sm text-[#174f9e]">
            Selecione um projeto para abrir a Estrutura Analítica.
          </p>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <ProjectEmpty
          title="Nenhum projeto disponível"
          description="A consulta não retornou projetos para o seu acesso."
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-3">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar por nome"
                  aria-label="Pesquisar por nome do projeto"
                  className="bg-background pl-8"
                />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
                <FilterButton active={status === "all"} onClick={() => setStatus("all")}>
                  Todas
                </FilterButton>
                {statuses.map((item) => (
                  <FilterButton
                    key={item}
                    active={status === item}
                    onClick={() => setStatus(item)}
                  >
                    {projectStatusLabel(item)}
                  </FilterButton>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <ProjectEmpty
                title="Nenhum projeto encontrado"
                description="A pesquisa e o filtro não encontraram projetos nesta lista."
                action={
                  filtering ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                    >
                      Limpar pesquisa
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="hidden grid-cols-[minmax(0,1.5fr)_9rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Projeto</span>
                  <span>Situação</span>
                  <span>Responsável principal</span>
                  <span>Gestor</span>
                </div>
                <ul>
                  {visible.map((project) => (
                    <li key={project.id} className="border-b last:border-b-0">
                      <Link
                        href={`/projetos/${project.id}`}
                        className="grid gap-2 px-4 py-3 transition-colors duration-200 ease-out hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none motion-reduce:transition-none md:grid-cols-[minmax(0,1.5fr)_9rem_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-3"
                      >
                      <div className="min-w-0">
                        <p className="font-medium">{project.name}</p>
                        {project.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                          Situação
                        </span>
                        <Badge variant={projectStatusVariant(project.status)}>
                          {projectStatusLabel(project.status)}
                        </Badge>
                      </div>
                      <Field label="Responsável principal" value={personLabel(project.ownerName)} />
                      <Field label="Gestor" value={managersLabel(project.managers)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ProjectListError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Projetos</h1>
      </div>
      <ProjectEmpty title="Não foi possível consultar os projetos" description={message} />
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs text-muted-foreground md:hidden">{label}</span>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function personLabel(name: string | null) {
  return name ?? "Não foi possível consultar";
}

function managersLabel(names: string[] | null) {
  if (names === null) {
    return "Não foi possível consultar";
  }

  if (names.length === 0) {
    return "Não informado";
  }

  return names.join(", ");
}

function ProjectEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderKanban />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}
