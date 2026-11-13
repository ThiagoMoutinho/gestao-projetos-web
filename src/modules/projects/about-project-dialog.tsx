"use client";

import { Briefcase, Building2, CircleAlert, Info, Loader2, Target, Users, X, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagsInput } from "@/components/ui/tags-input";
import { cn } from "@/lib/utils";

import { meaningfulText } from "./field-display";
import { ABOUT_KEYS, CONTEXT_KEYS, fieldOf, LABELS, maxLengthOf, NarrativeField, type ProfileKey, useProfileEditing } from "./institutional-about";
import { ResultsPanel } from "./institutional-results";
import { formatSectors, parseSectors } from "./institutional-sectors";
import { ExpandableText, type Overview } from "./institutional-shared";

export type AboutTab = "sistema" | "contexto" | "resultados";

type ResultsPanelProps = Parameters<typeof ResultsPanel>[0];

const ALL_KEYS: ProfileKey[] = [...ABOUT_KEYS, ...CONTEXT_KEYS, "RESULTS_SUMMARY"];

/** Rótulos das abas e o que cada uma reúne (mesmos campos que já existiam nos cartões Sobre, Contexto e Resultados). */
const TAB_LABEL: Record<AboutTab, string> = { sistema: "Sistema", contexto: "Contexto", resultados: "Resultados" };

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-card-title font-semibold text-foreground">
      <Icon className="size-5 text-foreground/80" aria-hidden="true" />
      {children}
    </h3>
  );
}

/** Campo de texto só para leitura (quem não edita o perfil, mas abriu o diálogo para ver ou gerenciar resultados). */
function ReadOnlyText({ label, value }: { label: string; value: string | null | undefined }) {
  const text = meaningfulText(value);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body font-medium text-foreground">{label}</p>
      {text ? <ExpandableText text={text} markdown lines={8} /> : <p className="text-body text-muted-foreground">Não informado</p>}
    </div>
  );
}

/**
 * Edição de "Sobre o projeto" em diálogo amplo, no mesmo padrão do diálogo da Equipe: identificação no topo e as abas
 * Sistema, Contexto e Resultados. Cada campo continua sendo salvo ao sair dele (mesma regra, validação, limite e
 * permissão de antes); por isso não há botão geral de salvar, só "Concluir". O diálogo é montado a cada abertura, então
 * sempre parte dos dados mais recentes da Visão Geral.
 */
