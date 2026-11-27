"use client";

import { Activity, Award, Briefcase, Check, Info, Loader2, type LucideIcon, PencilLine, ListChecks, Plus, Trash2, TriangleAlert, UserCog, UserRound, Users, X, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OptionCombobox, type ComboOption } from "@/components/option-combobox";
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
import { ApiError } from "@/lib/api/fetcher";
import type { ListProjectMemberCandidates200DataItem } from "@/lib/api/generated/model/listProjectMemberCandidates200DataItem";
import {
  addProjectMember,
  listProjectMemberCandidates,
  listProjectMemberFunctions,
  removeProjectMember,
  updateProjectMember,
} from "@/lib/api/generated/participantes/participantes";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/modules/auth/roles";

import type { ProjectMemberView } from "./eap-present";
import { SectionCard } from "./overview-panel";
import { Participants } from "./planning-overview";
import { TeamDrawerContent } from "./team-drawer";
import { MemberFunctionDialog, type MemberFunction } from "./member-function-dialog";
import { MemberFunctionsManager } from "./member-functions-manager";
import { projectRoleLabel } from "./project-records";
import {
  draftFromMembers,
  applyChoice,
  choiceOf,
  FUNCTION_PREFIX,
  KEY_ROLES,
  OWNER_ROLE,
  TEAM_ROLES,
  teamOperations,
  teamProblems,
  type KeyRole,
  type TeamDraft,
  type TeamOperation,
  type TeamRole,
} from "./team-editing";

type Candidate = ListProjectMemberCandidates200DataItem;

/**
 * Cartão Equipe da Visão Geral. O lápis só aparece para quem a API autoriza a gerenciar participantes:
 * a consulta de candidatos responde 403 para os demais (a regra fica no backend, não é repetida aqui).
 */
