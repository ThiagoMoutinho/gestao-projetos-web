"use client";

import { ArrowLeft, FolderKanban } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

import type { ProjectDetail as ProjectDetailData } from "./load-project-detail";
import { buildEapAccess, type EapAccess } from "./eap-access";
import { ProjectOverview } from "./project-overview";
import { ProjectEap } from "./project-eap";
import { ProjectSchedule } from "./project-schedule";

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

  function openEapView() {
    router.push(`/projetos/${project.id}?aba=eap`);
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

  if (openEap) {
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
    <div className="motion-enter mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <ProjectOverview key={project.id} project={project} access={access} onOpenEap={openEapView} />
      <div id="cronograma" className="scroll-mt-6">
        <ProjectSchedule projectId={project.id} schedule={project.schedule} closed={project.status === "CONCLUIDO"} access={access} />
      </div>
      <ParticipantsSummary project={project} />
    </div>
  );
}

function ParticipantsSummary({ project }: { project: ProjectDetailData }) {
  const members = project.members;
  const names = (role: string) => {
    const found = [...new Set((members ?? []).filter((member) => member.role === role).map((member) => member.name))];
    return found.length > 0 ? found.join(", ") : "Não informado";
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2">
          <h2 className="text-sm font-medium">Participantes</h2>
          {members === null ? (
            <p className="text-xs text-muted-foreground">Não foi possível consultar os participantes.</p>
          ) : (
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <SummaryFact label="Gestor" value={names("GESTOR")} />
              <SummaryFact label="Fornecedor" value={names("FORNECEDOR")} />
              <SummaryFact label="Participantes" value={String(members.length)} />
            </dl>
          )}
        </div>
        {members !== null && members.length > 0 ? (
          <Dialog>
            <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Ver equipe completa</DialogTrigger>
            <DialogContent className="max-h-[80svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Equipe do projeto</DialogTitle>
                <DialogDescription>{members.length} participante(s) vinculados a este projeto.</DialogDescription>
              </DialogHeader>
              <ul className="flex flex-col divide-y">
                {members.map((member) => (
                  <li key={member.id} className="min-w-0 py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.roleLabel} · {member.email}
                    </p>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-semibold">{value}</dd>
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
