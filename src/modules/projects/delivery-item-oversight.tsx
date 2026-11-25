"use client";

import { ArrowRight, History, UserCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { assignDeliveryItemValidator, listDeliveryItemEvents } from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import type { ListDeliveryItemEvents200DataItem } from "@/lib/api/generated/model/listDeliveryItemEvents200DataItem";
import type { ListDeliveryVersions200DataItemItemsItem } from "@/lib/api/generated/model/listDeliveryVersions200DataItemItemsItem";
import type { ListProjectMembers200DataItemRole } from "@/lib/api/generated/model/listProjectMembers200DataItemRole";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/modules/auth/roles";

import { describeHistory, evidenceDisplay, type EvidenceKind, type Tone, type ValidatorCandidate, validatorInfo } from "./delivery-compliance";
import { personName, stamp, useAction } from "./institutional-shared";
import { projectRoleLabel } from "./project-records";

type Item = ListDeliveryVersions200DataItemItemsItem;
type Person = { id: string; name: string | null };
type Event = ListDeliveryItemEvents200DataItem;

/** Documento de uma versão: alvo do diálogo de validador e do painel de histórico. */
export type ItemTarget = { versionId: string; versionLabel: string; item: Item; defaults: Person[] };

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-status-done",
  warning: "bg-status-attention",
  danger: "bg-status-critical",
  info: "bg-primary",
};

function memberRole(role: string) {
  return projectRoleLabel(role as ListProjectMembers200DataItemRole) ?? role;
}

