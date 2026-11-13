import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Spinner } from "@/components/ui/spinner"

/**
 * Botão único do sistema (páginas, cards, tabelas, menus e diálogos), em cinco papéis:
 * - primário (`default`): ação principal (Salvar, Confirmar, Criar), na cor da paleta ativa;
 * - secundário (`outline`): ação de apoio (Cancelar, Voltar), fundo neutro e borda discreta;
 * - complementar (`secondary`): ação auxiliar (Adicionar, Filtrar), fundo sutil tingido pela paleta;
 * - perigo (`destructive`): exclusão ou remoção, fundo vermelho suave e texto de alerta;
 * - ícone (`outline` + `size="icon*"`): ações rápidas (Editar, Visualizar, Fechar); `ghost` para ações sem moldura.
 * Altura padrão 40 px, cantos de 10 px (9 px nos compactos, 12 px nos grandes), texto 14 px seminegrito,
 * ícone de 16 px e transição de 150 ms (desligada com `prefers-reduced-motion`).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 data-loading:cursor-progress aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 motion-reduce:transition-none motion-reduce:active:scale-100 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(16_24_40/0.14),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-[color-mix(in_oklch,var(--primary)_88%,black)] dark:hover:bg-[color-mix(in_oklch,var(--primary)_88%,white)]",
        outline:
          "border-input bg-card text-foreground shadow-[0_1px_2px_rgb(16_24_40/0.05)] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-transparent dark:hover:bg-input/40",
        secondary:
          "border-primary/35 bg-primary/[0.06] text-[color-mix(in_oklch,var(--primary)_45%,var(--foreground))] shadow-[0_1px_2px_rgb(16_24_40/0.04)] hover:border-primary/55 hover:bg-primary/10 aria-expanded:border-primary/55 aria-expanded:bg-primary/10 [&_svg]:text-primary dark:border-primary/50 dark:bg-primary/10 dark:text-foreground dark:hover:bg-primary/20",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/60",
        destructive:
          "border-status-critical/30 bg-status-critical-soft text-status-critical-ink hover:border-status-critical/50 hover:bg-[color-mix(in_oklch,var(--status-critical)_16%,var(--card))] focus-visible:border-status-critical/60 focus-visible:ring-status-critical/25 dark:border-status-critical/40 dark:hover:bg-[color-mix(in_oklch,var(--status-critical)_28%,transparent)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[9px] px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-[9px] px-3 text-[13px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-2 rounded-[12px] px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs": "size-7 rounded-[9px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-[9px]",
        "icon-lg": "size-11 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Operação em andamento: mostra o spinner no lugar do ícone e bloqueia novos cliques. */
    loading?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "[&>svg:not([data-slot=spinner])]:hidden"
      )}
      {...props}
    >
      {loading ? <Spinner aria-hidden="true" role={undefined} /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
