"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string };

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
  compact = false,
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
  /** Lista no tamanho dos formulários da EAP (fonte de 10px), em vez do tamanho padrão do shadcn. */
  compact?: boolean;
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
        className={cn("w-full", className)}
      />
      <ComboboxContent className={compact ? "rounded-[7px]" : undefined}>
        <ComboboxEmpty className={compact ? "text-[10px]" : undefined}>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: ComboOption) => (
            <ComboboxItem
              key={option.value || "__vazio__"}
              value={option}
              className={compact ? "min-h-8 rounded-[5px] py-1.5 pl-2 text-[10px] text-[#344054] [&_svg:not([class*=size-])]:size-3.5" : undefined}
            >
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
