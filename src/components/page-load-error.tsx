"use client";

import { CloudOff, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mensagens genéricas da API que não acrescentam informação ao usuário. */
const GENERIC_DETAIL =
  /^(erro interno do servidor|a consulta dos projetos falhou|a consulta das entregas falhou|não foi possível consultar os projetos|não foi possível carregar .+|a consulta .+ falhou)\.?$/i;

function isGenericDetail(message: string) {
  const detail = message.trim();
  return !detail || GENERIC_DETAIL.test(detail);
}

type PageLoadErrorProps = {
  title: string;
  /** Explicação amigável; se omitida, usa o texto padrão de falha temporária. */
  description?: string;
  /** Mensagem bruta da API — só aparece quando não for genérica. */
  message?: string;
  /** Ação secundária (padrão: Voltar ao Início). `null` oculta. */
  secondary?: ReactNode | null;
  /** Retry customizado; sem isso, usa `router.refresh()`. */
  onRetry?: () => void;
  /** Variante compacta para abas e painéis internos. */
  compact?: boolean;
  className?: string;
};

/**
 * Estado de falha de carga de página ou aba: cartão central, ícone de atenção, texto acessível,
 * detalhe técnico opcional e nova tentativa sem recarregar a aplicação inteira.
 */
export function PageLoadError({
  title,
  description = "A consulta ao servidor falhou neste momento. Sua sessão permanece ativa — tente de novo em instantes. Se o problema continuar, avise o PMO ou o suporte técnico.",
  message,
  secondary,
  onRetry,
  compact = false,
  className,
}: PageLoadErrorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const detail = message?.trim() ?? "";
  const showDetail = detail.length > 0 && !isGenericDetail(detail);
  const secondaryAction =
    secondary === undefined ? (
      <Button type="button" variant="outline" render={<Link href="/" />}>
        Voltar ao Início
      </Button>
    ) : (
      secondary
    );

  return (
    <section
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-6 rounded-2xl border border-border/70 bg-card text-center shadow-[0_1px_3px_rgba(16,24,40,0.05)] dark:border-border",
        compact ? "min-h-[14rem] gap-4 px-5 py-8 sm:px-8" : "min-h-[22rem] px-6 py-12 sm:px-10",
        className,
      )}
    >
      <div className={cn("flex flex-col items-center", compact ? "max-w-sm gap-3" : "max-w-md gap-4")}>
        <span
          className={cn(
            "flex items-center justify-center rounded-2xl bg-status-attention-soft text-status-attention-ink ring-1 ring-status-attention/25 ring-inset",
            compact ? "size-11" : "size-14",
          )}
          aria-hidden="true"
        >
          <CloudOff className={compact ? "size-5" : "size-7"} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className={cn("font-semibold tracking-tight text-foreground", compact ? "text-base" : "text-card-title")}>
            {title}
          </h2>
          <p className={cn("text-muted-foreground", compact ? "text-secondary" : "text-body")}>{description}</p>
        </div>
        {showDetail ? (
          <p className="w-full max-w-sm rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-label text-muted-foreground">
            Detalhe técnico: {detail}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          loading={pending}
          onClick={() => {
            if (onRetry) {
              startTransition(() => onRetry());
              return;
            }
            startTransition(() => router.refresh());
          }}
        >
          <RotateCw aria-hidden="true" />
          Tentar novamente
        </Button>
        {secondaryAction}
      </div>
    </section>
  );
}
