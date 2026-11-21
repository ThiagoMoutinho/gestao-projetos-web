"use client";

import {
  CalendarDays,
  ChevronRight,
  FileText,
  Flag,
  History,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ComboOption } from "@/components/option-combobox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { PROJECT_STATUS_COLOR, projectStatusLabel } from "@/modules/projects/project-status";
import { type AccessibleProject, useAccessibleProjects } from "./accessible-projects";
import { APP_NAV_GROUPS, type AppNavChild, type AppNavItem } from "./app-nav";
import { SidebarActiveIndicator } from "./sidebar-active-indicator";

/** Título de seção: pequeno, em caixa alta e discreto; no recolhido some (o componente base já o esconde). */
const GROUP_LABEL = "h-7 px-3 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/55 uppercase";

/** Seções depois da primeira ganham um filete e respiro; recolhido, o separador curto vem do globals.css. */
const GROUP_DIVIDER = "not-first:mt-1 not-first:border-t not-first:border-sidebar-border/60 not-first:pt-2 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:pt-0";

/** Nome do item indisponível com a legenda "Em breve" embaixo (cabe sem quebrar o nome; some no menu recolhido). */
function SoonLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid min-w-0 leading-tight">
      <span className="truncate">
        {children}
        <span className="sr-only">, indisponível</span>
      </span>
      <span className="text-[10px] font-normal text-sidebar-foreground/60" aria-hidden="true">
        Em breve
      </span>
    </span>
  );
}

function itemTooltip(label: string, enabled: boolean) {
  return enabled ? label : `${label}, indisponível`;
}

