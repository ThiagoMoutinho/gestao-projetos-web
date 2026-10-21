import { BookOpen, ExternalLink, Lock, Shield } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { AccessibilityMenu } from "@/modules/auth/accessibility-menu";
import { LoginBrandPanel } from "@/modules/auth/login-brand-panel";
import { LoginForm } from "@/modules/auth/login-form";
import { getServerSession } from "@/modules/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Entrar · Gestão de Projetos",
  description: "Acesso ao Sistema de Gestão de Projetos da CTIN/IGEPPS",
};

const PORTAL_URL = "https://www.igepps.pa.gov.br/";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session.data?.user) {
    redirect("/");
  }

  const year = new Date().getFullYear();

  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,62fr)_minmax(0,45fr)]">
      <LoginBrandPanel />

      <section
        className="relative flex flex-col bg-[color-mix(in_oklch,var(--background),var(--primary)_4%)]"
      >
        <div className="absolute top-5 right-5 z-10 sm:top-6 sm:right-6">
          <AccessibilityMenu />
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 py-16 sm:px-10">
          <div className="mx-auto w-full max-w-[26rem]">
            <div className="space-y-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-2">
                <h2 className="text-[1.625rem] leading-8 font-semibold tracking-tight">
                  Bem-vindo de volta!
                </h2>
                <p className="text-sm leading-5 text-muted-foreground">
                  Informe suas credenciais para acessar o Sistema de Gestão de Projetos da CTIN.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <LoginForm />
            </div>

            <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-lg bg-background text-sm font-medium"
                disabled
                aria-describedby="manual-unavailable"
                title="Ainda não disponível"
              >
                <BookOpen />
                Manual do sistema
                <span id="manual-unavailable" className="sr-only">
                  O manual do sistema ainda não está disponível.
                </span>
              </Button>
              <a
                href={PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-12 rounded-lg bg-background text-sm font-medium",
                )}
              >
                <ExternalLink />
                Acessar portal IGEPPS
              </a>
            </div>
          </div>
        </div>

        <footer className="px-6 pb-6 text-center text-[13px] leading-5 text-muted-foreground">
          <p className="inline-flex items-center justify-center gap-1.5">
            <Shield className="size-3.5" aria-hidden="true" />
            © {year} IGEPPS - Instituto de Gestão Previdenciária e Proteção Social do Estado do
            Pará.
          </p>
          <p>Todos os direitos reservados.</p>
        </footer>
      </section>
    </div>
  );
}