export function AboutProjectDialog({
  projectId,
  data,
  results,
  initialTab,
  onChanged,
  onClose,
}: {
  projectId: string;
  data: Overview;
  results: Omit<ResultsPanelProps, "managing">;
  initialTab: AboutTab;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { canEdit, canRegisterResults } = data.permissions;
  const [tab, setTab] = useState<AboutTab>(initialTab);
  const scroller = useRef<HTMLDivElement>(null);
  const { values, setValues, saving, saved, failed, commit } = useProfileEditing({
    projectId,
    field: (key) => fieldOf(data, key),
    keys: ALL_KEYS,
    onChanged,
    initialEditing: true,
  });

  const narrative = (key: ProfileKey, label = LABELS[key]) =>
    canEdit ? (
      <NarrativeField
        key={key}
        label={label}
        value={values[key] ?? ""}
        onChange={(value) => setValues((previous) => ({ ...previous, [key]: value }))}
        onCommit={(value) => void commit(key, value)}
        maxLength={maxLengthOf(key)}
      />
    ) : (
      <ReadOnlyText key={key} label={label} value={fieldOf(data, key).published?.value} />
    );

  const shortField = (key: "REQUESTING_AREA" | "RESPONSIBLE_COMPANY", Icon: LucideIcon) => (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="flex items-center gap-2 text-body font-medium text-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {LABELS[key]}
      </span>
      {canEdit ? (
        <Input
          value={values[key] ?? ""}
          onChange={(event) => setValues((previous) => ({ ...previous, [key]: event.target.value }))}
          onBlur={() => void commit(key, values[key] ?? "")}
          maxLength={4000}
        />
      ) : (
        <span className="text-body text-muted-foreground">{fieldOf(data, key).published?.value ?? "Não informado"}</span>
      )}
    </label>
  );

  const status =
    saving > 0
      ? { icon: <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />, text: "Salvando…" }
      : failed
        ? {
            icon: <CircleAlert className="size-4 shrink-0 text-status-critical-ink" aria-hidden="true" />,
            text: `Não foi possível salvar "${LABELS[failed]}". O valor anterior foi mantido.`,
          }
        : saved
          ? { icon: <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />, text: "Alterações salvas e registradas no histórico do projeto." }
          : { icon: <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />, text: "Cada campo é salvo ao sair dele e fica registrado no histórico." };

  return (
    <Dialog open onOpenChange={(next) => (next || saving > 0 ? null : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(52rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-[24px] border border-border/70 bg-popover/95 p-0 shadow-[0_32px_64px_-24px_rgba(16,24,40,0.45)] backdrop-blur-xl sm:max-w-[920px]"
      >
        <DialogHeader className="flex-row shrink-0 items-start gap-4 border-b px-6 pt-6 pb-5 text-left sm:px-7">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary dark:bg-primary/20">
            <Info className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-page-title font-semibold tracking-tight text-foreground">
              {canEdit ? "Editar sobre o projeto" : "Sobre o projeto"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-body text-muted-foreground">
              Identificação, sistema, contexto e resultados para o IGEPPS. Cada campo é salvo ao sair dele e a alteração fica registrada no histórico do
              projeto.
            </DialogDescription>
          </div>
          <Button type="button" variant="outline" size="icon-sm" onClick={onClose} disabled={saving > 0} aria-label="Fechar" className="shrink-0">
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>

        {/* Única área de rolagem: cabeçalho e rodapé ficam fixos; o editor cresce com o texto (sem segunda barra) e a barra é fina e discreta. */}
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:color-mix(in_oklch,var(--foreground)_24%,transparent)_transparent] [scrollbar-width:thin] [&_.ProseMirror]:max-h-none [&_.ProseMirror]:overflow-y-visible"
        >
        <section aria-label="Identificação do projeto" className="flex flex-col gap-4 border-b px-6 py-5 sm:px-7">
          <SectionTitle icon={Building2}>Identificação</SectionTitle>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {shortField("REQUESTING_AREA", Building2)}
            {shortField("RESPONSIBLE_COMPANY", Briefcase)}
            <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
              <span className="flex items-center gap-2 text-body font-medium text-foreground">
                <Users className="size-4" aria-hidden="true" />
                {LABELS.BENEFITED_SECTORS}
              </span>
              {canEdit ? (
                <TagsInput
                  aria-label={LABELS.BENEFITED_SECTORS}
                  value={parseSectors(values.BENEFITED_SECTORS)}
                  onChange={(next) => {
                    const text = formatSectors(next);
                    setValues((previous) => ({ ...previous, BENEFITED_SECTORS: text }));
                    void commit("BENEFITED_SECTORS", text);
                  }}
                  placeholder="Digite o nome ou a sigla e pressione Enter"
                />
              ) : (
                <span className="text-body text-muted-foreground">{fieldOf(data, "BENEFITED_SECTORS").published?.value ?? "Não informado"}</span>
              )}
            </div>
          </div>
        </section>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as AboutTab);
            scroller.current?.scrollTo({ top: 0 });
          }}
          className="gap-0"
        >
          <div className="sticky top-0 z-10 border-b bg-popover px-6 sm:px-7">
            <TabsList variant="line" className="w-full justify-start gap-4">
              {(Object.keys(TAB_LABEL) as AboutTab[]).map((value) => (
                <TabsTrigger key={value} value={value} className="flex-none px-1">
                  {TAB_LABEL[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="sistema" className="motion-fade flex flex-col gap-4 px-6 py-5 sm:px-7">
            <SectionTitle icon={Info}>O que o sistema faz</SectionTitle>
            {narrative("SYSTEM_DESCRIPTION", "Descrição e principais funcionalidades")}
          </TabsContent>
          <TabsContent value="contexto" className="motion-fade flex flex-col gap-4 px-6 py-5 sm:px-7">
            <SectionTitle icon={CircleAlert}>Contexto e planejamento</SectionTitle>
            {CONTEXT_KEYS.map((key) => narrative(key))}
          </TabsContent>
          <TabsContent value="resultados" className="motion-fade flex flex-col gap-5 px-6 py-5 sm:px-7">
            <SectionTitle icon={Target}>Resultados para o IGEPPS</SectionTitle>
            {narrative("RESULTS_SUMMARY")}
            <ResultsPanel {...results} managing={canRegisterResults} />
          </TabsContent>
        </Tabs>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse items-stretch gap-3 border-t bg-popover/95 px-6 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span role="status" aria-live="polite" className={cn("flex items-center gap-2 text-body", failed && saving === 0 ? "text-status-critical-ink" : "text-muted-foreground")}>
            {status.icon}
            {status.text}
          </span>
          <span className="flex justify-end">
            <Button type="button" onClick={onClose} disabled={saving > 0}>
              {saving > 0 ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {saving > 0 ? "Salvando…" : "Concluir"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