function NavSubItem({ item, pathname }: { item: AppNavChild; pathname: string }) {
  const active = item.enabled && item.href === pathname;

  if (item.enabled && item.href) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton isActive={active} render={<Link href={item.href} />}>
          <span>{item.label}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton aria-disabled="true" className="aria-disabled:pointer-events-auto">
        <span>
          {item.label}
          <span className="sr-only">, indisponível</span>
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function NavItem({ item, pathname }: { item: AppNavItem; pathname: string }) {
  const Icon = item.icon;
  const active =
    item.enabled &&
    item.href !== undefined &&
    (item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`)));
  const children = item.children ?? [];

  if (children.length > 0) {
    return (
      <Collapsible className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton tooltip={itemTooltip(item.label, item.enabled)} />
            }
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
            <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => (
                <NavSubItem key={child.label} item={child} pathname={pathname} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      {item.enabled && item.href ? (
        <SidebarMenuButton
          isActive={active}
          tooltip={item.label}
          render={<Link href={item.href} />}
        >
          <Icon className="size-4 shrink-0" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          aria-disabled="true"
          tooltip={itemTooltip(item.label, false)}
          className="aria-disabled:pointer-events-auto"
        >
          <Icon className="size-4 shrink-0" />
          <SoonLabel>{item.label}</SoonLabel>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

const PROJECT_NAV_UNAVAILABLE: ReadonlyArray<{ label: string; icon: LucideIcon }> = [
  { label: "Entregas e Homologações", icon: Flag },
  { label: "Histórico Executivo", icon: History },
  { label: "Documentos", icon: FileText },
  { label: "Equipe", icon: Users },
];

/** Itens do projeto: só habilitados quando a rota aponta para um projeto acessível (`projectId`). */
function ProjectNav({ projectId, eapOpen, scheduleOpen }: { projectId: string | undefined; eapOpen: boolean; scheduleOpen: boolean }) {
  const router = useRouter();
  const eapActive = Boolean(projectId && eapOpen);
  const scheduleActive = Boolean(projectId && scheduleOpen);
  const overviewActive = Boolean(projectId && !eapOpen && !scheduleOpen);
  const disabledProps = { "aria-disabled": true } as const;

  function open(aba?: "eap" | "cronograma") {
    if (projectId) {
      router.push(`/projetos/${projectId}${aba ? `?aba=${aba}` : ""}`);
    }
  }

  return (
    <>
      <SidebarGroup className={GROUP_DIVIDER}>
        <SidebarGroupLabel className={GROUP_LABEL}>Projeto</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn("cursor-pointer", !projectId && "aria-disabled:pointer-events-auto")}
                isActive={overviewActive}
                tooltip={projectId ? "Visão Geral" : "Visão Geral, selecione um projeto"}
                onClick={() => open()}
                {...(projectId ? {} : disabledProps)}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                <span>Visão Geral</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn("cursor-pointer", !projectId && "aria-disabled:pointer-events-auto")}
                isActive={eapActive}
                tooltip={projectId ? "Estrutura Analítica do Projeto" : "EAP, selecione um projeto"}
                onClick={() => open("eap")}
                {...(projectId ? {} : disabledProps)}
              >
                <Network className="size-4 shrink-0" />
                <span>EAP</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn("cursor-pointer", !projectId && "aria-disabled:pointer-events-auto")}
                isActive={scheduleActive}
                tooltip={projectId ? "Cronograma" : "Cronograma, selecione um projeto"}
                onClick={() => open("cronograma")}
                {...(projectId ? {} : disabledProps)}
              >
                <CalendarDays className="size-4 shrink-0" />
                <span>Cronograma</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {PROJECT_NAV_UNAVAILABLE.map(({ label, icon: Icon }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton tooltip={`${label}, indisponível`} {...disabledProps}>
                  <Icon className="size-4 shrink-0" />
                  <SoonLabel>{label}</SoonLabel>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

type SwitcherOption = ComboOption & { status: AccessibleProject["status"] };

/** Iniciais do projeto: primeira e última palavra com letra ou número ("Homologação do Firewall Dados ." vira HD, não "H."). */
function projectInitials(name: string) {
  const words = name.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) {
    return "?";
  }
  const first = Array.from(words[0].replace(/[^\p{L}\p{N}]/gu, ""));
  const letters = words.length === 1 ? first.slice(0, 2).join("") : `${first[0] ?? ""}${Array.from(words[words.length - 1].replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? ""}`;
  return letters.toLocaleUpperCase("pt-BR");
}

/** Bloco com as iniciais do projeto, como o do cabeçalho da Visão Geral; sem projeto mostra o ícone de pasta. Mesmo tamanho no cartão e na lista. */
function ProjectTile({ name, className }: { name: string | null; className?: string }) {
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold tracking-wide text-sidebar-primary-foreground", className)}
      aria-hidden="true"
    >
      {name ? projectInitials(name) : <FolderKanban className="size-4" />}
    </span>
  );
}

/** Indicador de situação: o mesmo ponto (8 px com halo suave) e o mesmo texto no cartão e na lista. */
function StatusLine({ status, className }: { status: AccessibleProject["status"]; className?: string }) {
  const color = PROJECT_STATUS_COLOR[status];
  return (
    <span className={cn("flex items-center gap-1.5 truncate text-xs leading-4", className)} title="Situação registrada no cadastro do projeto">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 0 2px color-mix(in oklch, ${color} 18%, transparent)` }}
        aria-hidden="true"
      />
      <span className="truncate">{projectStatusLabel(status)}</span>
    </span>
  );
}

