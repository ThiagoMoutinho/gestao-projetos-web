import { useCallback, useState } from "react";

/**
 * Mensagem de validação logo abaixo do campo. O campo correspondente recebe aria-invalid e
 * aria-describedby com o mesmo id; erros de operação e da API ficam no Sonner, nunca aqui.
 */
export function FieldError({ id, message }: { id: string; message: string | null | undefined }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} role="alert" className="motion-fade text-[10px] leading-snug text-destructive">
      {message}
    </p>
  );
}

/** Região do formulário que disparou o envio: o foco não salta para campos de outro painel aberto. */
const FORM_SCOPE = 'form, [role="dialog"], [role="alertdialog"]';

/**
 * Leva o foco ao primeiro campo marcado como inválido (ordem do DOM = ordem visual do formulário),
 * depois que a renderização aplicou o aria-invalid. Cobre Input, Textarea, Combobox (o input interno)
 * e os campos de data (o botão que abre o calendário).
 */
function focusFirstInvalid(origin: Element | null) {
  requestAnimationFrame(() => {
    const scope = origin?.closest(FORM_SCOPE) ?? document;
    const field = scope.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled])');
    field?.focus();
  });
}

/**
 * Erros de validação por campo. `validate` recebe as regras na ordem dos campos e marca todos os
 * inválidos de uma vez (retorna false se houver algum) e leva o foco ao primeiro deles;
 * `clear` remove o erro quando o campo muda.
 */
export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});

  const validate = useCallback((rules: ReadonlyArray<[K, string | false | null | undefined]>) => {
    const found: Partial<Record<K, string>> = {};
    for (const [key, message] of rules) {
      if (message && !found[key]) {
        found[key] = message;
      }
    }
    setErrors(found);
    const valid = Object.keys(found).length === 0;
    if (!valid && typeof document !== "undefined") {
      focusFirstInvalid(document.activeElement);
    }
    return valid;
  }, []);

  const clear = useCallback((key: K) => {
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }, []);

  const reset = useCallback(() => setErrors({}), []);

  return { errors, validate, clear, reset };
}
