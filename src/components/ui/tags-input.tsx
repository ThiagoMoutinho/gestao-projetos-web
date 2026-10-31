"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { controlFocusClassName, controlTransitionClassName } from "./control-motion"

/**
 * Campo de etiquetas: o texto digitado vira uma etiqueta com Enter ou vírgula (ou ao sair do campo),
 * cada etiqueta pode ser removida e repetidos (sem diferenciar maiúsculas) são recusados com aviso.
 */
function TagsInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter",
  disabled = false,
  maxLength = 80,
  "aria-label": ariaLabel,
  className,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  "aria-label": string
  className?: string
}) {
  const [draft, setDraft] = React.useState("")
  const [notice, setNotice] = React.useState<string | null>(null)
  const noticeId = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)

  /** Acrescenta nomes de uma vez, recusando vazios e repetidos (sem diferenciar maiúsculas e minúsculas). */
  function addMany(raws: string[]) {
    const next = [...value]
    const repeated: string[] = []
    for (const raw of raws) {
      const name = raw.trim().replace(/s+/g, " ")
      if (!name) {
        continue
      }
      const key = name.toLocaleLowerCase("pt-BR")
      if (next.some((item) => item.toLocaleLowerCase("pt-BR") === key)) {
        repeated.push(name)
      } else {
        next.push(name)
      }
    }
    setNotice(repeated.length > 0 ? `${repeated.map((name) => `"${name}"`).join(", ")} já foi adicionado.` : null)
    if (next.length !== value.length) {
      onChange(next)
    }
  }

  function commit(raw: string) {
    addMany([raw])
    setDraft("")
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index))
    setNotice(null)
    inputRef.current?.focus()
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        data-slot="tags-input"
        className={cn(
          "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 dark:bg-input/30",
          controlTransitionClassName,
          controlFocusClassName,
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item, index) => (
          <Badge key={item.toLocaleLowerCase("pt-BR")} variant="secondary" className="h-5 gap-1 pr-1">
            <span className="max-w-40 truncate">{item}</span>
            <button
              type="button"
              aria-label={`Remover ${item}`}
              className="rounded-full p-px text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={(event) => {
                event.stopPropagation()
                remove(index)
              }}
            >
              <X className="size-2.5" strokeWidth={2} aria-hidden="true" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          maxLength={maxLength}
          aria-label={ariaLabel}
          aria-describedby={notice ? noticeId : undefined}
          placeholder={value.length === 0 ? placeholder : "Adicionar setor"}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            const text = event.target.value
            if (text.includes(",")) {
              const parts = text.split(",")
              const rest = parts.pop() ?? ""
              addMany(parts)
              setDraft(rest)
              return
            }
            setNotice(null)
            setDraft(text)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commit(draft)
            } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value.length - 1)
            }
          }}
          onBlur={() => commit(draft)}
        />
      </div>
      <p id={noticeId} role="status" className={cn("min-h-3 text-[10px] text-warning-foreground", !notice && "sr-only")}>
        {notice}
      </p>
    </div>
  )
}

export { TagsInput }
