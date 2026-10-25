"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { ptBR } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { controlFocusClassName, controlTransitionClassName } from "@/components/ui/control-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const dateControlClass = `h-9 w-full rounded-[7px] border border-[#d7dce3] bg-white px-2.5 text-[10px] text-[#344054] outline-none disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#98a2b3] ${controlTransitionClassName} ${controlFocusClassName}`;

/** Campo de data civil (AAAA-MM-DD) com calendário em português. */
export function DateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
        {label}
        {hint ? <small className="text-[7.5px] font-normal text-[#98a2b3]">{hint}</small> : null}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={label}
              className={`${dateControlClass} justify-start px-2.5 font-normal shadow-none hover:bg-white ${value ? "text-[#344054]" : "text-[#98a2b3]"}`}
            />
          }
        >
          <CalendarIcon />
          {value ? formatCivilDate(value) : "Não informada"}
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[80] w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={civilToDate(value)}
            onSelect={(date) => {
              onChange(date ? formatCivilValue(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function formatCivilDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "Não informada";
  }

  return `${day}/${month}/${year}`;
}

function civilToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function formatCivilValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
