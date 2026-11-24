"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  listDeliveryChecklistTemplates,
  publishDeliveryChecklistDraft,
  saveDeliveryChecklistDraft,
} from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import type { ListDeliveryChecklistTemplates200DataItem } from "@/lib/api/generated/model/listDeliveryChecklistTemplates200DataItem";

import {
  draftError,
  draftPayload,
  NATURE_LABEL,
  NATURES,
  suggestDocumentType,
  toDraftItems,
  type DraftItem,
  type Nature,
} from "./delivery-compliance";
import { useAction } from "./institutional-shared";

type Template = ListDeliveryChecklistTemplates200DataItem;
type State = { status: "loading" } | { status: "ready"; templates: Template[] } | { status: "error" };

/**
 * Modelos de checklist por natureza (ADMIN e PMO). Edita o rascunho a partir da revisão publicada e publica uma nova
 * revisão: versões de entrega já criadas guardam a cópia do checklist e nunca mudam. Modelos de Infraestrutura e de
 * Processos são propostas até a CTIN validar (marcar a validação ao salvar retira a marca de proposta).
 */
export function DeliveryTemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [nature, setNature] = useState<Nature>("SISTEMAS");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [ctinValidated, setCtinValidated] = useState(false);
  const [touched, setTouched] = useState(false);

  const template = state.status === "ready" ? state.templates.find((entry) => entry.nature === nature) : undefined;
  const reload = useCallback(async () => {
    try {
      const response = await listDeliveryChecklistTemplates();
      setState(response.status === 200 ? { status: "ready", templates: response.data.data } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  }, []);
  const { busy, run } = useAction(() => void reload());

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega os modelos ao abrir
      void reload();
    }
  }, [open, reload]);

  // Ao trocar a natureza ou recarregar, o editor parte do rascunho (ou, sem rascunho, da revisão publicada).
  useEffect(() => {
    const source = template?.draft ?? template?.published;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o editor com o modelo carregado
    setItems(source ? toDraftItems(source.items) : []);
    setNotes(template?.draft?.notes ?? "");
    setCtinValidated(false);
    setTouched(false);
  }, [template]);

  const error = draftError(items);
  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function save(publish: boolean) {
    setTouched(true);
    if (error) return;
    await run(
      async () => {
        const saved = await saveDeliveryChecklistDraft(nature, draftPayload(items, notes, ctinValidated));
        if (saved.status !== 200) throw new Error("save");
        if (publish) {
          const published = await publishDeliveryChecklistDraft(nature);
          if (published.status !== 200) throw new Error("publish");
        }
      },
      publish ? "Nova revisão do modelo publicada." : "Rascunho do modelo salvo.",
      publish ? "Não foi possível publicar o modelo." : "Não foi possível salvar o rascunho.",
    );
  }

  const published = template?.published;

  return (
    <Dialog open={open} onOpenChange={(value) => (!value && !busy ? onClose() : undefined)}>
      <EditDialogContent className="sm:max-w-[760px]">
        <EditDialogHeader
          icon={ListChecks}
          title="Modelos de checklist da Conformidade de Entrega"
          description="Revisões publicadas para novas entregas."
          details="Publicar cria uma nova revisão. Versões de entrega já criadas mantêm o checklist copiado e não são alteradas."
          onClose={onClose}
          closeDisabled={busy}
        />

        <EditDialogBody>
        {state.status === "loading" ? (
          <Skeleton className="h-32 rounded-xl" aria-busy="true" aria-label="Carregando modelos" />
        ) : state.status === "error" ? (
          <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar os modelos.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Natureza</Label>
              <OptionCombobox label="Natureza" value={nature} onChange={(value) => setNature(value as Nature)} options={NATURES.map((value) => ({ value, label: NATURE_LABEL[value] }))} />
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {published ? <>Revisão publicada: {published.revision}</> : "Nenhuma revisão publicada."}
              {published?.isProposal ? <Badge variant="outline" className="h-5 px-1.5 text-xs">Proposta sujeita à validação da CTIN</Badge> : null}
              {template?.draft ? <Badge variant="outline" className="h-5 px-1.5 text-xs">Há rascunho em edição</Badge> : null}
            </p>

            <ul className="flex flex-col gap-2">
              {items.map((item, index) => (
                <li key={item.key} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Label htmlFor={`tpl-title-${item.key}`}>Documento {index + 1}</Label>
                      <Input
                        id={`tpl-title-${item.key}`}
                        value={item.title}
                        onChange={(event) =>
                          update(item.key, {
                            title: event.target.value,
                            // Documento novo acompanha o título; os já existentes mantêm o tipo para preservar o vínculo.
                            ...(item.existing ? {} : { documentType: suggestDocumentType(event.target.value) }),
                          })
                        }
                      />
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="mt-6" aria-label={`Remover documento ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  <Input aria-label={`Tipo do documento ${index + 1}`} value={item.documentType} className="font-mono text-xs" onChange={(event) => update(item.key, { documentType: event.target.value.toUpperCase() })} />
                  <Textarea aria-label={`Descrição do documento ${index + 1}`} value={item.description} placeholder="Descrição (opcional)" maxLength={1000} onChange={(event) => update(item.key, { description: event.target.value })} />
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={item.required} onCheckedChange={(value) => update(item.key, { required: value === true })} />
                    Obrigatório para homologar e encerrar
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setItems((current) => [...current, { key: `novo-${Date.now()}-${current.length}`, documentType: "", title: "", description: "", required: true, existing: false }])}
            >
              <Plus aria-hidden="true" /> Adicionar documento
            </Button>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-notes">Observações da revisão (opcional)</Label>
              <Textarea id="tpl-notes" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
            </div>
            {published?.isProposal ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={ctinValidated} onCheckedChange={(value) => setCtinValidated(value === true)} />
                A CTIN validou este checklist (retira a marca de proposta)
              </label>
            ) : null}
            {touched && error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          </>
        )}
        </EditDialogBody>

        <EditDialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Fechar</Button>
          <Button type="button" variant="outline" disabled={busy || state.status !== "ready"} onClick={() => void save(false)}>Salvar rascunho</Button>
          <Button type="button" disabled={busy || state.status !== "ready"} onClick={() => void save(true)}>Publicar revisão</Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}
