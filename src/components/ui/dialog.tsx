"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/25 duration-200 supports-backdrop-filter:backdrop-blur-[3px] dark:bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-x-hidden overflow-y-auto p-6 text-sm sm:max-w-sm rounded-[20px] border border-border/70 bg-popover text-popover-foreground shadow-[0_32px_64px_-24px_rgba(16,24,40,0.45)] duration-200 outline-none dark:shadow-[0_32px_64px_-24px_rgba(0,0,0,0.75)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="outline"
                className="absolute top-5 right-5 text-muted-foreground hover:text-foreground"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        // Com DialogMedia: ícone à esquerda e título + descrição ao lado (padrão do modal Editar equipe).
        "flex flex-col gap-1.5 pr-10 has-data-[slot=dialog-media]:grid has-data-[slot=dialog-media]:grid-cols-[auto_minmax(0,1fr)] has-data-[slot=dialog-media]:items-start has-data-[slot=dialog-media]:gap-x-4 has-data-[slot=dialog-media]:gap-y-1",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky -bottom-6 z-10 -mx-6 -mb-6 mt-1 flex flex-col-reverse gap-2.5 rounded-b-[20px] border-t bg-popover px-6 py-4 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "cn-font-heading text-lg leading-snug font-semibold tracking-tight text-foreground [[data-slot=dialog-header]:has([data-slot=dialog-media])_&]:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-body leading-relaxed text-muted-foreground [[data-slot=dialog-header]:has([data-slot=dialog-media])_&]:col-start-2 *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Ícone contextual do cabeçalho (container arredondado na cor da paleta; `tone` para aviso ou exclusão). */
function DialogMedia({
  className,
  tone = "primary",
  ...props
}: React.ComponentProps<"div"> & { tone?: "primary" | "destructive" | "attention" | "success" }) {
  return (
    <div
      data-slot="dialog-media"
      aria-hidden="true"
      className={cn(
        "row-span-2 flex size-11 shrink-0 items-center justify-center rounded-2xl [&_svg:not([class*='size-'])]:size-5",
        tone === "primary" && "bg-primary/12 text-primary dark:bg-primary/20",
        tone === "destructive" && "bg-status-critical-soft text-status-critical-ink",
        tone === "attention" && "bg-status-attention-soft text-status-attention-ink",
        tone === "success" && "bg-status-done-soft text-status-done-ink",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
