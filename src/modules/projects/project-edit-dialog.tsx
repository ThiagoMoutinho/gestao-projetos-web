"use client";

import { FolderPen } from "lucide-react";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { updateProject } from "@/lib/api/generated/projetos/projetos";
import { notifySuccess, reportFailure } from "@/lib/feedback";

type EditableProject = { id: string; name: string; description: string | null; glpiTicketId: string | null };

/**
 * Edição dos dados cadastrais do projeto (nome, descrição e chamado GLPI) pela edição já existente na API.
 * A situação não é editada aqui: ela é calculada pela EAP e o encerramento tem fluxo próprio.
 */
export function ProjectEditDialog({ project, open, onOpenChange }: { project: EditableProject; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [glpi, setGlpi] = useState(project.glpiTicketId ?? "");
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const changes = {
    ...(name.trim() !== project.name ? { name: name.trim() } : {}),
    ...(description.trim() !== (project.description ?? "") ? { description: description.trim() || null } : {}),
    ...(glpi.trim() !== (project.glpiTicketId ?? "") ? { glpiTicketId: glpi.trim() || null } : {}),
  };
  const changed = Object.keys(changes).length > 0;

  function reset(next: boolean) {
    if (busy) {
      return;
    }
    if (!next) {
      setName(project.name);
      setDescription(project.description ?? "");
      setGlpi(project.glpiTicketId ?? "");
      setNameError(null);
    }
    onOpenChange(next);
  }

  async function save() {
    if (busy || !changed) {
      return;
    }
    if (!name.trim()) {
      setNameError("Informe o nome do projeto.");
      return;
    }
    setBusy(true);
    try {
      const response = await updateProject(project.id, changes);
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível salvar o projeto.");
      }
      notifySuccess("Projeto atualizado.");
      onOpenChange(false);
      router.refresh();
    } catch (caught) {
      reportFailure(caught, "Não foi possível salvar o projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <EditDialogContent className="sm:max-w-[600px]">
        <EditDialogHeader
          icon={FolderPen}
          title="Editar projeto"
          description="Dados cadastrais do projeto. A situação é calculada pela EAP e o encerramento tem fluxo próprio."
          onClose={() => reset(false)}
          closeDisabled={busy}
        />
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <EditDialogBody>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground/80">Nome *</span>
            <Input
              value={name}
              maxLength={255}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "project-name-error" : undefined}
              className="h-10 text-xs"
            />
            <FieldError id="project-name-error" message={nameError} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground/80">Descrição</span>
            <Textarea value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} className="min-h-24 text-xs" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground/80">Chamado GLPI</span>
            <Input value={glpi} maxLength={50} onChange={(event) => setGlpi(event.target.value)} placeholder="Ex.: 351998" className="h-10 text-xs" />
          </label>
          </EditDialogBody>
          <EditDialogFooter>
            <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => reset(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10" disabled={!changed} loading={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </EditDialogFooter>
        </form>
      </EditDialogContent>
    </Dialog>
  );
}
