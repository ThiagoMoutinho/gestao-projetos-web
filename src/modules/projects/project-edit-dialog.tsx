"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="w-[95vw] sm:max-w-[550px] max-h-[90vh] gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold text-[#101828]">Editar projeto</DialogTitle>
          <DialogDescription className="text-[12px] text-[#475467]">
            Dados cadastrais do projeto. A situação é calculada pela EAP e o encerramento tem fluxo próprio.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#475467]">Nome *</span>
            <Input
              value={name}
              maxLength={255}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "project-name-error" : undefined}
              className="h-9 text-[13px]"
            />
            <FieldError id="project-name-error" message={nameError} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#475467]">Descrição</span>
            <Textarea value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} className="min-h-[84px] text-[13px]" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#475467]">Chamado GLPI</span>
            <Input value={glpi} maxLength={50} onChange={(event) => setGlpi(event.target.value)} placeholder="Ex.: 351998" className="h-9 text-[13px]" />
          </label>
          <DialogFooter className="-mx-5 -mb-5 mt-1 px-5 py-3">
            <Button type="button" variant="outline" className="h-8 text-[12px]" disabled={busy} onClick={() => reset(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-8 text-[12px]" disabled={!changed} loading={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
