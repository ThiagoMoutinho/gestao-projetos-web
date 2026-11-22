"use client";

import { Bell, Building2, Check, ChevronDown, ClipboardList, Loader2, LogOut, Moon, ShieldCheck, Sun, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PALETTES, SELECTABLE_PALETTES, THEMES, parsePalette, parseTheme } from "@/modules/appearance/appearance";
import { useAppearance } from "@/modules/appearance/appearance-provider";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/modules/notifications/use-notification-feed";
import { listMyNotifications } from "@/lib/api/generated/notificações-do-acompanhamento/notificações-do-acompanhamento";
import { cn } from "@/lib/utils";
import { logout } from "@/modules/auth/client";
import { roleLabel } from "@/modules/auth/roles";

import type { AppUser } from "./app-header";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Formato squircle (caminho em 50×44) escalado ao elemento por objectBoundingBox. */
const SQUIRCLE_ID = "igepps-squircle";
const SQUIRCLE_STYLE = { clipPath: `url(#${SQUIRCLE_ID})` } as const;

function SquircleDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <clipPath id={SQUIRCLE_ID} clipPathUnits="objectBoundingBox">
        <path transform="scale(0.02 0.022727)" d="M25,0 C42,0 50,3 50,22 C50,41 42,44 25,44 C8,44 0,41 0,22 C0,3 8,0 25,0 Z" />
      </clipPath>
    </svg>
  );
}

const THEME_ICON: Record<string, LucideIcon> = { igepps: Building2, light: Sun, dark: Moon };
const THEME_SHORT: Record<string, string> = { igepps: "IGEPPS", light: "Claro", dark: "Escuro" };

/** Fundo das iniciais quando não há foto: degradê da paleta. */
const FALLBACK_BG =
  "bg-linear-to-br from-primary to-brand-deep dark:from-[color-mix(in_oklch,var(--primary)_55%,black)] dark:in-data-[palette=grafite]:from-[#454d5b] dark:in-data-[palette=grafite]:to-[#272d38] font-semibold tracking-wide text-white";

/** Item do menu em formato de segmento (Aparência): sem o marcador de seleção padrão. */
const SEGMENT =
  "flex-1 justify-center gap-1.5 rounded-md px-2 py-1.5 pr-2 text-body text-muted-foreground transition-colors duration-150 focus:bg-background/60 data-checked:bg-background data-checked:font-medium data-checked:text-foreground data-checked:shadow-[0_1px_2px_rgb(16_24_40/0.12)] motion-reduce:transition-none [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden";

/** Ícone em bloco arredondado: no hover da linha ganha o tom da paleta. */
function MenuIcon({ icon: Icon, tone = "default" }: { icon: LucideIcon; tone?: "default" | "danger" }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none",
        tone === "danger"
          ? "bg-status-critical-soft text-status-critical-ink"
          : "bg-muted text-muted-foreground group-focus/dropdown-menu-item:bg-primary/12 group-focus/dropdown-menu-item:text-primary",
      )}
    >
      <Icon className={cn("size-[17px]", Icon === Loader2 && "animate-spin")} aria-hidden="true" />
    </span>
  );
}

const MENU_ITEM = "group/dropdown-menu-item h-11 gap-3 rounded-lg px-2 text-body font-medium";
const SOON = "ml-auto rounded-full bg-muted px-2 py-0.5 text-label font-medium text-muted-foreground";

function CountBadge({ value }: { value: number }) {
  return (
    <span className="ml-auto min-w-5 rounded-full bg-status-critical-soft px-1.5 text-center text-label font-semibold text-status-critical-ink tabular-nums">
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Não lidas, lidas da mesma API do sino quando o menu abre (sem duplicar o polling do sino). */
function useUnreadCount(active: boolean) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      return;
    }
    let alive = true;
    const load = () => {
      listMyNotifications({ read: "false", limit: 1 })
        .then((response) => {
          if (alive && response.status === 200) setCount(response.data.unread);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    };
  }, [active]);
  return count;
}

