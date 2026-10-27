"use client";

import { ArrowLeft, FolderKanban } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { ProjectDetail as ProjectDetailData } from "./load-project-detail";
import { buildEapAccess, canCloseProject, type EapAccess } from "./eap-access";
import { ProjectClosure } from "./project-closure";
import { ProjectEap } from "./project-eap";
import { ProjectSchedule } from "./project-schedule";
import { projectStatusLabel, projectStatusVariant } from "./project-status";

const FUTURE_TABS = [
  {
    value: "pendencias",
    label: "Pendências",
    description: "A consulta de pendências ainda não está disponível.",
  },
  {
    value: "entregas",
    label: "Entregas e Homologações",
    description: "A consulta de entregas e homologações ainda não está disponível nesta tela.",
  },
  {
    value: "historico",
    label: "Histórico Executivo",
    description: "O histórico executivo ainda não está disponível.",
  },
  {
    value: "documentacao",
    label: "Documentação",
    description: "A consulta de documentação ainda não está disponível.",
  },
] as const;

export function ProjectDetail({
  project,
  actor,
  openEap = false,
}: {
  project: ProjectDetailData;
  actor: { userId: string; globalRole: string };
  openEap?: boolean;
}) {
  const access: EapAccess = buildEapAccess({
    userId: actor.userId,
    globalRole: actor.globalRole,
    ownerId: project.ownerId,
    memberRoles: project.memberRoles,
  });
  const members = project.members;
  const people = members
    ? [...new Map(members.map((member) => [member.userId, member.name])).entries()]
        .map(([userId, name]) => ({
          userId,
          name,
          homologator: !members.some((member) => member.userId === userId && member.role === "FORNECEDOR"),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
    : null;
  const router = useRouter();
  const [tab, setTab] = useState(openEap ? "eap" : "visao-geral");
  const [eapFromUrl, setEapFromUrl] = useState(openEap);
  const [animated, setAnimated] = useState(false);
  if (openEap !== eapFromUrl) {
    setEapFromUrl(openEap);
    setTab(openEap ? "eap" : "visao-geral");
  }
  const managers =
    project.managers === null
      ? "Não foi possível consultar"
      : project.managers.length === 0
        ? "Não informado"
        : project.managers.join(", ");

  useEffect(() => {
    window.sessionStorage.setItem("igepps.selectedProjectId", project.id);
  }, [project.id]);

  function selectTab(value: string) {
    setAnimated(true);
    setTab(value);
    const href = value === "eap" ? `/projetos/${project.id}?aba=eap` : `/projetos/${project.id}`;
    router.replace(href, { scroll: false });
  }

  function leaveEap() {
    const referrer = document.referrer;
    try {
      const url = new URL(referrer);
      const appropriate =
        url.origin === window.location.origin &&
        url.pathname !== window.location.pathname &&
        !url.pathname.startsWith("/login");
      if (appropriate) {
        router.back();
        return;
      }
    } catch {
      // Sem página anterior registrada.
    }
    router.push("/projetos");
  }

  if (tab === "eap") {
    return (
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4">
        <Button
          type="button"
          variant="ghost"
          className="w-fit gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          onClick={leaveEap}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Button>
        <div className="motion-enter">
          <ProjectEap
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            phases={project.phases}
            access={access}
            people={people}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/projetos"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Projetos
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{project.name}</h1>
            <p className="text-sm break-all text-muted-foreground">Identificador {project.id}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge variant={projectStatusVariant(project.status)}>{projectStatusLabel(project.status)}</Badge>
            <ProjectClosure projectId={project.id} closed={project.status === "CONCLUIDO"} canClose={canCloseProject(access)} />
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Responsável principal" value={project.ownerName} />
          <Fact label="Gestor" value={managers} />
        </dl>
      </div>

      <Tabs
        value={tab}
        onValueChange={selectTab}
      >
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="eap">EAP</TabsTrigger>
          {FUTURE_TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="visao-geral" className={cn("mt-4", animated && tab === "visao-geral" && "motion-enter")}>
          <Overview project={project} access={access} />
        </TabsContent>
        {FUTURE_TABS.map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            className={cn("mt-4", animated && tab === item.value && "motion-enter")}
          >
            <FutureSection description={item.description} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Overview({ project, access }: { project: ProjectDetailData; access: EapAccess }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
      <div id="cronograma" className="scroll-mt-6 lg:col-span-2">
        <ProjectSchedule projectId={project.id} schedule={project.schedule} closed={project.status === "CONCLUIDO"} access={access} />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <section className="space-y-1">
            <h2 className="text-sm font-medium">Descrição</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {project.description?.trim() || "Sem descrição registrada."}
            </p>
          </section>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact label="Situação" value={projectStatusLabel(project.status)} />
            <Fact label="Criado em" value={project.createdAt} />
            <Fact label="Atualizado em" value={project.updatedAt} />
            {project.glpiTicketId ? <Fact label="Chamado GLPI" value={project.glpiTicketId} /> : null}
            <Fact
              label="Seu papel no projeto"
              value={project.viewerRoles.length > 0 ? project.viewerRoles.join(", ") : "Não informado"}
            />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Participantes</h2>
          {project.members === null ? (
            <p className="text-sm text-muted-foreground">Não foi possível consultar os participantes.</p>
          ) : project.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum participante informado.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {project.members.map((member) => (
                <li key={member.id} className="min-w-0">
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.roleLabel} · {member.email}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FutureSection({ description }: { description: string }) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderKanban />
        </EmptyMedia>
        <EmptyTitle>Funcionalidade ainda não disponível</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function ProjectAccessDenied({ message }: { message: string }) {
  return (
    <ProjectNotice
      title="Acesso negado"
      description={message}
    />
  );
}

export function ProjectDetailError({ message }: { message: string }) {
  return <ProjectNotice title="Não foi possível consultar o projeto" description={message} />;
}

function ProjectNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanban />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <Link href="/projetos" className={cn(buttonVariants({ variant: "outline" }))}>
          Voltar para projetos
        </Link>
      </Empty>
    </div>
  );
}
