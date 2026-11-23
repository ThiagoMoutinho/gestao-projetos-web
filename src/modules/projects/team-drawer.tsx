"use client";

import { Briefcase, Check, ClipboardList, CodeXml, Copy, Crown, Eye, Mail, Tag, UserCog, Users, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ProjectMemberView } from "./eap-present";
import { DrawerChip } from "./overview-detail-drawer";
import { PersonAvatar } from "./planning-overview";

type RoleVisual = { icon: LucideIcon; tone: string };

/** Ícone e tom de cada papel (só tokens do sistema). */
const ROLE_VISUAL: Record<string, RoleVisual> = {
  DONO_PROJETO: { icon: Crown, tone: "bg-status-validation-soft text-status-validation-ink" },
  GESTOR: { icon: UserCog, tone: "bg-primary/10 text-primary" },
  RESPONSAVEL_TECNICO: { icon: Wrench, tone: "bg-status-running-soft text-status-running-ink" },
  FORNECEDOR: { icon: Briefcase, tone: "bg-status-done-soft text-status-done-ink" },
  PO: { icon: ClipboardList, tone: "bg-status-attention-soft text-status-attention-ink" },
  DESENVOLVEDOR: { icon: CodeXml, tone: "bg-muted text-muted-foreground" },
  OBSERVADOR: { icon: Eye, tone: "bg-muted text-muted-foreground" },
};
const FUNCTION_VISUAL: RoleVisual = { icon: Tag, tone: "bg-muted text-muted-foreground" };
const ROLE_RANK = ["DONO_PROJETO", "GESTOR", "RESPONSAVEL_TECNICO", "FORNECEDOR", "PO", "DESENVOLVEDOR", "OBSERVADOR"];

type RoleTag = { key: string; label: string; visual: RoleVisual; rank: number };
type Person = { userId: string; name: string; email: string; roles: RoleTag[] };

function tagOf(member: ProjectMemberView): RoleTag {
  if (member.functionId) {
    return { key: `fn:${member.functionId}`, label: member.roleLabel, visual: FUNCTION_VISUAL, rank: ROLE_RANK.length };
  }
  const visual = ROLE_VISUAL[member.role] ?? ROLE_VISUAL.OBSERVADOR;
  const rank = ROLE_RANK.indexOf(member.role);
  return { key: member.role, label: member.roleLabel, visual, rank: rank === -1 ? ROLE_RANK.length : rank };
}

/** Uma linha por pessoa, com todos os papéis dela (a mesma pessoa pode ser, por exemplo, dona e gestora), ordenada pelo papel mais alto e pelo nome. */
function groupPeople(members: ProjectMemberView[]): Person[] {
  const byUser = new Map<string, Person>();
  for (const member of members) {
    const person = byUser.get(member.userId) ?? { userId: member.userId, name: member.name, email: member.email, roles: [] };
    const tag = tagOf(member);
    if (!person.roles.some((role) => role.key === tag.key)) person.roles.push(tag);
    byUser.set(member.userId, person);
  }
  const people = [...byUser.values()];
  people.forEach((person) => person.roles.sort((a, b) => a.rank - b.rank));
  return people.sort((a, b) => a.roles[0].rank - b.roles[0].rank || a.name.localeCompare(b.name, "pt-BR"));
}

/** Copia o e-mail e confirma por 2 s no próprio botão (o rótulo acessível também muda). */
function CopyEmail({ email, name }: { email: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? `E-mail de ${name} copiado` : `Copiar e-mail de ${name}`}
      title={copied ? "Copiado" : "Copiar e-mail"}
      className={cn("size-8 shrink-0 text-muted-foreground", copied && "text-status-done-ink")}
      onClick={() => {
        void navigator.clipboard?.writeText(email).then(() => {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}

function RoleBadges({ roles, className }: { roles: RoleTag[]; className?: string }) {
  return (
    <ul aria-label="Papéis no projeto" className={cn("flex flex-wrap gap-1.5", className)}>
      {roles.map((role) => {
        const Icon = role.visual.icon;
        return (
          <li key={role.key} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-medium whitespace-nowrap", role.visual.tone)}>
            <Icon className="size-3.5" aria-hidden="true" />
            {role.label}
          </li>
        );
      })}
    </ul>
  );
}

function PersonRow({ person }: { person: Person }) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
      <PersonAvatar name={person.name} className="size-10 text-xs" />
      <div className="min-w-[10rem] flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground" title={person.email}>
          <Mail className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{person.email}</span>
        </p>
      </div>
      <RoleBadges roles={person.roles} className="max-sm:order-last max-sm:ml-[3.25rem] sm:max-w-[48%] sm:justify-end" />
      <CopyEmail email={person.email} name={person.name} />
    </li>
  );
}

/**
 * Equipe do projeto, em versão simples: um contador discreto e uma lista com uma linha por pessoa (avatar, nome, e-mail e todos
 * os papéis dela como selos com ícone), com a ação de copiar o e-mail. Sem busca, filtros nem outras ações.
 */
export function TeamDrawerContent({ members }: { members: ProjectMemberView[] }) {
  const people = useMemo(() => groupPeople(members), [members]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <DrawerChip icon={Users}>
          <span className="font-semibold text-foreground">{people.length}</span> {people.length === 1 ? "participante" : "participantes"}
        </DrawerChip>
      </div>
      <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card dark:divide-border dark:border-border">
        {people.map((person) => (
          <PersonRow key={person.userId} person={person} />
        ))}
      </ul>
    </div>
  );
}
