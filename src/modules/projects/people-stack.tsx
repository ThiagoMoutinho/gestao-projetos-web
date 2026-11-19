"use client";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { avatarColorIndex, ownerInitials } from "./project-portfolio";

/** Paleta suave de 8 cores para os avatares da equipe (fundo claro + iniciais escuras, contraste acima de 4,5:1). A cor vem só do ID da pessoa. */
export const AVATAR_PALETTE = [
  "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100",
  "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100",
  "bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100",
  "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
] as const;

export type StackPerson = { id: string; name: string; /** Função da pessoa neste item, mostrada no tooltip. */ detail: string };

/**
 * Pessoas em avatares sobrepostos (até 3, +N para o restante), no padrão da coluna Equipe da lista de projetos: a cor vem
 * só do identificador da pessoa e o tooltip lista nome e função. Também é acessível por teclado e por leitor de tela.
 */
export function PeopleStack({ people, label, max = 3 }: { people: ReadonlyArray<StackPerson>; label: string; max?: number }) {
  const visible = people.slice(0, max);
  const extra = Math.max(0, people.length - max);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${label}: ${people.map((person) => `${person.name} (${person.detail})`).join(", ")}`}
            className="inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none"
          />
        }
      >
        <AvatarGroup className="-space-x-1">
          {visible.map((person) => (
            <Avatar key={person.id}>
              <AvatarFallback className={cn("text-label font-semibold", AVATAR_PALETTE[avatarColorIndex(person.id, AVATAR_PALETTE.length)])}>
                {ownerInitials(person.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {extra > 0 ? <AvatarGroupCount className="bg-muted text-label text-muted-foreground">+{extra}</AvatarGroupCount> : null}
        </AvatarGroup>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="flex-col items-start gap-1">
        {people.map((person) => (
          <span key={person.id}>
            <span className="font-medium">{person.name}</span>
            <span className="opacity-80"> · {person.detail}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
