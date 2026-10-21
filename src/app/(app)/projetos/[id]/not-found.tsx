import { FolderKanban } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem]">
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanban />
          </EmptyMedia>
          <EmptyTitle>Projeto não encontrado</EmptyTitle>
          <EmptyDescription>
            Não há um projeto com este identificador no seu acesso.
          </EmptyDescription>
        </EmptyHeader>
        <Link href="/projetos" className={cn(buttonVariants({ variant: "outline" }))}>
          Voltar para projetos
        </Link>
      </Empty>
    </div>
  );
}
