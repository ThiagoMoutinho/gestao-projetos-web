"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/** Ícone da notificação em círculo suave na cor do tipo (sucesso, aviso, erro...). */
function ToastIcon({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`flex size-8 items-center justify-center rounded-full [&_svg]:size-4 ${tone}`}>{children}</span>
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={(theme === "dark" ? "dark" : "light") as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={4000}
      offset={{ bottom: 24, right: 24 }}
      mobileOffset={{ bottom: 16, left: 16, right: 16 }}
      visibleToasts={3}
      containerAriaLabel="Notificações"
      icons={{
        success: <ToastIcon tone="bg-status-done-soft text-status-done-ink"><CircleCheckIcon /></ToastIcon>,
        info: <ToastIcon tone="bg-primary/12 text-primary"><InfoIcon /></ToastIcon>,
        warning: <ToastIcon tone="bg-status-attention-soft text-status-attention-ink"><TriangleAlertIcon /></ToastIcon>,
        error: <ToastIcon tone="bg-status-critical-soft text-status-critical-ink"><OctagonXIcon /></ToastIcon>,
        loading: <ToastIcon tone="bg-muted text-muted-foreground"><Loader2Icon className="animate-spin" /></ToastIcon>,
      }}
      style={
        {
          "--width": "340px",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Cartão neutro (fundo do popover) com o ícone colorido em um círculo suave: legível nos dois temas e em todas as paletas.
          // Acima de Dialogs e Sheets (z-50): a notificação nunca fica escondida atrás de um modal.
          toast:
            "cn-toast z-[100]! items-center! gap-3! border! border-border! bg-popover! px-3.5! py-3! text-popover-foreground! shadow-[0_12px_32px_-12px_rgba(16,24,40,0.28)]! dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]!",
          icon: "m-0! size-8! shrink-0! self-center!",
          content: "min-w-0 flex-1 gap-0.5!",
          title: "text-[13px]! leading-snug! font-semibold! text-foreground!",
          description: "text-xs! leading-snug! text-muted-foreground!",
          // O Sonner posiciona o X de forma absoluta no canto superior esquerdo; aqui ele entra no fluxo, à direita do texto.
          closeButton:
            "static! order-last! ml-auto! size-6! shrink-0! translate-none! transform-none! self-center! rounded-md! border-0! bg-transparent! text-muted-foreground! opacity-70 transition-opacity hover:opacity-100 hover:bg-muted! [&_svg]:size-3.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
