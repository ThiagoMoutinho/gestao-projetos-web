import {
  ChartColumn,
  FolderKanban,
  House,
  ListTodo,
  PackageCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type AppNavChild = {
  label: string;
  href?: string;
  enabled: boolean;
};

export type AppNavItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  enabled: boolean;
  children?: AppNavChild[];
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export function appPageLabel(pathname: string) {
  const match = APP_NAV_GROUPS.flatMap((group) => group.items).find(
    (item) => item.enabled && item.href === pathname,
  );

  if (match) {
    return match.label;
  }

  if (pathname.startsWith("/projetos/")) {
    return "Projetos";
  }

  return "Início";
}

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Início", icon: House, enabled: true },
      { href: "/projetos", label: "Projetos", icon: FolderKanban, enabled: true },
      { href: "/minhas-tarefas", label: "Minhas Tarefas", icon: ListTodo, enabled: false },
      {
        href: "/entregas",
        label: "Entregas e Homologações",
        icon: PackageCheck,
        enabled: false,
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: ChartColumn, enabled: false },
      { href: "/administracao", label: "Administração", icon: Settings, enabled: false },
    ],
  },
];