/** Linha "Validação" do documento: quem valida, de onde vem a designação e os atalhos para designar e ver o histórico. */
export function ValidatorLine({
  item,
  defaults,
  canAssign,
  onAssign,
  onHistory,
}: {
  item: Item;
  defaults: Person[];
  canAssign: boolean;
  onAssign: () => void;
  onHistory: () => void;
}) {
  const info = validatorInfo(item.validator, defaults);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <UserCheck aria-hidden="true" className="size-3.5 shrink-0" />
      {info.kind === "nenhum" ? (
        <span className="text-status-attention-ink">Sem validador: designe um responsável técnico.</span>
      ) : (
        <span>
          Validação: <span className="font-medium text-foreground">{info.names.join(", ")}</span>
          {info.kind === "marco" ? " · responsável técnico do marco de homologação" : " · designado para este documento"}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1">
        {canAssign ? (
          <Button type="button" size="xs" variant="ghost" onClick={onAssign}>
            <UserCog aria-hidden="true" /> {info.kind === "designado" ? "Alterar validador" : "Designar validador"}
          </Button>
        ) : null}
        <Button type="button" size="xs" variant="ghost" onClick={onHistory} aria-label={`Histórico do documento ${item.title}`}>
          <History aria-hidden="true" /> Histórico
        </Button>
      </span>
    </div>
  );
}

const NO_DESIGNATION = "__marco__";

/**
 * Designa, troca ou remove o validador do documento (gestão do projeto e PMO). A API confere a regra (participante do
 * projeto, nunca o fornecedor) e registra a troca na auditoria; quem enviou o documento nunca valida o próprio envio.
 */
export function ValidatorDialog({
  target,
  projectId,
  candidates,
  onClose,
  onDone,
}: {
  target: ItemTarget | null;
  projectId: string;
  candidates: ValidatorCandidate[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [last, setLast] = useState<ItemTarget | null>(null);
  const [selected, setSelected] = useState(NO_DESIGNATION);
  const { busy, run } = useAction(() => {
    onDone();
    onClose();
  });
  const current = target ?? last;

  useEffect(() => {
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia a escolha a cada abertura
      setLast(target);
      setSelected(target.item.validator?.id ?? NO_DESIGNATION);
    }
  }, [target]);

  if (!current) return null;
  const initial = current.item.validator?.id ?? NO_DESIGNATION;
  const fallback = current.defaults.map((person) => personName(person)).join(", ");
  const submitter = current.item.status === "ENVIADO" ? current.item.submittedBy?.id : null;

  return (
    <Dialog open={target !== null} onOpenChange={(value) => (!value && !busy ? onClose() : undefined)}>
      <EditDialogContent className="sm:max-w-[600px]">
        <EditDialogHeader
          icon={UserCheck}
          title="Validador do documento"
          description={`${current.item.title} · versão ${current.versionLabel}.`}
          details="Quem enviou o documento não pode aprovar o próprio envio."
          onClose={onClose}
          closeDisabled={busy}
        />
        <EditDialogBody>
        <RadioGroup value={selected} onValueChange={(value) => setSelected(String(value))} aria-label="Validador do documento" className="gap-2">
          {candidates.map((candidate) => (
            <Label
              key={candidate.userId}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 font-normal transition-colors duration-200 hover:bg-muted/50 has-data-checked:border-primary/50 has-data-checked:bg-primary/5 motion-reduce:transition-none"
            >
              <RadioGroupItem value={candidate.userId} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{candidate.name}</span>
                <span className="truncate text-xs text-muted-foreground">{candidate.roles.map(memberRole).join(" · ")}</span>
                {candidate.userId === submitter ? (
                  <span className="text-xs text-status-attention-ink">Enviou o documento atual: não poderá aprovar este envio.</span>
                ) : null}
              </span>
            </Label>
          ))}
          <Label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 font-normal transition-colors duration-200 hover:bg-muted/50 has-data-checked:border-primary/50 has-data-checked:bg-primary/5 motion-reduce:transition-none">
            <RadioGroupItem value={NO_DESIGNATION} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">Sem designação específica</span>
              <span className="text-xs text-muted-foreground">
                {fallback ? `Valida o responsável técnico do marco de homologação: ${fallback}.` : "Nenhum marco de homologação tem responsável técnico."}
              </span>
            </span>
          </Label>
        </RadioGroup>
        </EditDialogBody>
        <EditDialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={busy}
            disabled={selected === initial}
            onClick={() => {
              const { versionId, item } = current;
              void run(
                () => assignDeliveryItemValidator(projectId, versionId, item.id, { validatorId: selected === NO_DESIGNATION ? null : selected }),
                "Validador atualizado.",
                "Não foi possível atualizar o validador.",
              );
            }}
          >
            Salvar validador
          </Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}

type HistoryState = { status: "loading" } | { status: "ready"; events: Event[] } | { status: "error" };

function actorRoles(event: Event) {
  const roles = [...(event.actorRole ? [roleLabel(event.actorRole)] : []), ...event.actorProjectRoles.map(memberRole)];
  return [...new Set(roles)].join(" · ");
}

/**
 * Histórico do documento em painel lateral: envios, rejeições, reenvios, aprovações, dispensas e trocas de validador, com
 * autor, perfil, data e justificativa. Os registros são só leitura: nada é sobrescrito.
 */
export function HistorySheet({ target, projectId, onClose }: { target: ItemTarget | null; projectId: string; onClose: () => void }) {
  const [last, setLast] = useState<ItemTarget | null>(null);
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const current = target ?? last;

  useEffect(() => {
    if (!target) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nova consulta a cada abertura
    setLast(target);
    setState({ status: "loading" });
    listDeliveryItemEvents(projectId, target.versionId, target.item.id)
      .then((response) => {
        if (active) setState(response.status === 200 ? { status: "ready", events: response.data.data } : { status: "error" });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [target, projectId, attempt]);

  const labels = state.status === "ready" ? describeHistory(state.events) : [];

  return (
    <Sheet open={target !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-md">
        <header className="flex flex-col gap-1 border-b border-border px-5 pt-5 pb-4 pr-12">
          <span className="text-label font-semibold tracking-wide text-primary uppercase">Histórico do documento</span>
          <SheetTitle className="text-base font-semibold text-foreground">{current?.item.title ?? ""}</SheetTitle>
          <SheetDescription className="text-xs">
            Versão {current?.versionLabel ?? ""} · registros em ordem cronológica, preservados sem alteração.
          </SheetDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          {state.status === "loading" ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando histórico">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : state.status === "error" ? (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-status-critical/25 bg-status-critical-soft px-3 py-3">
              <p className="text-sm font-medium text-foreground">Não foi possível carregar o histórico.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
                Tentar novamente
              </Button>
            </div>
          ) : state.events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              Nenhum registro ainda: o histórico começa no primeiro envio da evidência ou na designação do validador.
            </p>
          ) : (
            <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
              {state.events.map((event, index) => {
                const evidence = evidenceDisplay(event.evidenceKind as EvidenceKind | null, event.evidenceRef);
                const roles = actorRoles(event);
                return (
                  <li key={event.id} className="relative flex gap-3 pl-0">
                    <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-popover", DOT[labels[index].tone])} aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-sm font-semibold text-foreground">{labels[index].label}</span>
                        <time dateTime={event.createdAt} className="text-xs text-muted-foreground tabular-nums">
                          {stamp(event.createdAt)}
                        </time>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {personName(event.actor)}
                        {roles ? ` · ${roles}` : ""}
                      </p>
                      {event.action === "DESIGNACAO" ? (
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                          <span>{event.previousValidator ? personName(event.previousValidator) : "Responsável técnico do marco"}</span>
                          <ArrowRight aria-label="para" className="size-3 text-muted-foreground" />
                          <span className="font-medium">{event.newValidator ? personName(event.newValidator) : "Responsável técnico do marco"}</span>
                        </p>
                      ) : null}
                      {evidence ? (
                        <p className="break-all text-xs text-muted-foreground">
                          {evidence.kindLabel}:{" "}
                          {evidence.href ? (
                            <a href={evidence.href} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">
                              {evidence.text}
                            </a>
                          ) : (
                            evidence.text
                          )}
                        </p>
                      ) : null}
                      {event.note ? (
                        <blockquote className="rounded-md border-l-2 border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground">{event.note}</blockquote>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
