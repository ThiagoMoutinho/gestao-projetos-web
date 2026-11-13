"use client";

import { Bell, Building2, ClipboardList, Loader2, LogOut, Moon, Sun, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PALETTES, THEMES, parsePalette, parseTheme } from "@/modules/appearance/appearance";
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
  "bg-linear-to-br from-primary to-brand-deep dark:from-[color-mix(in_oklch,var(--primary)_55%,black)] font-semibold tracking-wide text-white";

/** Item do menu em formato de segmento (Aparência): sem o marcador de seleção padrão. */
const SEGMENT =
  "flex-1 justify-center gap-1.5 rounded-md px-2 py-1.5 pr-2 text-body text-muted-foreground transition-colors duration-150 focus:bg-background/60 data-checked:bg-background data-checked:font-medium data-checked:text-foreground data-checked:shadow-[0_1px_2px_rgb(16_24_40/0.12)] motion-reduce:transition-none [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden";

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
  const { theme, setTheme, palette, setPalette } = useAppearance();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(open);
  const profile = roleLabel(user.role);
  // As paletas valem só nas aparências IGEPPS e Claro; no Escuro ficam visíveis, mas desabilitadas.
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
        style={SQUIRCLE_STYLE}
        className="flex h-[52px] w-[58px] shrink-0 items-center justify-center bg-bar-foreground/16 p-[3px] outline-none transition-colors duration-200 focus-visible:bg-bar-foreground data-open:bg-primary dark:data-open:bg-primary motion-reduce:transition-none"
      >
        <Avatar className="size-full rounded-none after:hidden" style={SQUIRCLE_STYLE}>
          {user.image ? <AvatarImage src={user.image} alt="" className="object-cover" /> : null}
          <AvatarFallback className={cn("rounded-none text-card-title", FALLBACK_BG)}>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-80 rounded-xl p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <span className="flex items-center gap-3 px-4 py-4 text-left">
              <Avatar className="h-11 w-[50px] shrink-0 rounded-none after:hidden" style={SQUIRCLE_STYLE}>
                {user.image ? <AvatarImage src={user.image} alt="" className="object-cover" /> : null}
                <AvatarFallback className={cn("rounded-none text-body", FALLBACK_BG)}>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                <span className="truncate text-body font-semibold text-foreground">{user.name}</span>
                <span className="truncate text-label text-muted-foreground">{user.email}</span>
                {profile ? (
                  <span className="mt-1 w-fit rounded-full bg-primary/12 px-2 py-0.5 text-label font-semibold text-primary dark:bg-primary/20">
                    {profile}
                  </span>
                ) : null}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem disabled className="h-10 gap-3 px-2.5 text-body">
            <UserRound className="size-[18px]" />
            Minha conta
            <span className="ml-auto text-label text-muted-foreground">Em breve</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="h-10 gap-3 px-2.5 text-body">
            <ClipboardList className="size-[18px]" />
            Minhas pendências
            <span className="ml-auto text-label text-muted-foreground">Em breve</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/notificacoes" />} className="h-10 gap-3 px-2.5 text-body">
            <Bell className="size-[18px]" />
            Notificações
            {unread ? <CountBadge value={unread} /> : null}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <div className="px-4 pt-2 pb-3">
          <span className="mb-2 block text-label text-muted-foreground">Aparência</span>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              const next = parseTheme(value);
              if (next) {
                setTheme(next);
              }
            }}
            className="flex gap-1 rounded-lg bg-muted p-1"
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
          <span className="mt-4 mb-2 block text-label text-muted-foreground">
            Paleta de cores · <span className="text-foreground">{PALETTES.find((item) => item.id === palette)?.label}</span>
          </span>
          {darkTheme ? (
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
            className="flex gap-2.5"
            aria-describedby={darkTheme ? "palette-dark-hint" : undefined}
          >
            {PALETTES.map((item) => (
              <DropdownMenuRadioItem
                key={item.id}
                value={item.id}
                aria-label={item.label}
                title={item.label}
                className="size-9 justify-center rounded-full p-0 pr-0 ring-offset-2 ring-offset-popover transition-shadow duration-150 focus:bg-transparent focus-visible:ring-2 focus-visible:ring-ring data-checked:ring-2 data-checked:ring-primary motion-reduce:transition-none [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
              >
                <span data-palette={item.id} className="flex size-7 overflow-hidden rounded-full ring-1 ring-border" aria-hidden="true">
                  <span className="h-full w-1/2 bg-brand-deep" />
                  <span className="h-full w-1/2 bg-primary" />
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => void onLogout()} className="h-10 gap-3 px-2.5 text-body">
            {pending ? <Loader2 className="size-[18px] animate-spin" /> : <LogOut className="size-[18px]" />}
            Sair
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
