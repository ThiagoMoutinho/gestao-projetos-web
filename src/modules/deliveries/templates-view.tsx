"use client";

import { ChevronDown, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listDeliveryChecklistTemplates } from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import { canManageTemplates, NATURE_LABEL, NATURES, type Nature } from "@/modules/projects/delivery-compliance";

import { TemplateEditorDialog, type ChecklistTemplate } from "./template-editor-dialog";

const SHORT: Record<Nature, string> = { SISTEMAS: "Sistemas", INFRAESTRUTURA: "Infraestrutura", PROCESSOS: "Processos" };

type State = { status: "loading" } | { status: "ready"; templates: ChecklistTemplate[] } | { status: "error" };

const day = (value: string | null) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
};

/**
 * Aba Modelos de checklist: um modelo por natureza (Sistemas, Infraestrutura e Processos), com a revisão publicada, o rascunho (só para
 * quem gerencia) e o histórico de revisões. Dados e regras são os da Conformidade de Entrega: a lista vem do mesmo endpoint e a edição
 * usa o mesmo salvar/publicar. Ver é liberado a todos; editar, só a ADMIN e PMO (a API repete a regra).
 */
export function TemplatesView({ viewerRole }: { viewerRole: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [nature, setNature] = useState<Nature>("SISTEMAS");
  const [showDraft, setShowDraft] = useState(false);
  const [editing, setEditing] = useState(false);
  const manage = canManageTemplates({ globalRole: viewerRole });

  const reload = useCallback(async () => {
    try {
      const response = await listDeliveryChecklistTemplates();
      setState(response.status === 200 ? { status: "ready", templates: response.data.data } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega os modelos ao abrir a aba
    void reload();
  }, [reload]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Carregando modelos">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-6 w-80 max-w-full" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 py-6">
        <p className="text-sm text-muted-foreground">Não foi possível carregar os modelos de checklist.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const template = state.templates.find((entry) => entry.nature === nature);
  const draft = manage ? template?.draft ?? null : null;
  const viewing = showDraft && draft ? draft : template?.published ?? null;
  const required = viewing ? viewing.items.filter((item) => item.required).length : 0;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <p className="max-w-2xl text-body text-muted-foreground">
        Cada natureza tem um modelo de checklist. Ao criar uma versão de entrega, o checklist é copiado do modelo publicado e, depois disso, não muda mais.
      </p>

      <Tabs
        value={nature}
        onValueChange={(value) => {
          setNature(value as Nature);
          setShowDraft(false);
        }}
      >
        <TabsList aria-label="Natureza do modelo" className="w-full sm:w-auto">
          {NATURES.map((value) => (
            <TabsTrigger key={value} value={value} className="flex-1 px-4 sm:flex-none">
              {SHORT[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div key={`${nature}-${showDraft}`} className="motion-fade flex flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg leading-snug font-semibold tracking-[-0.01em]">{NATURE_LABEL[nature]}</h2>
            <p className="mt-1 text-body text-muted-foreground">
              {viewing
                ? showDraft && draft
                  ? "Rascunho em edição: ainda não vale para novas entregas."
                  : `Revisão ${viewing.revision} publicada${viewing.publishedAt ? ` em ${day(viewing.publishedAt)}` : ""}`
                : "Nenhuma revisão publicada."}
              {viewing?.isProposal ? <span className="text-status-attention-ink"> · Proposta sujeita à validação da CTIN</span> : null}
            </p>
            {draft && !showDraft ? <p className="mt-1 text-xs text-muted-foreground">Há um rascunho em edição, ainda não publicado.</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draft ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowDraft((value) => !value)}>
                {showDraft ? "Ver revisão publicada" : "Ver rascunho"}
              </Button>
            ) : null}
            {manage && template ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" /> Editar modelo
              </Button>
            ) : null}
          </div>
        </header>

        {viewing && viewing.items.length > 0 ? (
          <section aria-label="Documentos do modelo">
            <p className="mb-1 text-xs text-muted-foreground">
              {viewing.items.length} {viewing.items.length === 1 ? "documento" : "documentos"} · {required} {required === 1 ? "obrigatório" : "obrigatórios"}
            </p>
            <ol className="divide-y divide-border/60">
              {viewing.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {item.description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p> : null}
                  </div>
                  <span className={`shrink-0 pt-0.5 text-xs ${item.required ? "font-medium text-foreground" : "text-muted-foreground"}`}>{item.required ? "Obrigatório" : "Opcional"}</span>
                </li>
              ))}
            </ol>
            {viewing.notes ? <p className="mt-3 text-xs text-muted-foreground">Observações da revisão: {viewing.notes}</p> : null}
          </section>
        ) : (
          <p role="status" className="py-6 text-sm text-muted-foreground">
            {manage ? "Este modelo ainda não tem documentos. Use Editar modelo para montar o checklist." : "Este modelo ainda não tem documentos publicados."}
          </p>
        )}

        {template && template.revisions.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger className="group/rev flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground">
              Histórico de revisões ({template.revisions.length})
              <ChevronDown className="size-4 transition-transform duration-200 group-data-[panel-open]/rev:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
                {[...template.revisions]
                  .sort((a, b) => b.revision - a.revision)
                  .map((entry) => (
                    <li key={entry.revision}>
                      Revisão {entry.revision}
                      {entry.status === "RASCUNHO" ? " · rascunho" : entry.publishedAt ? ` · publicada em ${day(entry.publishedAt)}` : ""}
                      {entry.isProposal ? " · proposta" : ""}
                    </li>
                  ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      {editing && template ? <TemplateEditorDialog key={template.nature} template={template} onClose={() => setEditing(false)} onSaved={() => void reload()} /> : null}
    </div>
  );
}
