"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      duration={4000}
      offset={{ bottom: 24, right: 24 }}
      mobileOffset={{ bottom: 16, left: 16, right: 16 }}
      visibleToasts={3}
      containerAriaLabel="Notificações"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--width": "320px",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "8px",
          "--success-bg": "#f0faf6",
          "--success-border": "#bfe4d5",
          "--success-text": "#157454",
          "--error-bg": "#fff4f1",
          "--error-border": "#efc3bf",
          "--error-text": "#9f2219",
          "--info-bg": "#f5f9ff",
          "--info-border": "#bad1f0",
          "--info-text": "#175cd3",
          "--warning-bg": "#fff8e9",
          "--warning-border": "#f1dcae",
          "--warning-text": "#8a6116",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Acima de Dialogs e Sheets (z-50): a notificação nunca fica escondida atrás de um modal.
          toast: "cn-toast z-[100]! items-start! gap-2.5! px-3! py-2.5! text-[11px]! leading-snug shadow-[0_8px_24px_rgba(16,24,40,0.12)]!",
          icon: "mt-px! self-start!",
          content: "min-w-0 flex-1",
          title: "font-semibold",
          description: "mt-0.5 text-[10px]! opacity-90",
          // O Sonner posiciona o X de forma absoluta no canto superior esquerdo; aqui ele entra no fluxo, à direita do texto.
          closeButton:
            "static! order-last! ml-auto! size-5! shrink-0! translate-none! transform-none! self-start! rounded-md! border-0! bg-transparent! text-current! opacity-60 transition-opacity hover:opacity-100 hover:bg-black/5! [&_svg]:size-3.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
