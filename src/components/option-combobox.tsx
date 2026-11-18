"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { controlFocusClassName, controlTransitionClassName } from "@/components/ui/control-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/**
 * Seleção múltipla com checkboxes (por exemplo, os responsáveis de uma tarefa, até 2). Mesma aparência dos demais
 * campos de seleção; a lista abre num painel com uma caixa por opção e, ao atingir `max`, as outras ficam desabilitadas.
 * A ordem dos `values` é a da escolha (o primeiro é o principal): desmarcar o primeiro promove o seguinte.
 */
export function OptionMultiCombobox({
  label,
  values,
  onChange,
  options,
  max,
  placeholder = "Selecione...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: {
  /** Nome acessível do campo. */
  label: string;
  values: ReadonlyArray<string>;
  onChange: (values: string[]) => void;
  options: ReadonlyArray<ComboOption>;
  /** Quantidade máxima de escolhas. */
  max: number;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [filter, setFilter] = useState("");
  const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;
  const shown = values.map(labelOf).join(", ");
  const term = filter.trim().toLocaleLowerCase("pt-BR");
  const visible = term ? options.filter((option) => option.label.toLocaleLowerCase("pt-BR").includes(term)) : options;
  const full = values.length >= max;

  function toggle(value: string, checked: boolean) {
    if (checked) {
      if (!values.includes(value) && values.length < max) {
        onChange([...values, value]);
      }
      return;
    }
    onChange(values.filter((item) => item !== value));
  }

  return (
    <Popover onOpenChange={(open) => { if (!open) setFilter(""); }}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[7px] border border-input bg-card px-3 text-left text-xs text-foreground outline-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground",
          controlFocusClassName,
          controlTransitionClassName,
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", values.length === 0 && "text-muted-foreground")}>{shown || placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-(--anchor-width) min-w-56 gap-1 rounded-[7px] p-1.5">
        {options.length > 6 ? (
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar..."
            aria-label={`Filtrar ${label}`}
            className="h-8 w-full rounded-[5px] border border-input bg-card px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        ) : null}
        <div role="group" aria-label={label} className="flex max-h-60 flex-col overflow-y-auto">
          {visible.length === 0 ? <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p> : null}
          {visible.map((option) => {
            const checked = values.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 py-1.5 text-xs text-foreground transition-colors duration-150 hover:bg-accent has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-transparent motion-reduce:transition-none"
              >
                <Checkbox checked={checked} disabled={!checked && full} onCheckedChange={(next) => toggle(option.value, next === true)} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
        <p className="border-t border-border/60 px-2 pt-1.5 text-[11px] text-muted-foreground" role="status">
          {values.length} de {max} selecionados{full ? " (limite atingido)" : ""}
        </p>
      </PopoverContent>
    </Popover>
  );
}
