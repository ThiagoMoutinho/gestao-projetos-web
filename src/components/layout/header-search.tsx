"use client";

import { FolderKanban, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useAccessibleProjects } from "./accessible-projects";

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/** Texto sem acentos para a busca casar com ou sem acentuação. */
function plain(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-label leading-none">{keys}</kbd>
      {label}
    </span>
  );
}

/**
 * Busca da barra superior: gatilho + Command Palette (CommandDialog). Fase 1: somente projetos acessíveis ao usuário,
 * por nome e código GLPI. O atalho "/" abre e foca a busca, exceto quando o foco já está num campo de texto.
 */
export function HeaderSearch() {
  const router = useRouter();
  const { projects, status } = useAccessibleProjects();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || isEditable(event.target)) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function select(id: string) {
    setOpen(false);
    router.push(`/projetos/${id}`);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Buscar projetos (atalho: barra)"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="h-[46px] w-full max-w-[600px] justify-start gap-3 border border-bar-border bg-bar-foreground/10 px-4 text-body font-normal text-bar-muted transition-colors duration-200 hover:bg-bar-foreground/15 hover:text-bar-foreground focus-visible:ring-bar-foreground/60 max-sm:size-10 max-sm:w-10 max-sm:justify-center max-sm:px-0 motion-reduce:transition-none"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left max-sm:hidden">Buscar projetos por nome ou GLPI</span>
        <kbd className="rounded border border-bar-border px-2 py-0.5 font-sans text-label leading-none text-bar-muted max-sm:hidden">/</kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar projetos"
        description="Pesquise os projetos que você pode acessar por nome ou código GLPI."
        showCloseButton
        className="dark sm:max-w-xl"
      >
        <Command>
        <CommandInput placeholder="Buscar projeto por nome ou código GLPI…" />
        <CommandList className="max-h-[min(24rem,50svh)]">
          {status === "loading" ? (
            <div role="status" className="px-4 py-6 text-center text-body text-muted-foreground">
              Carregando projetos…
            </div>
          ) : status === "error" ? (
            <div role="alert" className="px-4 py-6 text-center text-body text-muted-foreground">
              Não foi possível carregar os projetos. Tente novamente mais tarde.
            </div>
          ) : (
            <>
              <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
              <CommandGroup heading="Projetos">
                {(projects ?? []).map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id}
                    keywords={[
                      project.name,
                      plain(project.name),
                      ...(project.glpiTicketId ? [project.glpiTicketId, `#${project.glpiTicketId}`, `glpi ${project.glpiTicketId}`] : []),
                    ]}
                    onSelect={() => select(project.id)}
                    className="gap-3 py-2.5"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
                      aria-hidden="true"
                    >
                      <FolderKanban className="size-4" />
                    </span>
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-body font-medium text-foreground">{project.name}</span>
                      {project.glpiTicketId ? (
                        <span className="truncate text-label text-muted-foreground">GLPI #{project.glpiTicketId}</span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-label text-muted-foreground">
          <span className="flex flex-wrap items-center gap-3">
            <Hint keys="↑↓" label="navegar" />
            <Hint keys="Enter" label="abrir" />
            <Hint keys="Esc" label="fechar" />
          </span>
          <span>Tarefas, marcos e fornecedores em breve</span>
        </div>
        </Command>
      </CommandDialog>
    </>
  );
}
