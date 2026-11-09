"use client";

import { ArrowLeft, FolderKanban } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
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
import { ProjectCronograma } from "./project-cronograma";
import { ProjectOverview } from "./project-overview";
import { ProjectEap } from "./project-eap";

export function ProjectDetail({
  project,
  actor,
  openEap = false,
  openSchedule = false,
}: {
  project: ProjectDetailData;
  actor: { userId: string; globalRole: string };
  openEap?: boolean;
  openSchedule?: boolean;
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

  if (openSchedule) {
    return (
      <div className="motion-enter mx-auto flex w-full max-w-[90rem] flex-col gap-5">
        <ProjectCronograma key={project.id} project={project} onBack={() => router.push(`/projetos/${project.id}`)} onOpenEap={openEapView} />
      </div>
    );
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
