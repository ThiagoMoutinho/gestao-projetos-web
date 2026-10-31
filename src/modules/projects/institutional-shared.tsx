"use client";

import { ChevronRight, ChevronUp } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { GetProjectOverview200 } from "@/lib/api/generated/model/getProjectOverview200";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { RichText } from "@/components/ui/rich-text";
import { cn } from "@/lib/utils";

export type Overview = GetProjectOverview200;
export type InstitutionalStatus = "EMPTY" | "VALIDATED" | "PENDING_VALIDATION";
type Person = { id: string; name: string | null };

/** Formato comum dos seis campos do perfil institucional. */
export type FieldData = {
  status: InstitutionalStatus;
  published: {
    value: string;
    author: Person;
    authoredAt: string;
    validatedBy: Person | null;
    validatedAt: string | null;
  } | null;
  draft: { value: string; author: Person; savedAt: string } | null;
};

export function personName(person: Person | null | undefined) {
  return person?.name?.trim() || "Usuário não identificado";
}

export function stamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** "Salvo" (aguardando validação) e "Validado" são estados distintos e nunca se misturam visualmente. */
export function StatusPill({ status }: { status: InstitutionalStatus }) {
  if (status === "EMPTY") {
    return null;
  }
  const validated = status === "VALIDATED";
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-xs",
        validated
          ? "border-success/40 bg-success/10 text-success-foreground"
          : "border-warning/50 bg-warning/10 text-warning-foreground",
      )}
    >
      {validated ? "Validado" : "Aguardando validação"}
    </Badge>
  );
}

/** Controla o envio de uma ação: bloqueia duplo clique e padroniza o feedback de sucesso e de erro. */
export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  async function run(
    task: () => Promise<unknown>,
    success: string,
    failure: string,
  ) {
    if (busy) {
      return false;
    }
    setBusy(true);
    try {
      await task();
      notifySuccess(success);
      onDone();
      return true;
    } catch (caught) {
      reportFailure(caught, failure);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

/** Alteração pendente com as ações do PMO: validar ou rejeitar (a rejeição exige justificativa). */
export function PendingDecision({
  authorLine,
  canDecide,
  ownDraft,
  busy,
  rejectTitle,
  onValidate,
  onReject,
  children,
}: {
  authorLine: string;
  canDecide: boolean;
  /** O próprio autor não valida a sua alteração (a API também bloqueia): mostra o aviso no lugar dos botões. */
  ownDraft: boolean;
  busy: boolean;
  rejectTitle: string;
  onValidate: () => Promise<boolean>;
  onReject: (reason: string) => Promise<boolean>;
  children: React.ReactNode;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2">
      <p className="text-xs font-semibold text-warning-foreground">
        Alteração aguardando validação
      </p>
      <div className="mt-1 text-xs leading-relaxed break-words whitespace-pre-wrap">
        {children}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{authorLine}</p>
      {canDecide && ownDraft ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Outra pessoa do PMO deve validar esta alteração.
        </p>
      ) : canDecide ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="xs"
            disabled={busy}
            onClick={() => void onValidate()}
          >
            Validar
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            Rejeitar
          </Button>
        </div>
      ) : null}
      <Dialog
        open={rejecting}
        onOpenChange={(next) => {
          if (!busy) {
            setRejecting(next);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{rejectTitle}</DialogTitle>
            <DialogDescription>
              A versão validada anterior é mantida. A justificativa fica
              registrada na auditoria.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            placeholder="Justificativa da rejeição"
            aria-label="Justificativa da rejeição"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || trimmed.length === 0}
              onClick={async () => {
                if (await onReject(trimmed)) {
                  setRejecting(false);
                  setReason("");
                }
              }}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Texto com prévia e "Ver mais/Ver menos". O botão só aparece quando o texto realmente não cabe (medido na tela, então
 * vale também ao redimensionar). O conteúdo completo sempre existe na tela e a altura muda com transição suave.
 *
 * Por padrão a prévia tem `lines` linhas. Com `fill`, o texto ocupa todo o espaço que o cartão tem sobrando (o cartão
 * pode ser mais alto que o seu conteúdo por dividir a linha com outro) e `lines` vira apenas o mínimo: só se o texto
 * ainda assim não couber aparece o "Ver mais". Exige um pai flex em coluna com altura definida pelo cartão.
 */
export function ExpandableText({
  text,
  className,
  lines = 3,
  markdown = false,
  fill = false,
  chevron = false,
}: {
  text: string;
  className?: string;
  lines?: number;
  markdown?: boolean;
  fill?: boolean;
  /** Mostra a seta ao lado de "Ver mais/Ver menos", como nos botões de expandir dos cartões. */
  chevron?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [limit, setLimit] = useState(0);
  const [full, setFull] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = content.current;
    const box = viewport.current;
    if (!element || !box) {
      return;
    }
    const measure = () => {
      const style = getComputedStyle(element);
      const lineHeight =
        Number.parseFloat(style.lineHeight) ||
        Number.parseFloat(style.fontSize) * 1.6;
      const max = Math.round(lineHeight * lines);
      setLimit(max);
      setFull(element.scrollHeight);
      // No modo fill, o espaço disponível é a altura atual da área de texto (que já inclui o que sobra no cartão).
      setOverflows(
        element.scrollHeight >
          (fill ? Math.max(box.clientHeight, max) : max) + 2,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text, lines, fill]);

  const collapsed = overflows && !open;
  const showButton = overflows || open;
  return (
    <div className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div
        ref={viewport}
        className={cn(
          "relative overflow-hidden ease-out motion-reduce:transition-none",
          fill
            ? "min-h-0 flex-1 basis-0 transition-[min-height] duration-300"
            : "transition-[max-height] duration-300",
        )}
        style={
          limit > 0
            ? fill
              ? { minHeight: open ? full : limit }
              : { maxHeight: collapsed ? limit : full }
            : undefined
        }
      >
        <div ref={content} className="text-xs leading-relaxed">
          {markdown ? (
            <RichText markdown={text} className={className} />
          ) : (
            <p
              className={cn(
                "break-words whitespace-pre-wrap text-foreground/85",
                className,
              )}
            >
              {text}
            </p>
          )}
        </div>
        {collapsed ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent"
            aria-hidden="true"
          />
        ) : null}
      </div>
      {showButton ? (
        <button
          type="button"
          className={cn(
            "mt-0.5 self-start text-xs font-semibold text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            chevron && "inline-flex items-center gap-1",
          )}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Ver menos" : "Ver mais"}
          {chevron ? (
            open ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

/** Ação "Ver mais / Ver detalhes / Ver todos" dos cartões: expande o próprio cartão (e vira "Ver menos"). */
export function SeeMore({
  onClick,
  children = "Ver mais",
  className,
  expanded,
}: {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  /** Quando informado, expõe o estado ao leitor de tela e troca o ícone. */
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        "mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {children}
      {expanded ? (
        <ChevronUp className="size-3.5" aria-hidden="true" />
      ) : (
        <ChevronRight className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