/** Nome em uma linha com reticências; quando é cortado, o nome completo aparece em tooltip (só então, para não repetir o que já se lê). */
function ClippedName({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  const measure = () => {
    const element = ref.current;
    if (element) {
      setClipped(element.scrollWidth > element.clientWidth + 1);
    }
  };
  useLayoutEffect(measure, [text]);
  return (
    <Tooltip disabled={!clipped}>
      <TooltipTrigger render={<span ref={ref} onMouseEnter={measure} className={cn("block truncate", className)} />}>{text}</TooltipTrigger>
      <TooltipContent side="right" align="start">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ProjectSwitcher({
  projects,
  currentProject,
  eapOpen,
  scheduleOpen,
}: {
  projects: SwitcherOption[] | null;
  currentProject: string | undefined;
  eapOpen: boolean;
  scheduleOpen: boolean;
}) {
  const router = useRouter();
  const selected = projects?.find((option) => option.value === currentProject) ?? null;

  function select(id: string) {
    if (!id || id === currentProject) {
      return;
    }
    router.push(`/projetos/${id}${eapOpen ? "?aba=eap" : scheduleOpen ? "?aba=cronograma" : ""}`);
  }

  if (projects === null || projects.length === 0) {
    return null;
  }

  return (
    <>
      {/* Recolhido: só o bloco com as iniciais (o nome fica acessível e no title). */}
      <div className="hidden justify-center group-data-[collapsible=icon]:flex">
        <ProjectTile name={selected?.label ?? null} className="size-10" />
        <span className="sr-only">{selected ? `Projeto selecionado: ${selected.label}` : "Nenhum projeto selecionado"}</span>
      </div>
      <div className="group-data-[collapsible=icon]:hidden">
        <Combobox
          items={projects}
          value={selected}
          onValueChange={(next: SwitcherOption | null) => select(next?.value ?? "")}
          itemToStringLabel={(option: SwitcherOption) => option.label}
          isItemEqualToValue={(item: SwitcherOption, current: SwitcherOption) => item.value === current.value}
        >
          <ComboboxTrigger
            aria-label={selected ? `Projeto selecionado: ${selected.label}. Trocar de projeto` : "Selecionar projeto"}
            className="switcher-card group/switcher flex w-full items-center gap-2.5 rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/[0.07] p-2 text-left text-sidebar-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-colors duration-200 hover:bg-sidebar-foreground/[0.11] focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none motion-reduce:transition-none [&>svg]:hidden"
          >
            <ProjectTile name={selected?.label ?? null} />
            <span className="grid min-w-0 flex-1 leading-tight">
              {selected ? (
                <>
                  <ClippedName text={selected.label} className="text-body font-semibold" />
                  <StatusLine status={selected.status} className="text-sidebar-foreground/70" />
                </>
              ) : (
                <>
                  <span className="truncate text-body font-semibold">Selecione um projeto</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Para abrir Visão Geral, EAP e Cronograma</span>
                </>
              )}
            </span>
            <ChevronDown className="size-4 shrink-0 text-sidebar-foreground/70 transition-transform duration-200 group-data-popup-open/switcher:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </ComboboxTrigger>
          <ComboboxContent className="glass-select w-80 min-w-72 p-1.5 shadow-sm">
            <ComboboxInput
              placeholder="Buscar projeto..."
              showTrigger={false}
              className="switcher-search m-1 h-10 bg-background/60"
            />
            <ComboboxEmpty>Nenhum projeto encontrado.</ComboboxEmpty>
            {/* Lista arejada e uniforme: itens de 56 px, avatares de 36 px, 4 px entre linhas; o selecionado tem fundo azul suave e check. */}
            <ComboboxList className="flex max-h-[min(22rem,var(--available-height))] flex-col gap-1 p-1">
              {(option: SwitcherOption) => (
                <ComboboxItem
                  key={option.value}
                  value={option}
                  className="min-h-14 gap-3 rounded-lg py-2 pr-10 pl-2.5 data-selected:bg-primary/10 data-selected:data-highlighted:bg-primary/15 [&_svg]:text-primary!"
                >
                  <ProjectTile name={option.label} className="bg-brand text-white!" />
                  <span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                    <ClippedName text={option.label} className="text-body font-medium" />
                    <StatusLine status={option.status} className="text-muted-foreground" />
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </>
  );
}

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("aba");
  const eapOpen = tab === "eap";
  const scheduleOpen = tab === "cronograma";
  const { projects: accessible } = useAccessibleProjects();
  const projects: SwitcherOption[] | null = useMemo(
    () => accessible?.map((project) => ({ value: project.id, label: project.name, status: project.status })) ?? null,
    [accessible],
  );
  const routeProject = pathname.match(/^\/projetos\/([^/]+)$/)?.[1];
  const currentProject = routeProject && projects?.some((project) => project.value === routeProject) ? routeProject : undefined;

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarHeader className="overflow-hidden">
        <ProjectSwitcher projects={projects} currentProject={currentProject} eapOpen={eapOpen} scheduleOpen={scheduleOpen} />
      </SidebarHeader>
      <SidebarContent className="relative">
        <SidebarActiveIndicator />
        {APP_NAV_GROUPS.map((group) => (
          <Fragment key={group.label}>
            {group.label === "Gestão" ? <ProjectNav projectId={currentProject} eapOpen={eapOpen} scheduleOpen={scheduleOpen} /> : null}
            <SidebarGroup className={GROUP_DIVIDER}>
              <SidebarGroupLabel className={GROUP_LABEL}>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {group.items.map((item) => (
                    <NavItem key={item.label} item={item} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