/** Avatar da barra superior com o menu da conta: perfil, notificações, aparência, paleta e sair. */
export function UserMenu({ user }: { user: AppUser }) {
  const router = useRouter();
  const { theme, setTheme, palette, paletteLocked, setPalette } = useAppearance();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(open);
  const haloRef = useRef<HTMLSpanElement>(null);

  // Pulse Glow: quando o usuário volta à aba ou à página, a contagem de 30 s do brilho recomeça (a animação é só CSS; aqui apenas a reiniciamos).
  useEffect(() => {
    function restartPulse() {
      const el = haloRef.current;
      if (!el) {
        return;
      }
      el.dataset.pulse = "off";
      void el.offsetWidth; // força o navegador a aplicar o estado sem animação antes de religá-la
      delete el.dataset.pulse;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        restartPulse();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", restartPulse);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", restartPulse);
    };
  }, []);
  const profile = roleLabel(user.role);
  // O Padrão IGEPPS usa só a paleta institucional (cores do instituto): as outras ficam desativadas. Claro e Escuro aceitam qualquer paleta.
  const darkTheme = theme === "dark";

  async function onLogout() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <SquircleDefs />
      <DropdownMenuTrigger
        aria-label={`Menu da conta de ${user.name}`}
        className="group/user flex shrink-0 items-center gap-2.5 rounded-full border border-bar-border bg-bar-foreground/6 py-1 pr-2 pl-1 outline-none transition-colors duration-200 hover:bg-bar-foreground/12 focus-visible:ring-2 focus-visible:ring-bar-foreground/60 data-open:bg-bar-foreground/14 motion-reduce:transition-none lg:pr-3"
      >
        <span ref={haloRef} className="avatar-halo flex shrink-0">
        <span
          style={SQUIRCLE_STYLE}
          className="avatar-ring flex h-[45px] w-[50px] shrink-0 items-center justify-center bg-bar-muted p-[2px] transition-[background-color,filter] duration-200 dark:bg-[color-mix(in_oklch,var(--primary)_45%,white)] group-hover/user:bg-white group-hover/user:brightness-105 group-focus-visible/user:bg-white group-data-open/user:bg-white dark:group-data-open/user:bg-white motion-reduce:transition-none"
        >
          <Avatar className="size-full rounded-none after:hidden" style={SQUIRCLE_STYLE}>
            {user.image ? <AvatarImage src={user.image} alt="" className="object-cover" /> : null}
            {/* Segue a paleta escolhida: degradê primary→brand no claro/IGEPPS; no escuro, o primary da paleta escurecido (a paleta só muda os destaques lá) com iniciais brancas em semibold; o contorno claro vem do botão. */}
            <AvatarFallback className="rounded-none bg-linear-to-br from-primary to-brand text-body font-semibold tracking-wide text-white dark:from-[color-mix(in_oklch,var(--primary)_72%,black)] dark:to-[color-mix(in_oklch,var(--primary)_54%,black)] dark:in-data-[palette=grafite]:from-[#454d5b] dark:in-data-[palette=grafite]:to-[#272d38]">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </span>
        </span>
        <span className="hidden min-w-0 max-w-40 flex-col text-left leading-tight text-bar-foreground lg:flex">
          <span className="truncate text-body font-semibold">{user.name}</span>
          {profile ? <span className="truncate text-label text-bar-foreground/70">{profile}</span> : null}
        </span>
        <ChevronDown
          className="hidden size-4 shrink-0 text-bar-foreground/70 transition-transform duration-200 group-data-open/user:rotate-180 motion-reduce:transition-none lg:block"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="glass-menu w-[21rem] rounded-2xl p-0 shadow-xl">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <span className="relative flex items-center gap-3.5 rounded-t-2xl border-b border-border/70 px-4 py-5 text-left">
              <Avatar className="relative size-14 shrink-0 rounded-none after:hidden" style={SQUIRCLE_STYLE}>
                {user.image ? <AvatarImage src={user.image} alt="" className="object-cover" /> : null}
                <AvatarFallback className={cn("rounded-none text-lg", FALLBACK_BG)}>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="relative grid min-w-0 flex-1 gap-0.5 leading-tight">
                <span className="truncate text-card-title font-semibold text-foreground">{user.name}</span>
                <span className="truncate text-label text-muted-foreground">{user.email}</span>
                {profile ? (
                  <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-primary/14 px-2 py-0.5 text-label font-semibold text-primary dark:bg-primary/22">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    {profile}
                  </span>
                ) : null}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup className="p-2">
          <DropdownMenuItem disabled className={MENU_ITEM}>
            <MenuIcon icon={UserRound} />
            Minha conta
            <span className={SOON}>Em breve</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className={MENU_ITEM}>
            <MenuIcon icon={ClipboardList} />
            Minhas pendências
            <span className={SOON}>Em breve</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/notificacoes" />} className={MENU_ITEM}>
            <MenuIcon icon={Bell} />
            Notificações
            {unread ? <CountBadge value={unread} /> : null}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <div className="border-t border-border/70 bg-muted/30 px-4 pt-3.5 pb-4">
          <span className="mb-2 block text-label font-semibold tracking-wide text-muted-foreground uppercase">Aparência</span>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              const next = parseTheme(value);
              if (next) {
                setTheme(next);
              }
            }}
            className="flex gap-1 rounded-xl bg-muted p-1 ring-1 ring-border/60"
          >
            {THEMES.map((item) => {
              const Icon = THEME_ICON[item.id] ?? Sun;
              return (
                <DropdownMenuRadioItem key={item.id} value={item.id} aria-label={item.label} className={SEGMENT}>
                  <Icon className="size-[15px]" />
                  {THEME_SHORT[item.id] ?? item.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          <span className="mt-4 mb-2 flex items-baseline justify-between text-label font-semibold tracking-wide text-muted-foreground uppercase">
            Paleta de cores
            <span className="font-medium tracking-normal text-foreground normal-case">{PALETTES.find((item) => item.id === palette)?.label}</span>
          </span>
          {paletteLocked ? (
            <p id="palette-dark-hint" className="mb-2 text-label text-muted-foreground">
              O Padrão IGEPPS usa só as cores do instituto. Escolha o tema Claro ou Escuro para trocar a paleta.
            </p>
          ) : darkTheme ? (
            <p id="palette-dark-hint" className="mb-2 text-label text-muted-foreground">
              No modo Escuro a paleta muda só os destaques; fundo e cartões continuam escuros.
            </p>
          ) : null}
          <DropdownMenuRadioGroup
            value={palette}
            onValueChange={(value) => {
              const next = parsePalette(value);
              if (next) {
                setPalette(next);
              }
            }}
            className="flex justify-between gap-1"
            aria-describedby={paletteLocked || darkTheme ? "palette-dark-hint" : undefined}
          >
            {SELECTABLE_PALETTES.map((item) => (
              <DropdownMenuRadioItem
                key={item.id}
                value={item.id}
                aria-label={item.label}
                title={paletteLocked && item.id !== palette ? `${item.label} (indisponível no Padrão IGEPPS)` : item.label}
                disabled={paletteLocked}
                className="relative size-10 justify-center rounded-full p-0 pr-0 ring-offset-2 ring-offset-popover transition-[box-shadow,transform] duration-200 hover:scale-105 focus:bg-transparent focus-visible:ring-2 focus-visible:ring-ring data-checked:ring-2 data-checked:ring-primary/70 motion-reduce:transition-none motion-reduce:hover:scale-100 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
              >
                <span data-palette={item.id} className="relative flex size-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-foreground/15" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 w-1/2 bg-brand-deep" />
                  <span className="absolute inset-y-0 right-0 w-1/2 bg-primary" />
                  {item.id === palette ? <Check className="relative size-4 text-white drop-shadow" strokeWidth={3} /> : null}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <DropdownMenuGroup className="border-t border-border/70 p-2">
          <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => void onLogout()} className={MENU_ITEM}>
            <MenuIcon icon={pending ? Loader2 : LogOut} tone="danger" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
