"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, Download, FileSpreadsheet, Flag, Folder, ListTodo, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/fetcher";
import { importEap } from "@/lib/api/generated/eap/eap";
import type { ImportEap200 } from "@/lib/api/generated/model/importEap200";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { formatCivilDate } from "./eap-date-field";
import { IMPORT_RULES, rowsFromTable, type ImportRow } from "./eap-import";
import { downloadImportTemplate, readImportTable } from "./eap-import-file";
import { civilDateInput } from "./eap-present";

type Step = "upload" | "preview" | "confirm";

const STEPS: ReadonlyArray<{ id: Step; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Pré-visualização" },
  { id: "confirm", label: "Confirmação" },
];

const KIND_LABEL = { PHASE: "Fase", TASK: "Tarefa", MILESTONE: "Marco" } as const;

/**
 * Importação inicial da EAP (projeto sem itens) por planilha em três etapas: o arquivo é lido no navegador, a API valida e
 * devolve a pré-visualização com os erros por linha, e só a confirmação grava (numa transação).
 */
export function EapImportSheet({
  projectId,
  open,
  onClose,
  onImported,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportEap200 | null>(null);
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName(null);
    setRows([]);
    setResult(null);
    setProblem(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function close() {
    if (busy === "importing") {
      return;
    }
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) {
      return;
    }
    setBusy("reading");
    setProblem(null);
    setFileName(file.name);
    try {
      const parsed = rowsFromTable(await readImportTable(file));
      if (parsed.problem) {
        setProblem(parsed.problem);
        return;
      }
      const response = await importEap(projectId, { fileName: file.name, rows: parsed.rows, confirm: false });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível validar a planilha.");
      }
      setRows(parsed.rows);
      setResult(response.data);
      setStep("preview");
    } catch (caught) {
      setProblem(caught instanceof ApiError ? reportFailure(caught, "Não foi possível validar a planilha.") : caught instanceof Error ? caught.message : "Não foi possível ler o arquivo.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmImport() {
    if (busy || !result?.valid) {
      return;
    }
    setBusy("importing");
    setProblem(null);
    try {
      const response = await importEap(projectId, { fileName, rows, confirm: true });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível importar a EAP.");
      }
      if (!response.data.committed) {
        // A EAP mudou desde a validação: volta para a pré-visualização com os novos erros.
        setResult(response.data);
        setStep("preview");
        setProblem("A EAP mudou desde a validação. Revise os erros antes de importar.");
        return;
      }
      const { summary } = response.data;
      notifySuccess(`EAP importada: ${summary.phases} fase(s), ${summary.tasks} tarefa(s) e ${summary.milestones} marco(s).`);
      await onImported();
      reset();
      onClose();
    } catch (caught) {
      setProblem(reportFailure(caught, "Não foi possível importar a EAP. Nenhum item foi gravado."));
    } finally {
      setBusy(null);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  const errorLines = new Set(result?.errors.map((error) => error.line) ?? []);

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(13,25,42,0.2)] supports-backdrop-filter:backdrop-blur-[1px]"
        className="w-full gap-0 overflow-hidden bg-white p-0 shadow-[0_18px_48px_rgba(16,24,40,0.16)] data-[side=right]:w-full data-[side=right]:sm:max-w-[min(920px,94vw)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-start justify-between gap-[15px] border-b border-[#e4e7ec] px-[22px] pt-6 pb-[18px]">
            <div className="min-w-0">
              <span className="mb-[9px] block text-[9px] leading-none font-bold tracking-[0.12em] text-[#3871bf] uppercase">Importação da EAP</span>
              <SheetTitle className="text-[17px] leading-[1.35] font-semibold text-[#172033]">Importar EAP por planilha</SheetTitle>
              <ol className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-semibold" aria-label="Etapas da importação">
                {STEPS.map((item, index) => {
                  const current = STEPS.findIndex((entry) => entry.id === step);
                  return (
                    <li key={item.id} className="flex items-center gap-2" aria-current={item.id === step ? "step" : undefined}>
                      <span
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-300",
                          index === current ? "bg-[#175cd3] text-white" : index < current ? "bg-[#e9f2ff] text-[#285da8]" : "bg-[#f2f4f7] text-[#98a2b3]",
                        )}
                      >
                        {index < current ? <Check className="size-3" aria-hidden="true" /> : <span>{index + 1}</span>}
                        {item.label}
                      </span>
                      {index < STEPS.length - 1 ? <ArrowRight className="size-3 text-[#d0d5dd]" aria-hidden="true" /> : null}
                    </li>
                  );
                })}
              </ol>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar painel" disabled={busy === "importing"} onClick={close}>
              <X />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-6 py-5">
            {problem ? (
              <p role="alert" className="motion-fade mb-4 flex items-start gap-2 rounded-[7px] border border-[#efc3bf] bg-[#fff4f1] px-3 py-2 text-[10.5px] leading-snug text-[#9f2219]">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {problem}
              </p>
            ) : null}

            {step === "upload" ? (
              <div key="upload" className="motion-fade flex flex-col gap-4">
                {busy === "reading" ? (
                  <div className="flex flex-col gap-3 rounded-[10px] border border-[#e4e7ec] bg-white p-5" role="status">
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-[#344054]">
                      <Spinner className="size-4" /> Lendo e validando {fileName}…
                    </span>
                    <Skeleton className="h-8 w-full rounded-[7px]" />
                    <Skeleton className="h-8 w-full rounded-[7px]" />
                    <Skeleton className="h-8 w-2/3 rounded-[7px]" />
                  </div>
                ) : (
                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border-2 border-dashed bg-white px-6 py-10 text-center transition-colors duration-200",
                      dragging ? "border-[#175cd3] bg-[#f5f9ff]" : "border-[#d0d5dd] hover:border-[#84adff]",
                    )}
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-[#e9f2ff] text-[#175cd3]">
                      <Upload className="size-5" aria-hidden="true" />
                    </span>
                    <strong className="text-[12px] text-[#172033]">Arraste a planilha ou clique para escolher</strong>
                    <span className="text-[10px] text-[#667085]">Arquivos .xlsx ou .csv, até 5 MB e 500 linhas</span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="sr-only"
                      onChange={(event) => void handleFile(event.target.files?.[0])}
                    />
                  </label>
                )}
                <section className="rounded-[10px] border border-[#e4e7ec] bg-white p-4">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold text-[#172033]">
                    <FileSpreadsheet className="size-4 text-[#157454]" aria-hidden="true" /> Modelo padrão
                  </h3>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[10px] leading-relaxed text-[#475467]">
                    <li>Uma linha por item: fase com código 1, 2…; tarefas e marcos da fase com 1.1, 1.2…</li>
                    {IMPORT_RULES.slice(0, 4).map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-[7px] text-[10px]" onClick={() => void downloadImportTemplate("xlsx").catch((caught) => reportFailure(caught, "Não foi possível gerar o modelo."))}>
                      <Download className="size-3.5" aria-hidden="true" /> Modelo .xlsx
                    </Button>
                    <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-[7px] text-[10px]" onClick={() => void downloadImportTemplate("csv")}>
                      <Download className="size-3.5" aria-hidden="true" /> Modelo .csv
                    </Button>
                  </div>
                </section>
              </div>
            ) : null}

            {step === "preview" && result ? (
              <div key="preview" className="motion-fade flex flex-col gap-4">
                <Summary result={result} fileName={fileName} />
                {result.errors.length > 0 ? (
                  <section role="alert" className="rounded-[10px] border border-[#efc3bf] bg-[#fff4f1] p-4">
                    <h3 className="flex items-center gap-2 text-[11px] font-semibold text-[#9f2219]">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      {result.errors.length} erro(s) encontrados. Corrija a planilha e envie novamente; nada será gravado.
                    </h3>
                    <ul className="mt-2 flex max-h-[220px] flex-col gap-1 overflow-y-auto text-[10px] leading-snug text-[#7a271a]">
                      {result.errors.map((error, index) => (
                        <li key={`${error.line}-${index}`}>
                          <strong>Linha {error.line}</strong>
                          {error.field ? ` · ${error.field}` : ""}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <p className="flex items-center gap-2 rounded-[10px] border border-[#bfe4d5] bg-[#f0faf6] px-4 py-3 text-[10.5px] text-[#157454]">
                    <Check className="size-4" aria-hidden="true" /> Nenhum erro encontrado. Revise os itens e continue para confirmar.
                  </p>
                )}
                {result.warnings.length > 0 ? (
                  <section role="status" className="rounded-[10px] border border-[#f3dcae] bg-[#fff8e9] p-4">
                    <h3 className="flex items-center gap-2 text-[11px] font-semibold text-[#865516]">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      {result.warnings.length} aviso(s): não impedem a importação.
                    </h3>
                    <ul className="mt-2 flex flex-col gap-1 text-[10px] leading-snug text-[#865516]">
                      {result.warnings.map((warning, index) => (
                        <li key={`${warning.line}-${index}`}>
                          <strong>Linha {warning.line}</strong>: {warning.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <PreviewTable result={result} errorLines={errorLines} />
              </div>
            ) : null}

            {step === "confirm" && result ? (
              <div key="confirm" className="motion-fade flex flex-col gap-4">
                <Summary result={result} fileName={fileName} />
                <section className="rounded-[10px] border border-[#e4e7ec] bg-white p-4 text-[10.5px] leading-relaxed text-[#475467]">
                  <h3 className="mb-2 text-[11px] font-semibold text-[#172033]">Confirme a importação</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5">
                    <li>
                      Serão criadas {result.summary.phases} fase(s), {result.summary.tasks} tarefa(s) e {result.summary.milestones} marco(s) nesta EAP, que está vazia.
                    </li>
                    <li>Cada fase recebe o planejamento informado na planilha, que também passa a ser a linha de base.</li>
                    {result.warnings.length > 0 ? <li>Há {result.warnings.length} aviso(s) de itens fora do período da fase; a divergência ficará sinalizada na EAP.</li> : null}
                    <li>Todos os itens são gravados de uma vez; se algo falhar, nada é gravado. A importação fica registrada no histórico do projeto.</li>
                  </ul>
                </section>
              </div>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-[7px] border-t border-[#e4e7ec] bg-white px-6 py-3 sm:min-h-[66px]">
            {step === "upload" ? (
              <Button type="button" variant="outline" className={secondaryButton} disabled={busy !== null} onClick={close}>
                Cancelar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className={secondaryButton}
                disabled={busy !== null}
                onClick={() => (step === "confirm" ? setStep("preview") : reset())}
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                {step === "confirm" ? "Voltar" : "Escolher outro arquivo"}
              </Button>
            )}
            {step === "preview" ? (
              <Button type="button" className={primaryButton} disabled={!result?.valid} onClick={() => setStep("confirm")}>
                Continuar <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
            {step === "confirm" ? (
              <Button type="button" className={primaryButton} loading={busy === "importing"} onClick={() => void confirmImport()}>
                <Check className="size-[15px]" aria-hidden="true" />
                {busy === "importing" ? "Importando…" : "Importar EAP"}
              </Button>
            ) : null}
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Summary({ result, fileName }: { result: ImportEap200; fileName: string | null }) {
  const cards = [
    { label: "Fases", value: result.summary.phases, icon: <Folder className="size-4" aria-hidden="true" />, tone: "bg-[#e9f2ff] text-[#2865b9]" },
    { label: "Tarefas", value: result.summary.tasks, icon: <ListTodo className="size-4" aria-hidden="true" />, tone: "bg-[#eef2f6] text-[#52677e]" },
    { label: "Marcos", value: result.summary.milestones, icon: <Flag className="size-4" aria-hidden="true" />, tone: "bg-[#f4ecfb] text-[#8b5bbb]" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {fileName ? <span className="truncate text-[10px] text-[#667085]">Arquivo: <strong className="text-[#344054]">{fileName}</strong></span> : null}
      <div className="grid grid-cols-3 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="flex items-center gap-2.5 rounded-[10px] border border-[#e4e7ec] bg-white p-3">
            <span className={cn("flex size-8 items-center justify-center rounded-[7px]", card.tone)}>{card.icon}</span>
            <span>
              <strong className="block text-[15px] leading-none text-[#172033]">{card.value}</strong>
              <span className="text-[9px] text-[#667085]">{card.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({ result, errorLines }: { result: ImportEap200; errorLines: Set<number> }) {
  const date = (value: string | null) => (value ? formatCivilDate(civilDateInput(value)) : "—");
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#e4e7ec] bg-white">
      <table className="w-full min-w-[680px] text-left text-[10px]">
        <thead className="bg-[#f8f9fb] text-[8.5px] font-semibold tracking-[0.04em] text-[#667085] uppercase">
          <tr>
            <th className="px-3 py-2">Linha</th>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Responsável</th>
            <th className="px-3 py-2">Início</th>
            <th className="px-3 py-2">Término</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={`${item.line}-${item.code}`} className={cn("border-t border-[#edf0f3]", errorLines.has(item.line) ? "bg-[#fff4f1]" : item.kind === "PHASE" ? "bg-[#fbfcfe]" : "")}>
              <td className="px-3 py-2 text-[#98a2b3]">{item.line}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="font-semibold text-[#344054]">{item.finalCode}</span>
                {item.finalCode !== item.code ? <span className="ml-1 text-[#98a2b3]">(planilha {item.code})</span> : null}
              </td>
              <td className="px-3 py-2">{KIND_LABEL[item.kind]}</td>
              <td className={cn("px-3 py-2 text-[#172033]", item.kind === "PHASE" ? "font-semibold" : "pl-6")}>{item.name}</td>
              <td className="px-3 py-2 text-[#475467]">
                {item.responsibleName ?? "—"}
                {item.reviewerName ? <span className="block text-[9px] text-[#98a2b3]">Valida: {item.reviewerName}</span> : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{date(item.plannedStartAt)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {date(item.plannedEndAt)}
                {item.kind === "PHASE" && (item.consolidatedStartAt || item.consolidatedEndAt) ? (
                  <span className="block text-[9px] text-[#98a2b3]">
                    Itens: {date(item.consolidatedStartAt)} a {date(item.consolidatedEndAt)}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.items.length === 0 ? <p className="px-3 py-4 text-[10px] text-[#667085]">Nenhum item reconhecido na planilha.</p> : null}
    </div>
  );
}

const secondaryButton = "h-9 gap-1.5 rounded-[7px] border-[#d7dce3] px-[13px] text-[11px] font-semibold text-[#344054]";
const primaryButton = "h-9 gap-1.5 rounded-[7px] bg-[#175cd3] px-[13px] text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:bg-[#144ca8]";
