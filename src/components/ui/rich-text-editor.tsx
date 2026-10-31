"use client";

import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Redo2, Undo2, Unlink } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markdownLength, safeUrl } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  /** Markdown persistido. */
  value: string;
  maxLength: number;
  onChange: (markdown: string) => void;
  /** Disparado ao sair do campo (e do popover de link); recebe o Markdown atual. */
  onCommit: (markdown: string) => void;
};

/**
 * Editor simplificado dos textos narrativos (Tiptap + componentes shadcn/ui). Lê e grava Markdown, então o
 * armazenamento continua sendo texto. Só os recursos da barra existem: não há HTML, imagens nem código.
 */
export default function RichTextEditor({ label, value, maxLength, onChange, onCommit }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => safeUrl(url) !== null,
        },
      }),
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class:
          "min-h-32 max-h-80 overflow-y-auto px-3 py-2.5 text-xs leading-relaxed text-foreground outline-none [&_h2]:mt-2 [&_h2]:mb-0.5 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_h3]:text-xs [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_li>p]:mb-0",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getMarkdown()),
  });

  const live = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            bullet: current.isActive("bulletList"),
            ordered: current.isActive("orderedList"),
            link: current.isActive("link"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
            length: markdownLength(current.getMarkdown()),
          }
        : null,
  });

  /** O seletor só atualiza após a primeira transação: até lá vale um estado neutro (sem ferramentas ativas). */
  const state = live ?? {
    bold: false,
    italic: false,
    h2: false,
    h3: false,
    bullet: false,
    ordered: false,
    link: false,
    canUndo: false,
    canRedo: false,
    length: markdownLength(value),
  };

  // Valor recarregado de fora (ex.: descartado após erro): sincroniza sem mexer enquanto o usuário digita.
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getMarkdown().trim() !== value.trim()) {
      editor.commands.setContent(value, { contentType: "markdown" });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="h-40 animate-pulse rounded-lg border bg-muted/40" aria-busy="true" aria-label={`Carregando editor: ${label}`} />;
  }

  const over = state.length > maxLength;
  const tool = (active: boolean, title: string, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <Button
      type="button"
      size="icon-xs"
      variant={active ? "secondary" : "ghost"}
      aria-label={title}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      className={cn("text-muted-foreground", active && "text-foreground")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <div
      data-rich-editor
      className="flex flex-col gap-1.5"
      // Salva quando o foco sai do conjunto editor + barra (passar do editor para a barra não conta como sair).
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onCommit(editor.getMarkdown());
        }
      }}
    >
      <span className="text-xs font-semibold text-[#475467]">{label}</span>
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20 motion-reduce:transition-none",
          over && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        )}
      >
        <div role="toolbar" aria-label={`Formatação: ${label}`} className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
          {tool(state.bold, "Negrito", () => editor.chain().focus().toggleBold().run(), <Bold />)}
          {tool(state.italic, "Itálico", () => editor.chain().focus().toggleItalic().run(), <Italic />)}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          {tool(state.h2, "Título", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 />)}
          {tool(state.h3, "Subtítulo", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 />)}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          {tool(state.bullet, "Lista com marcadores", () => editor.chain().focus().toggleBulletList().run(), <List />)}
          {tool(state.ordered, "Lista numerada", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered />)}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <LinkTool editor={editor} active={state.link} />
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          {tool(false, "Desfazer", () => editor.chain().focus().undo().run(), <Undo2 />, !state.canUndo)}
          {tool(false, "Refazer", () => editor.chain().focus().redo().run(), <Redo2 />, !state.canRedo)}
        </div>
        <EditorContent editor={editor} />
      </div>
      <p className={cn("text-right text-[11px] tabular-nums", over ? "font-semibold text-destructive" : "text-muted-foreground")} aria-live="polite">
        {state.length.toLocaleString("pt-BR")} / {maxLength.toLocaleString("pt-BR")}
        {over ? " · reduza o texto para salvar" : ""}
      </p>
    </div>
  );
}

function LinkTool({ editor, active }: { editor: NonNullable<ReturnType<typeof useEditor>>; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);

  function apply() {
    const safe = safeUrl(url);
    if (!safe) {
      setInvalid(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
          setInvalid(false);
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="icon-xs"
            variant={active ? "secondary" : "ghost"}
            aria-label="Link"
            title="Link"
            aria-pressed={active}
            className="text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      >
        <Link2 />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Endereço do link
          <Input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
            placeholder="https://…"
            aria-invalid={invalid || undefined}
            className="h-9 text-xs md:text-xs"
          />
        </label>
        {invalid ? <p className="text-xs text-destructive">Use um endereço http, https ou mailto válido.</p> : null}
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!active}
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setOpen(false);
            }}
          >
            <Unlink /> Remover
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
