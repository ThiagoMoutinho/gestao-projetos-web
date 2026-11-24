"use client";

import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publishDeliveryChecklistDraft, saveDeliveryChecklistDraft } from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import type { ListDeliveryChecklistTemplates200DataItem } from "@/lib/api/generated/model/listDeliveryChecklistTemplates200DataItem";
import { draftError, draftPayload, NATURE_LABEL, suggestDocumentType, toDraftItems, type DraftItem } from "@/modules/projects/delivery-compliance";
import { useAction } from "@/modules/projects/institutional-shared";

export type ChecklistTemplate = ListDeliveryChecklistTemplates200DataItem;

let counter = 0;
const newKey = () => `novo-${Date.now()}-${(counter += 1)}`;

/**
 * Editor do modelo de checklist de uma natureza. Parte do rascunho em edição ou, sem rascunho, da revisão publicada. "Salvar rascunho"
 * guarda sem valer para novas entregas; "Publicar revisão" cria uma nova revisão (as anteriores e os checklists já copiados para as
 * entregas nunca mudam). A identificação (tipo) de um documento existente é preservada; só documentos novos a recebem do título.
 * As regras de validação e o payload são os mesmos da Conformidade de Entrega do projeto (`delivery-compliance.ts`).
 */
export function TemplateEditorDialog({
  template,
  onClose,
  onSaved,
}: {
  template: ChecklistTemplate;
  onClose: () => void;
  /** Chamado após salvar ou publicar, para a lista recarregar. */
  onSaved: () => void;
}) {
  const source = template.draft ?? template.published;
  const [items, setItems] = useState<DraftItem[]>(() => (source ? toDraftItems(source.items) : []));
  const [notes, setNotes] = useState(template.draft?.notes ?? "");
  const [ctinValidated, setCtinValidated] = useState(false);
  const [touched, setTouched] = useState(false);
  const { busy, run } = useAction(onSaved);

  const error = draftError(items);
  const update = (key: string, patch: Partial<DraftItem>) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const move = (index: number, step: -1 | 1) =>
    setItems((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  async function save(publish: boolean) {
    setTouched(true);
    if (error) return;
    const done = await run(
      async () => {
        const saved = await saveDeliveryChecklistDraft(template.nature, draftPayload(items, notes, ctinValidated));
        if (saved.status !== 200) throw new Error("save");
        if (publish) {
          const published = await publishDeliveryChecklistDraft(template.nature);
          if (published.status !== 200) throw new Error("publish");
        }
      },
      publish ? "Nova revisão do modelo publicada." : "Rascunho do modelo salvo.",
      publish ? "Não foi possível publicar o modelo." : "Não foi possível salvar o rascunho.",
    );
    if (done && publish) onClose();
  }

  const published = template.published;
  const origin = template.draft ? "do rascunho em edição" : published ? `da revisão ${published.revision}, publicada` : "de um modelo vazio";

  return (
    <Dialog open onOpenChange={(value) => (!value && !busy ? onClose() : undefined)}>
      <EditDialogContent className="sm:max-w-[720px]">
        <EditDialogHeader
          icon={ListChecks}
          title={`Modelo · ${NATURE_LABEL[template.nature]}`}
          description="Rascunho e publicação de revisão."
          details="Salvar guarda um rascunho. Publicar cria uma nova revisão para as próximas entregas; as anteriores não mudam."
          onClose={onClose}
          closeDisabled={busy}
        />

        <EditDialogBody>
          <p className="text-xs text-muted-foreground">Você está editando a partir {origin}.</p>

          <ol className="flex flex-col divide-y divide-border/60">
            {items.map((item, index) => (
              <li key={item.key} className="flex flex-col gap-2.5 py-4 first:pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums" aria-hidden="true">{index + 1}</span>
                  <Input
                    aria-label={`Título do documento ${index + 1}`}
                    value={item.title}
                    placeholder="Título do documento"
                    onChange={(event) =>
                      update(item.key, {
                        title: event.target.value,
                        // Documento novo acompanha o título; os já existentes mantêm o tipo para preservar o vínculo.
                        ...(item.existing ? {} : { documentType: suggestDocumentType(event.target.value) }),
                      })
                    }
                  />
                </div>
                <Textarea
                  aria-label={`Descrição do documento ${index + 1}`}
                  value={item.description}
                  placeholder="Descrição (opcional)"
                  maxLength={1000}
                  rows={2}
                  className="sm:ml-7 sm:w-[calc(100%-1.75rem)]"
                  onChange={(event) => update(item.key, { description: event.target.value })}
                />
                <div className="flex items-center justify-between gap-3 sm:ml-7">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={item.required} onCheckedChange={(value) => update(item.key, { required: value === true })} />
                    Obrigatório para homologar
                  </label>
                <div className="flex shrink-0 items-center">
                  <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label={`Mover o documento ${index + 1} para cima`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label={`Mover o documento ${index + 1} para baixo`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label={`Remover o documento ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                </div>
                <div className="sm:ml-7">
                  {item.existing ? (
                    <span className="font-mono text-xs text-muted-foreground" title="Identificação do documento, preservada entre as revisões">{item.documentType}</span>
                  ) : (
                    <Input
                      aria-label={`Identificação do documento ${index + 1}`}
                      value={item.documentType}
                      placeholder="IDENTIFICACAO"
                      className="h-8 w-full font-mono text-xs sm:w-80"
                      onChange={(event) => update(item.key, { documentType: event.target.value.toUpperCase() })}
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>

          <Button type="button" variant="ghost" size="sm" className="self-start text-primary" onClick={() => setItems((current) => [...current, { key: newKey(), documentType: "", title: "", description: "", required: true, existing: false }])}>
            <Plus aria-hidden="true" /> Adicionar documento
          </Button>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-notes">Observações da revisão (opcional)</Label>
            <Textarea id="tpl-notes" value={notes} maxLength={2000} rows={2} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {published?.isProposal ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ctinValidated} onCheckedChange={(value) => setCtinValidated(value === true)} />
              A CTIN validou este checklist (retira a marca de proposta)
            </label>
          ) : null}
        </EditDialogBody>

        <EditDialogFooter status={touched && error ? error : undefined} statusClassName="text-destructive">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)}>Salvar rascunho</Button>
          <Button type="button" disabled={busy} onClick={() => void save(true)}>Publicar revisão</Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}
