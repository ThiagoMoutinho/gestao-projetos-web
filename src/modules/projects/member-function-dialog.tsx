"use client";

import { Check, Loader2, Tag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/fetcher";
import { createProjectMemberFunction } from "@/lib/api/generated/participantes/participantes";
import { notifyError, notifySuccess } from "@/lib/feedback";

import { functionNameConflict, MEMBER_FUNCTION_NAME_MAX, MEMBER_FUNCTION_NAME_MIN, memberFunctionNameProblem } from "./team-editing";

export type MemberFunction = { id: string; name: string; isActive: boolean };

/**
 * Cria uma função do catálogo institucional (ex.: Stakeholder). Só ADMIN e PMO chegam aqui (a API barra os demais).
 * A função é só rótulo: quem a recebe tem o acesso de Observador. O nome não pode repetir outro, ignorando caixa e acento.
 */
export function MemberFunctionDialog({
  open,
  onClose,
  existing,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  existing: ReadonlyArray<{ name: string }>;
  onCreated: (created: MemberFunction) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const conflict = functionNameConflict(name, existing);
  const problem =
    memberFunctionNameProblem(name) ??
    (conflict === "role" ? "Esse nome já existe como papel na lista (ex.: Desenvolvedor)." : conflict === "function" ? "Já existe uma função com esse nome." : null);

  function close() {
    if (saving) return;
    setName("");
    setTouched(false);
    onClose();
  }

  async function submit() {
    setTouched(true);
    if (problem || saving) return;
    setSaving(true);
    try {
      const response = await createProjectMemberFunction({ name });
      if (response.status !== 201) throw new ApiError(response.status, "UNEXPECTED_STATUS", "Não foi possível criar a função.");
      onCreated(response.data);
      notifySuccess(`Função “${response.data.name}” criada. Ela já pode ser escolhida na lista de funções.`);
      setName("");
      setTouched(false);
      onClose();
    } catch (error) {
      const reason = error instanceof ApiError && error.status < 500 ? error.message : "Falha de conexão ou do servidor.";
      notifyError("Não foi possível criar a função.", `${reason} Nada foi alterado.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <EditDialogContent className="sm:max-w-lg">
        <EditDialogHeader
          icon={Tag}
          title="Nova função de participante"
          description="Cadastre uma função para todos os projetos."
          onClose={close}
          closeDisabled={saving}
        />
        <EditDialogBody>
          <form
            id="member-function-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor="member-function-name" className="text-body font-medium text-foreground">
              Nome da função *
            </label>
            <Input
              id="member-function-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={MEMBER_FUNCTION_NAME_MAX}
              placeholder="Ex.: Stakeholder"
              autoComplete="off"
              disabled={saving}
              aria-invalid={touched && Boolean(problem)}
              aria-describedby="member-function-help"
              autoFocus
            />
            <p id="member-function-help" className={touched && problem ? "text-label text-status-critical-ink" : "text-label text-muted-foreground"}>
              {touched && problem
                ? problem
                : `De ${MEMBER_FUNCTION_NAME_MIN} a ${MEMBER_FUNCTION_NAME_MAX} caracteres. A função é só um rótulo: quem a recebe continua com o acesso de leitura (Observador).`}
            </p>
          </form>
        </EditDialogBody>
        <EditDialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="member-function-form" disabled={saving || (touched && Boolean(problem))}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {saving ? "Criando…" : "Criar função"}
          </Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}
