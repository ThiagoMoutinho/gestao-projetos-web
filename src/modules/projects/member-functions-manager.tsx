"use client";

import { Check, Loader2, Lock, Pencil, Power, RotateCcw, Tag, Trash2, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/fetcher";
import {
  deleteProjectMemberFunction,
  listProjectMemberFunctions,
  updateProjectMemberFunction,
} from "@/lib/api/generated/participantes/participantes";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import {
  canDelete,
  canReactivate,
  deactivateImpact,
  deleteImpact,
  reactivateBlockedReason,
  renameConflict,
  usageSummary,
  type CatalogFunction,
} from "./member-function-rules";
import { MEMBER_FUNCTION_NAME_MAX, memberFunctionNameProblem, ROLE_TEXT, TEAM_ROLES } from "./team-editing";

type Confirm = { kind: "deactivate" | "delete"; fn: CatalogFunction } | null;

const iconButton = "text-muted-foreground disabled:opacity-40";

/** Tooltip de um botão de ícone; o span permite mostrar o motivo também quando o botão está desabilitado. */
function ActionTip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-balance">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Gestão do catálogo de funções (só ADMIN e PMO abrem): editar o nome, desativar/reativar e excluir. Excluir é definitivo e só vale
 * para função nunca atribuída; havendo participante ou registro do histórico, só desativar. A tela orienta e a API valida tudo.
 */
export function MemberFunctionsManager({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <EditDialogContent className="sm:max-w-2xl">
        {open ? <ManagerBody onClose={onClose} onChanged={onChanged} /> : null}
      </EditDialogContent>
    </Dialog>
  );
}

function ManagerBody({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<CatalogFunction[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const fetchAll = useCallback(async (): Promise<CatalogFunction[]> => {
    const response = await listProjectMemberFunctions({ includeInactive: "true" });
    if (response.status !== 200) throw new ApiError(response.status, "UNEXPECTED_STATUS", "Não foi possível carregar as funções.");
    return response.data.data;
  }, []);

  // Recarrega a lista (depois de cada operação ou ao tentar de novo).
  const load = useCallback(async () => {
    try {
      setItems(await fetchAll());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [fetchAll]);

  useEffect(() => {
    let alive = true;
    fetchAll()
      .then((list) => {
        if (alive) {
          setItems(list);
          setFailed(false);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [fetchAll]);

  const sorted = (items ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const editing = sorted.find((entry) => entry.id === editingId) ?? null;
  const nameProblem = editing ? (memberFunctionNameProblem(draftName) ?? renameConflict(draftName, sorted.filter((entry) => entry.id !== editing.id))) : null;

  function startEdit(fn: CatalogFunction) {
    setEditingId(fn.id);
    setDraftName(fn.name);
  }

  async function run(fn: CatalogFunction, action: () => Promise<void>, success: string) {
    setBusyId(fn.id);
    try {
      await action();
      notifySuccess(success);
      await load();
      onChanged();
    } catch (error) {
      const reason = error instanceof ApiError && error.status < 500 ? error.message : "Falha de conexão ou do servidor.";
      notifyError("Não foi possível concluir a operação.", `${reason} Nada foi alterado.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const patch = async (fn: CatalogFunction, body: { name?: string; isActive?: boolean }) => {
    const response = await updateProjectMemberFunction(fn.id, body);
    if (response.status !== 200) throw new ApiError(response.status, "UNEXPECTED_STATUS", "A API recusou a alteração.");
  };

  async function saveName(fn: CatalogFunction) {
    if (nameProblem || draftName.trim() === "") return;
    await run(fn, () => patch(fn, { name: draftName }), `Função renomeada para “${draftName.replace(/\s+/g, " ").trim()}”.`);
    setEditingId(null);
  }

  async function confirmAction() {
    const current = confirm;
    setConfirm(null);
    if (!current) return;
    if (current.kind === "deactivate") {
      await run(current.fn, () => patch(current.fn, { isActive: false }), `Função “${current.fn.name}” desativada.`);
    } else {
      await run(
        current.fn,
        async () => {
          const response = await deleteProjectMemberFunction(current.fn.id);
          if (response.status !== 204) throw new ApiError(response.status, "UNEXPECTED_STATUS", "A API recusou a exclusão.");
        },
        `Função “${current.fn.name}” excluída.`,
      );
    }
  }

  return (
    <>
      <EditDialogHeader
        icon={Tag}
        title="Funções de participante"
        description="Papéis fixos e funções do catálogo do Instituto."
        details="A exclusão definitiva só vale para funções nunca atribuídas a um projeto."
        onClose={onClose}
      />
      <EditDialogBody className="gap-5">
        <section aria-labelledby="fixed-roles-title" className="flex flex-col gap-2">
          <h3 id="fixed-roles-title" className="text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Papéis fixos do projeto
          </h3>
          <ul aria-label="Papéis fixos" className="flex flex-col overflow-hidden rounded-xl border bg-background">
            {TEAM_ROLES.map((role) => (
              <li key={role} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                <p className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{ROLE_TEXT[role]}</p>
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-label font-medium text-muted-foreground"
                  title="Define o acesso ao projeto."
                >
                  <Lock className="size-3" aria-hidden="true" />
                  Papel fixo
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={iconButton}
                  disabled
                  aria-label={`Excluir o papel fixo ${ROLE_TEXT[role]}, indisponível por enquanto`}
                  title="Somente o administrador do sistema poderá excluir papéis fixos (em breve)."
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-label text-muted-foreground">
            Os papéis fixos definem o acesso ao projeto e, por enquanto, são só para consulta. No futuro, somente o administrador do sistema poderá excluí-los.
          </p>
        </section>
        <section aria-labelledby="catalog-title" className="flex flex-col gap-2">
        <h3 id="catalog-title" className="text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Funções do catálogo
        </h3>
        {failed && items === null ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-dashed px-4 py-5 text-body text-muted-foreground">
            Não foi possível carregar as funções. Nada foi alterado.
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        ) : items === null ? (
          <div role="status" aria-label="Carregando as funções" className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl motion-reduce:animate-none" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-body text-muted-foreground">
            Nenhuma função cadastrada. Use “Nova função” para criar a primeira.
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border bg-background" aria-label="Funções do catálogo">
            {sorted.map((fn) => {
              const busy = busyId === fn.id;
              const isEditing = editingId === fn.id;
              const reactivateReason = reactivateBlockedReason(fn);
              return (
                <li
                  key={fn.id}
                  className={cn("flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:gap-4", isEditing ? "sm:items-start" : "sm:items-center")}
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5">
                        <Input
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveName(fn);
                            }
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              setEditingId(null);
                            }
                          }}
                          maxLength={MEMBER_FUNCTION_NAME_MAX}
                          aria-label={`Novo nome da função ${fn.name}`}
                          aria-invalid={Boolean(nameProblem)}
                          disabled={busy}
                          autoFocus
                        />
                        <p className={cn("text-label", nameProblem ? "text-status-critical-ink" : "text-muted-foreground")}>
                          {nameProblem ?? "O novo nome vale para todos que já têm a função; o histórico guarda o nome da época."}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-foreground">
                          <span className="truncate">{fn.name}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-label font-medium",
                              fn.isActive ? "bg-status-done-soft text-status-done-ink" : "bg-status-idle-soft text-status-idle-ink",
                            )}
                          >
                            {fn.isActive ? "Ativa" : "Desativada"}
                          </span>
                        </p>
                        <p className="text-label text-muted-foreground">{usageSummary(fn.usage)}</p>
                        {reactivateReason ? <p className="mt-0.5 text-label text-status-attention-ink">{reactivateReason}</p> : null}
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <Button type="button" className="h-10" onClick={() => void saveName(fn)} disabled={busy || Boolean(nameProblem) || draftName.trim() === ""}>
                          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                          Salvar
                        </Button>
                        <Button type="button" variant="outline" className="h-10" onClick={() => setEditingId(null)} disabled={busy}>
                          <X aria-hidden="true" />
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <ActionTip text="Editar">
                          <Button type="button" variant="ghost" size="icon-sm" className={iconButton} aria-label={`Editar o nome de ${fn.name}`} onClick={() => startEdit(fn)} disabled={busy}>
                            <Pencil aria-hidden="true" />
                          </Button>
                        </ActionTip>
                        {fn.isActive ? (
                          <ActionTip text="Desativar">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={iconButton}
                              aria-label={`Desativar ${fn.name}`}
                              onClick={() => setConfirm({ kind: "deactivate", fn })}
                              disabled={busy}
                            >
                              <Power aria-hidden="true" />
                            </Button>
                          </ActionTip>
                        ) : (
                          <ActionTip text="Reativar">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={iconButton}
                              aria-label={`Reativar ${fn.name}`}
                              onClick={() => void run(fn, () => patch(fn, { isActive: true }), `Função “${fn.name}” reativada.`)}
                              disabled={busy || !canReactivate(fn)}
                            >
                              <RotateCcw aria-hidden="true" />
                            </Button>
                          </ActionTip>
                        )}
                        <ActionTip text="Excluir">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn(iconButton, "hover:text-destructive")}
                            aria-label={`Excluir ${fn.name}`}
                            onClick={() => setConfirm({ kind: "delete", fn })}
                            disabled={busy || !canDelete(fn)}
                          >
                            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                          </Button>
                        </ActionTip>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </section>
      </EditDialogBody>
      <EditDialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </EditDialogFooter>

      <AlertDialog open={confirm !== null} onOpenChange={(next) => (next ? null : setConfirm(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={confirm?.kind === "delete" ? "bg-status-critical-soft text-status-critical-ink" : "bg-status-attention-soft text-status-attention-ink"}>
              {confirm?.kind === "delete" ? <Trash2 /> : <TriangleAlert />}
            </AlertDialogMedia>
            <AlertDialogTitle>{confirm?.kind === "delete" ? "Excluir a função definitivamente?" : "Desativar a função?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirm ? (confirm.kind === "delete" ? deleteImpact(confirm.fn) : deactivateImpact(confirm.fn)) : null}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant={confirm?.kind === "delete" ? "destructive" : "default"} onClick={() => void confirmAction()}>
              {confirm?.kind === "delete" ? "Excluir definitivamente" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
