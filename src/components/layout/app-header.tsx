"use client";

import { Search } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { appPageLabel } from "@/components/layout/app-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export type AppUser = {
  name: string;
  email: string;
  role?: string | null;
};

export function AppHeader() {
  const searchHintId = useId();
  const pathname = usePathname();
  const aba = useSearchParams().get("aba");
  const onEap = /^\/projetos\/[^/]+$/.test(pathname) && aba === "eap";
  const pageLabel = onEap ? "EAP" : appPageLabel(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-[color-mix(in_oklch,var(--background),var(--primary)_4%)] px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4 self-center" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:inline-flex">
            <span>Gestão de Projetos</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:inline-flex" />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="relative hidden min-w-0 sm:block sm:w-56 lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            disabled
            placeholder="Buscar projetos, tarefas, fornecedores..."
            aria-describedby={searchHintId}
            className="h-8 bg-muted/40 pl-8"
          />
        </div>
        <Badge variant="outline" className="shrink-0">
          Busca indisponível
        </Badge>
        <p id={searchHintId} className="sr-only">
          A busca ainda não está disponível.
        </p>
      </div>
    </header>
  );
}
