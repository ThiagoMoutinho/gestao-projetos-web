"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageLoadError } from "@/components/page-load-error";
import { Button } from "@/components/ui/button";
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
  openMilestoneId,
  openSchedule = false,
}: {
  project: ProjectDetailData;
  actor: { userId: string; globalRole: string };
  openEap?: boolean;
  /** Marco a abrir já no painel da EAP (link "Abrir na EAP" do cartão Marcos e Homologações). */
  openMilestoneId?: string;
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

  // A entrada de uma página nova já é animada pelo PageTransition (template). Aqui só a TROCA de visão dentro da mesma
  // página (Visão Geral, EAP, Cronograma) anima; a visão inicial não, para as duas animações não se somarem.
  const view = openSchedule ? "cronograma" : openEap ? "eap" : "geral";
  const [lastView, setLastView] = useState(view);
  const [switched, setSwitched] = useState(false);
  if (view !== lastView) {
    setLastView(view);
    setSwitched(true);
  }
  const enter = switched ? "motion-enter" : "";

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
      <div className={cn(enter, "mx-auto flex w-full max-w-[90rem] flex-col gap-5")}>
        <ProjectCronograma key={project.id} project={project} access={access} onBack={() => router.push(`/projetos/${project.id}`)} onOpenEap={openEapView} onSaved={() => router.refresh()} />
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
        <div className={enter}>
          <ProjectEap
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            phases={project.phases}
            initialMilestoneId={openMilestoneId}
            access={access}
            people={people}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(enter, "mx-auto flex w-full max-w-[90rem] flex-col gap-5")}>
      <ProjectOverview key={project.id} project={project} access={access} onOpenEap={openEapView} />
    </div>
  );
}

export function ProjectAccessDenied({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <PageLoadError title="Acesso negado" description={message} />
    </div>
  );
}

export function ProjectDetailError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <PageLoadError title="Não foi possível carregar o projeto" message={message} />
    </div>
  );
}
