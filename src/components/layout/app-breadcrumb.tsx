"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { appPageLabel } from "@/components/layout/app-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Trilha discreta no topo do conteúdo (antes ficava no cabeçalho). */
export function AppBreadcrumb() {
  const pathname = usePathname();
  const aba = useSearchParams().get("aba");
  const onEap = /^\/projetos\/[^/]+$/.test(pathname) && aba === "eap";
  const pageLabel = onEap ? "EAP" : appPageLabel(pathname);

  return (
    <div className="px-4 pt-3 md:px-6">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="text-label">
          <BreadcrumbItem>
            <span>Gestão de Projetos</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
