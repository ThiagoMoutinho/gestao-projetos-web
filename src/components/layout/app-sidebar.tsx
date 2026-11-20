"use client";

import {
  CalendarDays,
  ChevronRight,
  FileText,
  Flag,
  History,
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { ownerInitials } from "@/modules/projects/project-portfolio";
import { PROJECT_STATUS_COLOR, projectStatusLabel } from "@/modules/projects/project-status";
import { type AccessibleProject, useAccessibleProjects } from "./accessible-projects";
import type { AppUser } from "./app-header";
import { APP_NAV_GROUPS, type AppNavChild, type AppNavItem } from "./app-nav";
import { SidebarActiveIndicator } from "./sidebar-active-indicator";
import { UserMenu } from "./user-menu";

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

/** Bloco com as iniciais do projeto, como o do cabeçalho da Visão Geral; sem projeto mostra o ícone de pasta. */
function ProjectTile({ name, className }: { name: string | null; className?: string }) {
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground", className)}
      aria-hidden="true"
    >
      {name ? ownerInitials(name) : <FolderKanban className="size-4" />}
    </span>
  );
}

function StatusLine({ status }: { status: AccessibleProject["status"] }) {
  return (
    <span className="flex items-center gap-1.5 truncate text-[10px] text-sidebar-foreground/70" title="Situação registrada no cadastro do projeto">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLOR[status] }} aria-hidden="true" />
      <span className="truncate">{projectStatusLabel(status)}</span>
    </span>
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
            className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-2 text-left text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none data-open:bg-sidebar-accent motion-reduce:transition-none [&>svg]:hidden"
          >
            <ProjectTile name={selected?.label ?? null} />
            <span className="grid min-w-0 flex-1 leading-tight">
              {selected ? (
                <>
                  <span className="truncate text-xs font-semibold">{selected.label}</span>
                  <StatusLine status={selected.status} />
                </>
              ) : (
                <>
                  <span className="truncate text-xs font-semibold">Selecione um projeto</span>
                  <span className="truncate text-[10px] text-sidebar-foreground/70">Para abrir Visão Geral, EAP e Cronograma</span>
                </>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/60" aria-hidden="true" />
          </ComboboxTrigger>
          <ComboboxContent className="min-w-64">
            <ComboboxInput placeholder="Buscar projeto..." showTrigger={false} />
            <ComboboxEmpty>Nenhum projeto encontrado.</ComboboxEmpty>
            <ComboboxList>
              {(option: SwitcherOption) => (
                <ComboboxItem key={option.value} value={option}>
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate">{option.label}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLOR[option.status] }} aria-hidden="true" />
                      {projectStatusLabel(option.status)}
                    </span>
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

export function AppSidebar({ className, user }: { className?: string; user: AppUser }) {
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
      <SidebarFooter className="border-t border-sidebar-border/60">
        <UserMenu user={user} variant="sidebar" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