export function TeamCard({ projectId, members, canManageFunctions = false }: { projectId: string; members: ProjectMemberView[] | null; canManageFunctions?: boolean }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listProjectMemberCandidates(projectId)
      .then((response) => {
        if (alive && response.status === 200) setCandidates(response.data.data);
      })
      .catch(() => {
        // 403 (sem permissão) ou falha de rede: o cartão continua só para leitura.
        if (alive) setCandidates(null);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const canEdit = candidates !== null && members !== null;

  return (
    <>
      <SectionCard
        title="Equipe"
        subtitle="Responsáveis pelos compromissos do projeto"
        icon={Users}
        tone="blue"
        // O botão aparece sempre que há equipe (para consultar e-mails e funções no painel), caiba ou não a lista no cartão.
        expandable={members !== null && members.length > 0}
        moreLabel={`Ver todos os participantes (${new Set((members ?? []).map((member) => member.userId)).size})`}
        // A relação completa, com busca, fica no painel.
        drawer={
          members !== null && members.length > 0
            ? {
                title: "Equipe",
                description: "Participantes e responsabilidades do projeto.",
                content: <TeamDrawerContent members={members} />,
              }
            : undefined
        }
        action={
          canEdit ? (
            <Button type="button" variant="outline" size="icon" aria-label="Editar: Equipe" onClick={() => setOpen(true)}>
              <PencilLine aria-hidden="true" />
            </Button>
          ) : null
        }
      >
        <Participants members={members} />
      </SectionCard>
      {open && members !== null && candidates !== null ? (
        <TeamEditDialog projectId={projectId} members={members} candidates={candidates} canManageFunctions={canManageFunctions} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

const KEY_LABEL: Record<KeyRole, string> = {
  GESTOR: "Gestor",
  PATROCINADOR: "Patrocinador",
  RESPONSAVEL_TECNICO: "Responsável técnico",
  FORNECEDOR: "Fornecedor",
};

const ROLE_OPTIONS: ComboOption[] = TEAM_ROLES.map((role) => ({ value: role, label: projectRoleLabel(role) }));

function newRowId() {
  return `novo-${Math.random().toString(36).slice(2, 10)}`;
}

type Person = { name: string; email: string; profile: string | null };

const KEY_ICON: Record<KeyRole, LucideIcon> = { GESTOR: UserCog, PATROCINADOR: Award, RESPONSAVEL_TECNICO: UserRound, FORNECEDOR: Briefcase };

/** Tons já existentes no sistema para diferenciar as iniciais das pessoas (a cor vem só do ID). */
const AVATAR_TONES = [
  "bg-primary/12 text-primary dark:bg-primary/20",
  "bg-status-validation-soft text-status-validation-ink",
  "bg-status-running-soft text-status-running-ink",
  "bg-status-done-soft text-status-done-ink",
  "bg-status-attention-soft text-status-attention-ink",
];

function toneOf(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

/** Pessoa em uma linha: iniciais, nome completo (prioridade) e e-mail como informação secundária. */
function PersonSummary({ id, person }: { id: string; person: Person }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-body font-semibold", toneOf(id))}>
        {initialsOf(person.name)}
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-body leading-tight font-semibold break-words text-foreground">{person.name}</span>
        <span className="block truncate text-label text-muted-foreground" title={person.profile ? `${person.email} · ${person.profile}` : person.email}>
          {person.email}
        </span>
      </span>
    </span>
  );
}

const FIELD_BOX = "min-h-14 rounded-xl border border-input bg-background shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

/**
 * Seleção de pessoa: escolhida, mostra o cartão com nome completo e e-mail (clicar troca; o × limpa);
 * sem ninguém, mostra a busca entre os usuários ativos.
 */
function PersonPicker({
  label,
  value,
  onChange,
  options,
  person,
  disabled,
  invalid,
  clearable = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  person: Person | null;
  disabled: boolean;
  invalid?: boolean;
  clearable?: boolean;
}) {
  const [searching, setSearching] = useState(false);
  if (value && person && !searching) {
    return (
      <div className={cn("flex items-center gap-1 py-1.5 pr-1.5 pl-2", FIELD_BOX)}>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => setSearching(true)}
          aria-label={`${label}: ${person.name}. Trocar`}
          className="h-auto min-w-0 flex-1 justify-start rounded-lg p-1 font-normal whitespace-normal hover:bg-muted/60"
        >
          <PersonSummary id={value} person={person} />
        </Button>
        {clearable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => onChange("")}
            aria-label={`Remover ${person.name} de ${label}`}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <OptionCombobox
      label={label}
      value={value}
      onChange={(next) => {
        onChange(next);
        if (next) setSearching(false);
      }}
      options={options}
      placeholder="Selecione um usuário..."
      emptyText="Nenhum usuário ativo encontrado."
      disabled={disabled}
      invalid={invalid}
      className="min-w-0"
    />
  );
}

function SectionTitle({ id, icon: Icon, children }: { id: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-2.5 text-card-title font-semibold text-foreground">
      <Icon className="size-5 text-foreground/80" aria-hidden="true" />
      {children}
    </h3>
  );
}

function FieldLabel({ icon: Icon, muted = false, children }: { icon: LucideIcon; muted?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("flex items-center gap-2 text-body font-medium", muted ? "text-muted-foreground" : "text-foreground")}>
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </span>
  );
}

function TeamEditDialog({
  projectId,
  members,
  candidates,
  canManageFunctions,
  onClose,
}: {
  projectId: string;
  members: ProjectMemberView[];
  candidates: Candidate[];
  canManageFunctions: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const initial = useMemo(() => draftFromMembers(members), [members]);
  const [draft, setDraft] = useState<TeamDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [functions, setFunctions] = useState<MemberFunction[]>([]);
  const [newFunctionOpen, setNewFunctionOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  });

  // Funções ativas do catálogo institucional (rótulos como Stakeholder). Falhou? O formulário segue só com os papéis de acesso.
  const applyFunctions = useCallback((list: MemberFunction[]) => {
    setFunctions(list);
    // Linhas ainda não salvas que usam uma função que deixou de estar ativa (ou foi excluída) voltam a Observador sem função.
    // A função que um participante já tem (salva) continua valendo mesmo desativada.
    const active = new Set(list.map((entry) => entry.id));
    const saved = new Map(membersRef.current.map((member) => [member.id, member.functionId ?? null]));
    setDraft((current) => ({
      ...current,
      others: current.others.map((row) =>
        row.functionId && !active.has(row.functionId) && !(row.memberId && saved.get(row.memberId) === row.functionId) ? { ...row, functionId: null } : row,
      ),
    }));
  }, []);

  const loadFunctions = useCallback(async () => {
    try {
      const response = await listProjectMemberFunctions();
      if (response.status === 200) applyFunctions(response.data.data);
    } catch {
      // sem a lista, o formulário segue só com os papéis de acesso
    }
  }, [applyFunctions]);

  useEffect(() => {
    let alive = true;
    listProjectMemberFunctions()
      .then((response) => {
        if (alive && response.status === 200) applyFunctions(response.data.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [applyFunctions]);

  // Papéis de acesso + funções do catálogo. Quem já tem uma função desativada continua vendo o nome dela.
  const roleOptions: ComboOption[] = useMemo(() => {
    const known = new Map(functions.map((entry) => [entry.id, entry.name]));
    for (const member of members) if (member.functionId && !known.has(member.functionId)) known.set(member.functionId, member.roleLabel);
    return [
      ...ROLE_OPTIONS,
      ...[...known.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([id, name]) => ({ value: `${FUNCTION_PREFIX}${id}`, label: `${name} (função)` })),
    ];
  }, [functions, members]);

  // Pessoas conhecidas: candidatos ativos e quem já está na equipe (pode estar inativo e continuar visível).
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const member of members) map.set(member.userId, { name: member.name, email: member.email, profile: null });
    for (const candidate of candidates) map.set(candidate.id, { name: candidate.name, email: candidate.email, profile: roleLabel(candidate.role) });
    return map;
  }, [members, candidates]);
  const nameOf = (userId: string) => people.get(userId)?.name ?? "Pessoa";
  const personOf = (userId: string) => people.get(userId) ?? null;
  // A busca procura no nome e no e-mail; o nome vem primeiro para não ser cortado.
  const personOptions: ComboOption[] = useMemo(
    () =>
      [...people.entries()]
        .map(([id, person]) => ({ value: id, label: `${person.name} — ${person.email}` }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [people],
  );

  const operations = teamOperations(members, draft);
  const problems = teamProblems(draft, nameOf);
  const dirty = operations.length > 0 || draft.others.some((row) => !row.memberId);
  const owners = members.filter((member) => member.role === OWNER_ROLE);

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function setKey(role: KeyRole, userId: string) {
    setDraft((current) => ({ ...current, key: { ...current.key, [role]: userId } }));
  }

  function setRow(rowId: string, patch: Partial<{ userId: string; role: TeamRole; functionId: string | null }>) {
    setDraft((current) => ({ ...current, others: current.others.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)) }));
  }

  function removeRow(rowId: string) {
    setDraft((current) => ({ ...current, others: current.others.filter((row) => row.rowId !== rowId) }));
  }

  function addRow() {
    setDraft((current) => ({ ...current, others: [...current.others, { rowId: newRowId(), memberId: null, userId: "", role: "DESENVOLVEDOR", functionId: null }] }));
  }

  async function run(operation: TeamOperation) {
    if (operation.type === "remove") return removeProjectMember(projectId, operation.memberId);
    if (operation.type === "update") return updateProjectMember(projectId, operation.memberId, { role: operation.role, functionId: operation.functionId });
    return addProjectMember(projectId, { userId: operation.userId, role: operation.role, functionId: operation.functionId });
  }

  async function save() {
    if (problems.length > 0 || operations.length === 0 || saving) return;
    setSaving(true);
    let done = 0;
    try {
      // A API registra a auditoria de cada inclusão, alteração e remoção (quem, quando, antes e depois).
      for (const operation of operations) {
        await run(operation);
        done += 1;
      }
      notifySuccess("Equipe atualizada.");
      router.refresh();
      onClose();
    } catch (error) {
      const reason = error instanceof ApiError && error.status < 500 ? error.message : "Falha de conexão ou do servidor.";
      notifyError(
        "Não foi possível salvar toda a equipe.",
        done > 0 ? `${reason} ${done} de ${operations.length} alterações foram aplicadas; o cartão mostra a situação atual.` : `${reason} Nada foi alterado.`,
      );
      router.refresh();
      if (done > 0) onClose();
    } finally {
      setSaving(false);
    }
  }

  const pending = operations.length;

  return (
    <>
      <Dialog open onOpenChange={(next) => (next ? null : requestClose())}>
        <EditDialogContent>
          <EditDialogHeader
            icon={Users}
            title="Editar equipe"
            description="Responsáveis e participantes do projeto."
            onClose={requestClose}
            closeDisabled={saving}
          />

          <EditDialogBody className="gap-0 p-0 sm:px-0">
          <section aria-labelledby="team-key-title" className="flex flex-col gap-4 border-b px-6 py-5 sm:px-7">
            <SectionTitle id="team-key-title" icon={Users}>Responsáveis</SectionTitle>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {KEY_ROLES.map((role) => (
                <div key={role} className="flex min-w-0 flex-col gap-2">
                  <FieldLabel icon={KEY_ICON[role]}>{KEY_LABEL[role]}</FieldLabel>
                  <PersonPicker
                    label={KEY_LABEL[role]}
                    value={draft.key[role]}
                    onChange={(value) => setKey(role, value)}
                    options={personOptions}
                    person={personOf(draft.key[role])}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
            {owners.length > 0 ? (
              <p className="flex items-start gap-2 text-body text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Dono do projeto: <span className="font-medium text-foreground">{owners.map((owner) => owner.name).join(", ")}</span> · muda só pela transferência de titularidade.
                </span>
              </p>
            ) : null}
          </section>

          <section aria-labelledby="team-others-title" className="flex flex-col gap-4 px-6 py-5 sm:px-7">
            <div className="flex flex-col gap-3">
              <SectionTitle id="team-others-title" icon={Users}>
                Participantes ({draft.others.length})
              </SectionTitle>
              {/* Mesma linha: as funções à esquerda e a ação principal (Adicionar participante) no canto direito. */}
              <div className="flex flex-wrap items-center gap-2">
                {canManageFunctions ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setManageOpen(true)} disabled={saving}>
                      <ListChecks aria-hidden="true" />
                      Gerenciar funções
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setNewFunctionOpen(true)} disabled={saving}>
                      <Tag aria-hidden="true" />
                      Nova função
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="secondary" onClick={addRow} disabled={saving} className="ml-auto">
                  <Plus aria-hidden="true" />
                  Adicionar participante
                </Button>
              </div>
            </div>
            {draft.others.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-5 text-center text-body text-muted-foreground">Nenhum outro participante.</p>
            ) : (
              <ul className="flex flex-col overflow-hidden rounded-xl border bg-background">
                {draft.others.map((row, index) => {
                  const person = row.userId ? personOf(row.userId) : null;
                  const who = person?.name ?? `participante ${index + 1}`;
                  return (
                    <li key={row.rowId} className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        {row.memberId && person ? (
                          <PersonSummary id={row.userId} person={person} />
                        ) : (
                          // Participante novo: depois de escolhido mostra nome e e-mail, e ainda pode ser trocado antes de salvar.
                          <PersonPicker
                            label={`Pessoa do participante ${index + 1}`}
                            value={row.userId}
                            onChange={(value) => setRow(row.rowId, { userId: value })}
                            options={personOptions}
                            person={person}
                            disabled={saving}
                            invalid={!row.userId}
                            clearable={false}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 sm:shrink-0">
                        <OptionCombobox
                          label={`Função de ${who}`}
                          value={choiceOf(row)}
                          onChange={(value) => {
                            const choice = applyChoice(value);
                            if (choice) setRow(row.rowId, choice);
                          }}
                          options={roleOptions}
                          disabled={saving}
                          className="min-w-0 flex-1 sm:w-48 sm:flex-none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeRow(row.rowId)}
                          disabled={saving}
                          aria-label={`Remover ${who} da equipe`}
                          className="shrink-0 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {problems.length > 0 ? (
              <ul role="alert" className="flex flex-col gap-1 rounded-xl bg-status-critical-soft px-4 py-2.5 text-label text-status-critical-ink">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </section>

          </EditDialogBody>

          <EditDialogFooter
            status={
              <>
                <Activity className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {pending === 0 ? "Nenhuma alteração." : `${pending} ${pending === 1 ? "alteração será salva" : "alterações serão salvas"}.`}
              </>
            }
          >
            <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || problems.length > 0 || pending === 0}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {saving ? "Salvando…" : "Salvar equipe"}
            </Button>
          </EditDialogFooter>
        </EditDialogContent>
      </Dialog>

      <MemberFunctionsManager open={manageOpen} onClose={() => setManageOpen(false)} onChanged={() => void loadFunctions()} />

      <MemberFunctionDialog
        open={newFunctionOpen}
        onClose={() => setNewFunctionOpen(false)}
        existing={functions}
        onCreated={(created) => setFunctions((current) => (current.some((entry) => entry.id === created.id) ? current : [...current, created]))}
      />

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-status-attention-soft text-status-attention-ink">
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Descartar as alterações da equipe?</AlertDialogTitle>
            <AlertDialogDescription>As mudanças feitas neste formulário ainda não foram salvas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
