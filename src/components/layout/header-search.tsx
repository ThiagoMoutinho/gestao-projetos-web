"use client";

import {
  AlertOctagon,
  ClipboardList,
  CornerDownLeft,
  FileText,
  Flag,
  FolderKanban,
  Layers,
  ListChecks,
  Package,
  Paperclip,
  Search,
  SearchX,
  Target,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { EapStatusBadge } from "@/modules/projects/eap-status-badge";
import { projectStatusKind, projectStatusLabel } from "@/modules/projects/project-status";
import { groupResults, KIND_LABEL, resultHref, resultKey, WORKSPACE_MIN_QUERY, type WorkspaceKind, type WorkspaceResult } from "@/modules/search/workspace-search";

import { type AccessibleProject, useAccessibleProjects } from "./accessible-projects";
import { useWorkspaceSearch } from "./use-workspace-search";

/** Projetos abertos por último (só ids, guardados neste navegador) para a lista "Recentes". */
const RECENT_KEY = "igepps:recent-projects";
const RECENT_MAX = 4;

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/** Texto sem acentos para a busca casar com ou sem acentuação. */
function plain(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((item) => item !== id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Sem armazenamento (janela privada, bloqueio): a lista de recentes simplesmente não é guardada.
  }
}

/**
 * Busca por palavras, sem acento e em qualquer ordem, no nome, no código GLPI e no identificador do projeto.
 * Devolve uma nota para ordenar: 3 = o nome começa com o termo, 2 = palavra do nome ou o id começa com ele,
 * 1 = apenas contém; 0 = não casa.
 */
function score(project: AccessibleProject, tokens: string[]) {
  if (tokens.length === 0) {
    return 1;
  }
  const name = plain(project.name);
  const glpi = project.glpiTicketId ? plain(project.glpiTicketId) : "";
  const id = plain(project.id);
  const haystack = `${name} ${glpi} ${id}`;
  if (!tokens.every((token) => haystack.includes(token.replace(/^#/, "")))) {
    return 0;
  }
  const first = tokens[0].replace(/^#/, "");
  if (name.startsWith(first)) {
    return 3;
  }
  if (id.startsWith(first) || name.split(/\s+/).some((word) => word.startsWith(first))) {
    return 2;
  }
  return 1;
}

/** Destaca no texto os trechos que casam com os termos digitados (sem acento), mantendo o texto original. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const parts = useMemo(() => {
    const clean = tokens.map((token) => token.replace(/^#/, "")).filter(Boolean);
    if (clean.length === 0) {
      return null;
    }
    // Mapeia caractere a caractere, para os índices do texto sem acento valerem no texto original.
    const chars = Array.from(text);
    const folded = chars.map((char) => plain(char));
    if (folded.some((char) => char.length !== 1)) {
      return null;
    }
    const flat = folded.join("");
    const marked = new Array<boolean>(chars.length).fill(false);
    for (const token of clean) {
      let from = flat.indexOf(token);
      while (from !== -1) {
        for (let index = from; index < from + token.length; index += 1) {
          marked[index] = true;
        }
        from = flat.indexOf(token, from + token.length);
      }
    }
    const result: { value: string; on: boolean }[] = [];
    chars.forEach((char, index) => {
      const last = result[result.length - 1];
      if (last && last.on === marked[index]) {
        last.value += char;
      } else {
        result.push({ value: char, on: marked[index] });
      }
    });
    return result;
  }, [text, tokens]);

  if (!parts || !parts.some((part) => part.on)) {
    return <>{text}</>;
  }
  return (
    <>
      {parts.map((part, index) =>
        part.on ? (
          <mark key={index} className="rounded-[3px] bg-primary/25 px-px font-semibold text-foreground">
            {part.value}
          </mark>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-label leading-none">{keys}</kbd>
      {label}
    </span>
  );
}

function ResultItem({
  project,
  tokens,
  current,
  onSelect,
}: {
  project: AccessibleProject;
  tokens: string[];
  current: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <CommandItem value={project.id} onSelect={() => onSelect(project.id)} className="gap-3 py-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors duration-200 group-data-selected/command-item:border-primary/40 group-data-selected/command-item:bg-primary/15 group-data-selected/command-item:text-primary motion-reduce:transition-none"
        aria-hidden="true"
      >
        <FolderKanban className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-body font-medium text-foreground">
          <Highlight text={project.name} tokens={tokens} />
        </span>
        <span className="truncate text-label text-muted-foreground">
          {project.glpiTicketId ? (
            <>
              GLPI #<Highlight text={project.glpiTicketId} tokens={tokens} />
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          ID <Highlight text={project.id} tokens={tokens} />
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 max-sm:hidden">
        {current ? <span className="rounded-full border border-primary/40 px-2 py-0.5 text-label leading-none text-primary">Aberto agora</span> : null}
        <EapStatusBadge size="sm" kind={projectStatusKind(project.status)} label={projectStatusLabel(project.status)} />
      </span>
      <CornerDownLeft
        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-data-selected/command-item:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </CommandItem>
  );
}

/** Ícone de cada tipo de resultado da busca global. */
const KIND_ICON: Record<WorkspaceKind, LucideIcon> = {
  PROJECT: FolderKanban,
  GLPI: Ticket,
  MINUTES: FileText,
  PHASE: Layers,
  TASK: ListChecks,
  MILESTONE: Flag,
  EVIDENCE: Paperclip,
  DELIVERY: Package,
  PROFILE: ClipboardList,
  RESULT: Target,
  IMPEDIMENT: AlertOctagon,
  PERSON: UserRound,
};

/** Resultado da busca no servidor (chamado, ata, item da EAP, entrega, texto, impedimento ou pessoa). */
function WorkspaceItem({ item, tokens, onSelect }: { item: WorkspaceResult; tokens: string[]; onSelect: (item: WorkspaceResult) => void }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <CommandItem value={resultKey(item)} onSelect={() => onSelect(item)} className="gap-3 py-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors duration-200 group-data-selected/command-item:border-primary/40 group-data-selected/command-item:bg-primary/15 group-data-selected/command-item:text-primary motion-reduce:transition-none"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-body font-medium text-foreground">
          <span className="sr-only">{KIND_LABEL[item.kind]}: </span>
          <Highlight text={item.title} tokens={tokens} />
        </span>
        {item.detail ? (
          <span className="truncate text-label text-muted-foreground">
            <Highlight text={item.detail} tokens={tokens} />
          </span>
        ) : null}
      </span>
      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-label leading-none text-muted-foreground max-sm:hidden" aria-hidden="true">
        {KIND_LABEL[item.kind]}
      </span>
      <CornerDownLeft
        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-data-selected/command-item:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </CommandItem>
  );
}

function ResultsSkeleton() {
  return (
    <div role="status" aria-label="Carregando projetos" className="flex flex-col gap-1 p-2">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="size-9 rounded-lg motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-1/4 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Busca da barra superior: gatilho + Command Palette (CommandDialog). Somente projetos acessíveis ao usuário, por nome,
 * código GLPI e identificador (por palavras, sem acento, com o trecho encontrado em destaque). Com o campo vazio mostra
 * os projetos abertos por último. O atalho "/" abre e foca a busca, exceto quando o foco já está num campo de texto.
 */
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, status } = useAccessibleProjects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || isEditable(event.target)) {
        return;
      }
      event.preventDefault();
      setRecentIds(readRecent());
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setRecentIds(readRecent());
    } else {
      setQuery("");
    }
  }

  function select(id: string) {
    rememberRecent(id);
    changeOpen(false);
    router.push(`/projetos/${id}`);
  }

  const tokens = useMemo(() => plain(query).split(/\s+/).filter(Boolean), [query]);
  const searching = tokens.length > 0;
  const currentId = /^\/projetos\/([^/]+)/.exec(pathname)?.[1] ?? null;

  const results = useMemo(() => {
    const list = projects ?? [];
    if (!searching) {
      return list;
    }
    return list
      .map((project) => ({ project, rank: score(project, tokens) }))
      .filter((entry) => entry.rank > 0)
      .sort((left, right) => right.rank - left.rank || left.project.name.localeCompare(right.project.name, "pt-BR"))
      .map((entry) => entry.project);
  }, [projects, searching, tokens]);

  const recents = useMemo(() => {
    if (searching) {
      return [];
    }
    return recentIds.map((id) => (projects ?? []).find((project) => project.id === id)).filter((project): project is AccessibleProject => Boolean(project));
  }, [projects, recentIds, searching]);
  const others = useMemo(() => (searching ? results : results.filter((project) => !recents.some((recent) => recent.id === project.id))), [results, recents, searching]);

  // Busca no servidor (chamados GLPI, atas, EAP, evidências, entregas, textos, impedimentos e pessoas), além dos projetos locais.
  const remote = useWorkspaceSearch(query, open);
  const localIds = useMemo(() => new Set(results.map((project) => project.id)), [results]);
  const remoteGroups = useMemo(
    () => groupResults(remote.items, (item) => item.kind === "PROJECT" && localIds.has(item.id)),
    [remote.items, localIds],
  );
  const remoteCount = remoteGroups.reduce((sum, group) => sum + group.items.length, 0);
  const remoteSearching = searching && query.trim().length >= WORKSPACE_MIN_QUERY;
  const nothing = results.length === 0 && remoteCount === 0;

  function selectResult(item: WorkspaceResult) {
    changeOpen(false);
    router.push(resultHref(item));
  }

  const total = (projects ?? []).length;
  const footerCount =
    status !== "ready"
      ? null
      : searching
        ? `${results.length + remoteCount} ${results.length + remoteCount === 1 ? "resultado" : "resultados"}`
        : `${total} ${total === 1 ? "projeto" : "projetos"}`;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => changeOpen(true)}
        aria-label="Buscar projetos (atalho: barra)"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="h-[47px] w-full max-w-[600px] justify-start gap-3 border border-bar-border bg-bar-foreground/10 px-4 text-body font-normal text-bar-muted transition-colors duration-200 hover:bg-bar-foreground/15 hover:text-bar-foreground focus-visible:ring-bar-foreground/60 max-sm:size-[41px] max-sm:w-[41px] max-sm:justify-center max-sm:px-0 motion-reduce:transition-none"
      >
        <Search className="size-[17px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left max-sm:hidden">Buscar projetos por nome, GLPI ou identificador</span>
        <kbd className="rounded border border-bar-border px-2 py-0.5 font-sans text-label leading-none text-bar-muted max-sm:hidden">/</kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Buscar projetos"
        description="Pesquise os projetos que você pode acessar por nome, código GLPI ou identificador."
        className="dark sm:max-w-xl"
      >
        {/* O filtro e a ordem são feitos aqui (por palavras, sem acento); o cmdk cuida só do teclado e da seleção. */}
        <Command shouldFilter={false} loop>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar projetos, chamados GLPI, atas, tarefas…" />
          <CommandList className="max-h-[min(24rem,50svh)]">
            {status === "loading" ? (
              <ResultsSkeleton />
            ) : status === "error" ? (
              <div role="alert" className="px-4 py-6 text-center text-body text-muted-foreground">
                Não foi possível carregar os projetos. Tente novamente mais tarde.
              </div>
            ) : nothing && !(remoteSearching && remote.status === "loading") ? (
              <div role="status" className="motion-fade flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-body font-medium text-foreground">
                  {searching ? <>Nada encontrado para “{query.trim()}”</> : "Nenhum projeto disponível"}
                </p>
                <p className="text-label text-muted-foreground">
                  {remote.status === "error"
                    ? "A busca completa não respondeu agora; só os projetos foram consultados."
                    : searching
                      ? "Confira o nome, o número do chamado GLPI, o identificador ou outra palavra do texto."
                      : "Os projetos aos quais você tem acesso aparecerão aqui."}
                </p>
              </div>
            ) : (
              <div className="motion-fade">
                {recents.length > 0 ? (
                  <CommandGroup heading="Recentes">
                    {recents.map((project) => (
                      <ResultItem key={project.id} project={project} tokens={tokens} current={project.id === currentId} onSelect={select} />
                    ))}
                  </CommandGroup>
                ) : null}
                {others.length > 0 ? (
                  <CommandGroup heading={searching ? "Projetos" : recents.length > 0 ? "Todos os projetos" : "Projetos"}>
                    {others.map((project) => (
                      <ResultItem key={project.id} project={project} tokens={tokens} current={project.id === currentId} onSelect={select} />
                    ))}
                  </CommandGroup>
                ) : null}
                {remoteGroups.map((group) => (
                  <CommandGroup key={group.heading} heading={group.heading}>
                    {group.items.map((entry) => (
                      <WorkspaceItem key={resultKey(entry)} item={entry} tokens={tokens} onSelect={selectResult} />
                    ))}
                  </CommandGroup>
                ))}
                {remoteSearching && remote.status === "loading" ? (
                  <div role="status" aria-label="Pesquisando em atas, chamados e itens" className="motion-fade flex flex-col gap-1 p-2">
                    <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
                    <Skeleton className="h-10 w-full rounded-lg motion-reduce:animate-none" />
                  </div>
                ) : null}
                {remoteSearching && remote.status === "error" ? (
                  <p role="status" className="px-4 py-3 text-label text-muted-foreground">
                    A busca completa não respondeu agora; só os projetos foram consultados.
                  </p>
                ) : null}
              </div>
            )}
          </CommandList>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-label text-muted-foreground">
            <span className="flex flex-wrap items-center gap-3">
              <Hint keys="↑↓" label="navegar" />
              <Hint keys="Enter" label="abrir" />
              <Hint keys="Esc" label="fechar" />
            </span>
            {footerCount ? (
              <span role="status" aria-live="polite" className="tabular-nums">
                {footerCount}
              </span>
            ) : null}
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
