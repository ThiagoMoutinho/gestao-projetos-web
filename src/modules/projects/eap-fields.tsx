import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric" | "text";
}) {
  const id = `field-${label}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function NoteField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `note-${label}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function StatusChoices<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <RadioGroup
      name={name}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className="gap-2"
    >
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          <RadioGroupItem value={option.value} />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  );
}

export function SaveRow({
  saving,
  error,
  feedback,
  onSave,
  extra,
}: {
  saving: boolean;
  error: string | null;
  feedback: string | null;
  onSave: (() => void) | null;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {feedback ? (
        <p className="text-sm text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
      {onSave ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={saving} onClick={onSave}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          {extra}
        </div>
      ) : null}
    </div>
  );
}

export function ReadOnlyNotice({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
