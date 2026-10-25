"use client";

import { AlertTriangle, Check, ChevronRight, FileText, Lock, Plus, RotateCcw, Upload, X } from "lucide-react";
import { Suspense, use, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { authorizeEapMilestoneResubmission, deliverEapMilestone, reviewEapMilestone } from "@/lib/api/generated/eap/eap";
import { cn } from "@/lib/utils";

import { canAuthorizeResubmission, canHomologateMilestone, type EapAccess } from "./eap-access";
import { deliveryRequest, type DeliveryRound } from "./eap-delivery-cache";
import { evidenceRequest, forgetEvidences, type EvidenceState } from "./eap-evidence-cache";
import { presentMilestone, type ProjectMilestoneView } from "./eap-present";
import { Reveal } from "./eap-reveal";
import { EapStatusBadge, type EapStatusKind } from "./eap-status-badge";
import { recordedDate } from "./project-records";

type Mode = "deliver" | "adjust" | "reject" | "authorize" | null;
type EvidenceItem = Extract<EvidenceState, { status: "ready" }>["items"][number];
type EvidenceLink = { title: string; url: string };

const MAX_DECISION_EVIDENCES = 10;

const ROUND_STATUS: Record<DeliveryRound["status"], { label: string; kind: EapStatusKind }> = {
  EM_ANALISE: { label: "Em análise", kind: "delivered" },
  ACEITA: { label: "Aceita", kind: "done" },
  AJUSTES_SOLICITADOS: { label: "Correções necessárias", kind: "adjustments" },
  REJEITADA: { label: "Rejeitada", kind: "rejected" },
};

/**
 * Entrega, decisão do homologador, autorização de nova submissão e rodadas do marco.
 * As regras espelham a API, que continua sendo quem autoriza cada ação.
 */
export function MilestoneHomologation({
  projectId,
  milestone,
  access,
  names,
  showEvidence,
  onMilestone,
  onChanged,
}: {
  projectId: string;
  milestone: ProjectMilestoneView;
  access: EapAccess;
  names: Map<string, string> | null;
  showEvidence: boolean;
  onMilestone: (milestone: ProjectMilestoneView) => void;
  onChanged?: () => void;
}) {
  const [revision, setRevision] = useState(0);
  return (
    <Suspense fallback={<Skeleton className="h-[52px] w-full rounded-[7px]" />}>
      <HomologationBody
        projectId={projectId}
        milestone={milestone}
        access={access}
        names={names}
        showEvidence={showEvidence}
        revision={revision}
        onMilestone={onMilestone}
        onChanged={() => {
          forgetEvidences(projectId, { milestoneId: milestone.id });
          setRevision((value) => value + 1);
          onChanged?.();
        }}
      />
    </Suspense>
  );
}

function HomologationBody({
  projectId,
  milestone,
  access,
  names,
  showEvidence,
  revision,
  onMilestone,
  onChanged,
}: {
  projectId: string;
  milestone: ProjectMilestoneView;
  access: EapAccess;
  names: Map<string, string> | null;
  showEvidence: boolean;
  revision: number;
  onMilestone: (milestone: ProjectMilestoneView) => void;
  onChanged: () => void;
}) {
  const key = `${revision}:${milestone.status}:${milestone.validatedAt}:${milestone.deliveredById}`;
  const deliveries = use(deliveryRequest(projectId, milestone.phaseId, milestone.id, key));
  const evidences = showEvidence ? use(evidenceRequest(projectId, { milestoneId: milestone.id })) : null;
  const rounds = deliveries.status === "ready" ? [...deliveries.rounds].sort((a, b) => a.round - b.round) : [];
  const latest = rounds.at(-1) ?? null;

  const delivery = milestone.type === "ENTREGA" || milestone.type === "HOMOLOGACAO";
  const homologation = milestone.type === "HOMOLOGACAO";
  const awaitingAuthorization =
    delivery && milestone.status === "REJEITADO" && latest !== null && latest.resubmissionAuthorizedAt === null;
  const canDeliver =
    (access.canDeliverMilestone || (access.linked && milestone.presenterId === access.userId)) &&
    delivery &&
    (milestone.status === "PENDENTE" ||
      milestone.status === "AJUSTES_SOLICITADOS" ||
      (milestone.status === "REJEITADO" && !awaitingAuthorization));
  const decisionReady = delivery
    ? milestone.status === "ENTREGUE" && milestone.deliveredById !== null
    : milestone.status === "PENDENTE" || milestone.status === "REJEITADO";
  const canDecide = decisionReady && canHomologateMilestone(access, milestone);
  const canAuthorize = awaitingAuthorization && canAuthorizeResubmission(access);

  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [nonconformities, setNonconformities] = useState("");
  const [adjustments, setAdjustments] = useState("");
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Mode) {
    setMode(next);
    setNote("");
    setNonconformities("");
    setAdjustments("");
    setLinks([]);
    setError(null);
  }

  async function run(action: () => Promise<{ status: number; data: unknown }>, success: string, failure: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await action();
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", failure);
      }
      onMilestone(presentMilestone(response.data as Parameters<typeof presentMilestone>[0], names));
      open(null);
      notifySuccess(success);
      onChanged();
    } catch (caught) {
      setError(reportFailure(caught, failure));
    } finally {
      setSaving(false);
    }
  }

  function deliver() {
    const text = note.trim();
    void run(
      () => deliverEapMilestone(projectId, milestone.phaseId, milestone.id, text ? { note: text } : {}),
      homologation ? "Marco enviado. Aguardando homologação." : "Entrega enviada. O marco aguarda a homologação.",
      "Não foi possível registrar a entrega.",
    );
  }

  function decide(decision: "APROVADO" | "AJUSTES_SOLICITADOS" | "REJEITADO") {
    const text = note.trim();
    if (decision !== "APROVADO" && text.length < 10) {
      setError("Registre a justificativa com ao menos 10 caracteres.");
      return;
    }
    const evidences = links
      .map((link) => ({ title: link.title.trim(), url: link.url.trim() }))
      .filter((link) => link.title || link.url);
    if (decision !== "APROVADO" && evidences.some((link) => !link.title || !isHttpUrl(link.url))) {
      setError("Cada evidência precisa de título e de um link http(s) válido.");
      return;
    }
    const found = nonconformities.trim();
    const extra = adjustments.trim();
    void run(
      () =>
        reviewEapMilestone(projectId, milestone.phaseId, milestone.id, {
          decision,
          ...(decision !== "APROVADO" ? { note: text } : {}),
          ...(decision !== "APROVADO" && found ? { nonconformities: found } : {}),
          ...(decision === "AJUSTES_SOLICITADOS" && extra ? { adjustments: extra } : {}),
          ...(decision !== "APROVADO" && evidences.length > 0 ? { evidences } : {}),
        }),
      decision === "APROVADO"
        ? homologation
          ? "Marco homologado."
          : "Entrega aceita."
        : decision === "AJUSTES_SOLICITADOS"
          ? "Correções solicitadas."
          : homologation
            ? "Homologação rejeitada."
            : "Entrega rejeitada.",
      "Não foi possível registrar a decisão.",
    );
  }

  function authorize() {
    const text = note.trim();
    if (text.length < 10) {
      setError("Registre a justificativa com ao menos 10 caracteres.");
      return;
    }
    void run(
      () => authorizeEapMilestoneResubmission(projectId, milestone.phaseId, milestone.id, { justification: text }),
      "Nova submissão autorizada.",
      "Não foi possível autorizar a nova submissão.",
    );
  }

  const deciding = mode === "adjust" || mode === "reject";
  const blockedReason =
    decisionReady && !canDecide
      ? milestone.deliveredById === access.userId
        ? "Quem registrou a entrega não homologa o próprio marco."
        : milestone.reviewerName
          ? `A homologação cabe a ${milestone.reviewerName}, designado para este marco.`
          : "A homologação cabe ao dono do projeto ou à gestão vinculada a ele."
      : null;

  return (
    <div className="flex flex-col gap-3">
      {canDecide ? (
        <section id="eap-milestone-decision" className="rounded-[9px] border border-[#bad1f0] bg-[#f5f9ff] p-3.5">
          <span className="mb-[5px] block text-[9px] font-semibold tracking-[0.04em] text-[#3971ba] uppercase">Decisão de homologação</span>
          <strong className="block text-[10px] text-[#253d60]">
            {delivery
              ? `${homologation ? "Tentativa" : "Entrega"} ${latest?.status === "EM_ANALISE" ? latest.round : (latest?.round ?? 0) + 1} aguardando ${homologation ? "homologação" : "análise"}`
              : "Marco aguardando aprovação"}
          </strong>
          <p className="mt-[5px] text-[8.5px] text-[#667b98]">
            {delivery
              ? "Confira as evidências antes de decidir. Correções e rejeição exigem justificativa; o prazo previsto não muda."
              : "Marcos de aprovação admitem aceite ou rejeição. A rejeição exige justificativa."}
          </p>
          <Reveal open={deciding}>
            <div className="mt-3 flex flex-col gap-2">
              <Field label="Justificativa" hint="obrigatória">
                <Textarea className={textareaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explique o motivo da decisão." />
              </Field>
              <Field label="Inconformidades encontradas" hint="opcional">
                <Textarea className={textareaClass} value={nonconformities} onChange={(event) => setNonconformities(event.target.value)} placeholder="Descreva o que não atendeu ao critério de aceite." />
              </Field>
              <Reveal open={mode === "adjust"}>
                <Field label="Correções necessárias" hint="opcional">
                  <Textarea className={textareaClass} value={adjustments} onChange={(event) => setAdjustments(event.target.value)} placeholder="Liste o que deve ser corrigido na próxima tentativa." />
                </Field>
              </Reveal>
              <DecisionEvidenceLinks links={links} onChange={setLinks} />
            </div>
          </Reveal>
          <div className="mt-[13px] flex flex-wrap justify-end gap-[7px]">
            {deciding ? (
              <>
                <Button type="button" variant="outline" className={secondaryButton} disabled={saving} onClick={() => open(null)}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant={mode === "reject" ? "destructive" : "default"}
                  className={cn(secondaryButton, mode === "adjust" && "border-transparent bg-[#c4620f] text-white hover:bg-[#a9530b]")}
                  loading={saving}
                  onClick={() => decide(mode === "adjust" ? "AJUSTES_SOLICITADOS" : "REJEITADO")}
                >
                  {mode === "adjust" ? "Solicitar correções" : homologation ? "Rejeitar homologação" : "Rejeitar entrega"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" className={cn(secondaryButton, "text-[#9f2219]")} disabled={saving} onClick={() => open("reject")}>
                  Rejeitar
                </Button>
                {delivery ? (
                  <Button type="button" variant="outline" className={cn(secondaryButton, "text-[#b4570f]")} disabled={saving} onClick={() => open("adjust")}>
                    <RotateCcw aria-hidden="true" /> Solicitar correções
                  </Button>
                ) : null}
                <Button type="button" className={primaryButton} loading={saving} onClick={() => decide("APROVADO")}>
                  <Check aria-hidden="true" /> {homologation ? "Homologar" : delivery ? "Aceitar entrega" : "Aprovar marco"}
                </Button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {blockedReason ? <Notice tone="warning" text={blockedReason} /> : null}

      {awaitingAuthorization ? (
        <section className="rounded-[9px] border border-[#efc3bf] bg-[#fff7f6] p-3.5">
          <strong className="block text-[10px] text-[#9f2219]">Nova submissão aguardando autorização</strong>
          <p className="mt-[5px] text-[8.5px] leading-[1.45] text-[#8a3b33]">
            Após a rejeição, o reenvio depende de autorização do PMO, do ADMIN ou da gestão do projeto. O prazo planejado não foi alterado.
          </p>
          {canAuthorize ? (
            <>
              <Reveal open={mode === "authorize"}>
                <div className="mt-3">
                  <Field label="Justificativa da autorização" hint="obrigatória">
                    <Textarea className={textareaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explique por que a nova submissão foi autorizada." />
                  </Field>
                </div>
              </Reveal>
              <div className="mt-[13px] flex justify-end gap-[7px]">
                {mode === "authorize" ? (
                  <>
                    <Button type="button" variant="outline" className={secondaryButton} disabled={saving} onClick={() => open(null)}>
                      Voltar
                    </Button>
                    <Button type="button" className={primaryButton} loading={saving} onClick={authorize}>
                      Autorizar nova submissão
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" className={secondaryButton} onClick={() => open("authorize")}>
                    Autorizar nova submissão
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {canDeliver ? (
        <section className="rounded-[9px] border border-[#e4e7ec] bg-white p-3.5">
          <strong className="block text-[10px] text-[#344054]">
            {milestone.status === "PENDENTE" ? "Enviar para homologação" : homologation ? "Reenviar para homologação" : "Reenviar entrega corrigida"}
          </strong>
          <p className="mt-[5px] text-[8.5px] leading-[1.45] text-[#667085]">
            {homologation
              ? "Cada envio abre uma nova tentativa no mesmo marco. As evidências ainda não enviadas acompanham a tentativa e ficam bloqueadas após o envio."
              : "As evidências ainda não enviadas acompanham esta entrega e ficam bloqueadas para edição após o envio."}
          </p>
          <Reveal open={mode === "deliver"}>
            <div className="mt-3">
              <Field label="Observações da entrega" hint="opcional">
                <Textarea className={textareaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Descreva o que está sendo entregue." />
              </Field>
            </div>
          </Reveal>
          <div className="mt-[13px] flex justify-end gap-[7px]">
            {mode === "deliver" ? (
              <>
                <Button type="button" variant="outline" className={secondaryButton} disabled={saving} onClick={() => open(null)}>
                  Voltar
                </Button>
                <Button type="button" className={primaryButton} loading={saving} onClick={deliver}>
                  <Upload aria-hidden="true" /> {saving ? "Enviando…" : homologation ? "Enviar para homologação" : "Enviar entrega"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className={secondaryButton} onClick={() => open("deliver")}>
                <Upload aria-hidden="true" />{" "}
                {homologation
                  ? milestone.status === "PENDENTE"
                    ? "Enviar para homologação"
                    : "Reenviar para homologação"
                  : milestone.status === "PENDENTE"
                    ? "Registrar entrega"
                    : "Reenviar entrega"}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {error ? <p role="alert" className="text-[8.5px] text-destructive">{error}</p> : null}

      {deliveries.status === "error" ? <Notice tone="muted" text={deliveries.message} /> : null}
      {milestone.status === "ENTREGUE" && rounds.length === 0 && deliveries.status === "ready" ? (
        <Notice tone="muted" text="Entrega registrada antes do controle de rodadas. A rodada será criada com os dados existentes na decisão do homologador." />
      ) : null}

      <RoundList rounds={rounds} evidences={evidences} homologation={homologation} />
    </div>
  );
}

function DecisionEvidenceLinks({ links, onChange }: { links: EvidenceLink[]; onChange: (links: EvidenceLink[]) => void }) {
  const update = (index: number, patch: Partial<EvidenceLink>) =>
    onChange(links.map((link, position) => (position === index ? { ...link, ...patch } : link)));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
        Evidências da decisão
        <small className="text-[7.5px] font-normal text-[#98a2b3]">opcional</small>
      </span>
      {links.map((link, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-1.5">
          <input
            className={inputClass}
            aria-label={`Título da evidência ${index + 1}`}
            placeholder="Título"
            value={link.title}
            onChange={(event) => update(index, { title: event.target.value })}
          />
          <input
            className={inputClass}
            aria-label={`Link da evidência ${index + 1}`}
            placeholder="https://"
            value={link.url}
            onChange={(event) => update(index, { url: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover evidência ${index + 1}`}
            onClick={() => onChange(links.filter((_, position) => position !== index))}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}
      {links.length < MAX_DECISION_EVIDENCES ? (
        <Button type="button" variant="outline" className={cn(secondaryButton, "self-start")} onClick={() => onChange([...links, { title: "", url: "" }])}>
          <Plus aria-hidden="true" /> Adicionar evidência
        </Button>
      ) : null}
    </div>
  );
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function RoundList({ rounds, evidences, homologation }: { rounds: DeliveryRound[]; evidences: EvidenceState | null; homologation: boolean }) {
  const items = evidences?.status === "ready" ? evidences.items : [];
  const unsent = items.filter((item) => item.deliveryId === null);

  if (rounds.length === 0 && !evidences) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {evidences?.status === "error" ? <Notice tone="muted" text={evidences.message} /> : null}
      {evidences ? (
        <div>
          <span className={groupLabel}>{rounds.length > 0 ? "Evidências ainda não enviadas" : "Evidências da entrega"}</span>
          {unsent.length > 0 ? <EvidenceLinks items={unsent} /> : <p className={emptyInline}>Nenhuma evidência pendente de envio.</p>}
        </div>
      ) : null}
      {rounds.length > 0 ? <span className={groupLabel}>{homologation ? "Tentativas de homologação" : "Rodadas de entrega"}</span> : null}
      {[...rounds].reverse().map((round) => (
        <RoundCard
          key={round.id}
          round={round}
          homologation={homologation}
          evidences={evidences ? items.filter((item) => item.deliveryId === round.id) : null}
        />
      ))}
    </div>
  );
}

function RoundCard({ round, evidences, homologation }: { round: DeliveryRound; evidences: EvidenceItem[] | null; homologation: boolean }) {
  const status = ROUND_STATUS[round.status];
  const submitted = round.submittedAt ? recordedDate(round.submittedAt) : "data não registrada";
  return (
    <article className="rounded-[8px] border border-[#e4e7ec] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[10px] text-[#253248]">
            {homologation ? "Tentativa" : "Entrega"} {round.round}
          </strong>
          {round.legacy ? <span className="mt-[3px] block text-[8px] text-[#98a2b3]">Registro anterior ao controle de rodadas</span> : null}
        </div>
        <EapStatusBadge kind={status.kind} label={status.label} size="sm" />
      </div>
      <dl className="mt-2.5 flex flex-col gap-1.5 text-[8.5px] leading-[1.45] text-[#475467]">
        <Line label="Enviada">
          {round.submittedByName ?? "Não identificado"} · {submitted}
        </Line>
        {round.note ? <Line label="Observações">{round.note}</Line> : null}
        {round.decidedAt ? (
          <Line label="Decisão">
            {round.decidedByName ?? "Não identificado"} · {recordedDate(round.decidedAt)}
          </Line>
        ) : null}
        {round.decisionNote ? <Line label="Justificativa">{round.decisionNote}</Line> : null}
        {round.nonconformities ? <Line label="Inconformidades">{round.nonconformities}</Line> : null}
        {round.adjustments ? <Line label="Correções">{round.adjustments}</Line> : null}
        {round.resubmissionAuthorizedAt ? (
          <Line label="Reenvio autorizado">
            {round.resubmissionAuthorizedByName ?? "Não identificado"} · {recordedDate(round.resubmissionAuthorizedAt)}
            {round.resubmissionNote ? ` · ${round.resubmissionNote}` : ""}
          </Line>
        ) : null}
      </dl>
      {evidences ? (
        <div className="mt-2.5">
          {evidences.length > 0 ? <EvidenceLinks items={evidences} locked /> : <p className="text-[8px] text-[#98a2b3]">Nenhuma evidência vinculada a esta rodada.</p>}
        </div>
      ) : null}
    </article>
  );
}

function EvidenceLinks({ items, locked = false }: { items: EvidenceItem[]; locked?: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.id} className="grid min-h-[39px] grid-cols-[25px_minmax(0,1fr)_25px] items-center gap-2 rounded-[7px] border border-[#edf0f3] px-1.5 py-1">
          <span className="grid size-[25px] place-items-center rounded-[6px] bg-[#f0f3f6] text-[#52677e]">
            {locked ? <Lock className="size-3" aria-label="Bloqueada após o envio" /> : <FileText className="size-3.5" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-[9px] font-semibold text-[#344054]">{item.title}</strong>
            <span className="block text-[7.5px] text-[#98a2b3]">Registrada em {item.createdAt}</span>
          </span>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Consultar ${item.title}`}
            className="grid size-[25px] place-items-center rounded-[6px] text-[#667085] hover:bg-[#f2f4f7]"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
      <dt className="text-[#98a2b3]">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
        {label}
        <small className="text-[7.5px] font-normal text-[#98a2b3]">{hint}</small>
      </span>
      {children}
    </label>
  );
}

function Notice({ tone, text }: { tone: "warning" | "muted"; text: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-[7px] p-2.5 text-[8.5px] leading-[1.45]",
        tone === "warning" ? "bg-[#fff8e9] text-[#865516]" : "bg-[#f8f9fb] text-[#667085]",
      )}
    >
      <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

const inputClass = "h-[30px] min-w-0 rounded-[7px] border border-[#d7dce3] bg-white px-2 text-[9.5px] text-[#344054] outline-none focus-visible:border-[#8ab4eb] focus-visible:ring-2 focus-visible:ring-[#8ab4eb]/40";
const textareaClass = "min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]";
const secondaryButton = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[11px] text-[9px] font-semibold";
const primaryButton = "h-[30px] gap-[5px] rounded-[7px] bg-[#175cd3] px-[11px] text-[9px] font-semibold text-white hover:bg-[#144ca8]";
const groupLabel = "mb-1.5 block text-[8.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase";
const emptyInline = "flex min-h-[35px] items-center rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
