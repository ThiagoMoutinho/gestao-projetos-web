"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { controlTransitionClassName } from "@/components/ui/control-motion";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string };

/**
 * Aparência única de todo campo de seleção do sistema (a mesma da tela Editar Tarefa): altura, borda, fonte, ícone e foco.
 * Não sobrescreva altura, raio ou fonte nos usos; `className` serve só para largura e posição.
 */
const COMBOBOX_CONTROL_CLASS = [
  "h-10 rounded-[7px] border-input bg-card has-disabled:bg-muted/50 has-disabled:opacity-100",
  "[&_input]:px-3 [&_input]:text-xs [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input:disabled]:text-muted-foreground",
  "[&_[data-slot=input-group-button]_svg]:size-3.5 [&_[data-slot=input-group-button]_svg]:text-muted-foreground",
  "has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-4 has-[[data-slot=input-group-control]:focus-visible]:ring-primary/20",
  controlTransitionClassName,
].join(" ");

/**
 * Seleção única com o Combobox do shadcn: mostra o rótulo da opção escolhida e filtra a lista
 * pelo que é digitado. O valor "" é uma opção comum (ex.: "Sem responsável" ou "Todos").
 */
export function OptionCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  clearable = false,
  invalid = false,
  describedBy,
  className,
}: {
  /** Nome acessível do campo. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<ComboOption>;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Mostra o botão de limpar quando há valor; limpar devolve "". */
  clearable?: boolean;
  /** Campo com erro de validação: destaca a borda e liga a mensagem pelo id em describedBy. */
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(next: ComboOption | null) => onChange(next?.value ?? "")}
      itemToStringLabel={(option: ComboOption) => option.label}
      isItemEqualToValue={(item: ComboOption, current: ComboOption) => item.value === current.value}
      disabled={disabled}
    >
      <ComboboxInput
        aria-label={label}
        placeholder={placeholder}
        disabled={disabled}
        showClear={clearable && selected !== null}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        className={cn(COMBOBOX_CONTROL_CLASS, "w-full", className)}
      />
      <ComboboxContent className="rounded-[7px]">
        <ComboboxEmpty className="text-xs">{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: ComboOption) => (
            <ComboboxItem
              key={option.value || "__vazio__"}
              value={option}
              className="min-h-9 rounded-[5px] py-1.5 pl-2 text-xs text-foreground [&_svg:not([class*=size-])]:size-3.5"
            >
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
