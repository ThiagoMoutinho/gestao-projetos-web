"use client";

import { Bell, ClipboardList, Loader2, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

/** Avatar da barra superior com o menu da conta: perfil, notificações, aparência e sair. */
export function UserMenu({ user }: { user: AppUser }) {
  const router = useRouter();
  const { theme, setTheme, palette, setPalette } = useAppearance();
  const [pending, setPending] = useState(false);
  const profile = roleLabel(user.role);

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
    <DropdownMenu>
      <SquircleDefs />
      <DropdownMenuTrigger
        aria-label={`Menu da conta de ${user.name}`}
        style={SQUIRCLE_STYLE}
        className="flex h-11 w-[46px] shrink-0 items-center justify-center bg-transparent p-0.5 outline-none transition-colors duration-200 focus-visible:bg-bar-foreground data-open:bg-primary motion-reduce:transition-none"
      >
        <Avatar className="size-full rounded-none after:hidden" style={SQUIRCLE_STYLE}>
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="rounded-none bg-[color-mix(in_oklch,var(--primary)_88%,black)] dark:bg-primary text-body font-semibold text-primary-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-lg">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <span className="flex items-center gap-3 px-2 py-2 text-left">
              <Avatar className="size-10">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="bg-[color-mix(in_oklch,var(--primary)_88%,black)] dark:bg-primary text-body font-semibold text-primary-foreground">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                <span className="truncate text-body font-medium text-foreground">{user.name}</span>
                <span className="truncate text-label text-muted-foreground">{user.email}</span>
                {profile ? (
                  <Badge variant="secondary" className="mt-1 w-fit text-label">
                    {profile}
                  </Badge>
                ) : null}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound />
          Minha conta
          <span className="ml-auto text-label text-muted-foreground">Em breve</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <ClipboardList />
          Minhas pendências
          <span className="ml-auto text-label text-muted-foreground">Em breve</span>
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notificacoes" />}>
          <Bell />
          Notificações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Aparência</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              const next = parseTheme(value);
              if (next) {
                setTheme(next);
              }
            }}
          >
            {THEMES.map((item) => (
              <DropdownMenuRadioItem key={item.id} value={item.id}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Paleta de cores</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={palette}
            onValueChange={(value) => {
              const next = parsePalette(value);
              if (next) {
                setPalette(next);
              }
            }}
          >
            {PALETTES.map((item) => (
              <DropdownMenuRadioItem key={item.id} value={item.id}>
                <span data-palette={item.id} className="flex shrink-0 overflow-hidden rounded-full ring-1 ring-border" aria-hidden="true">
                  <span className="h-3.5 w-3 bg-brand" />
                  <span className="h-3.5 w-3 bg-primary" />
                </span>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={() => void onLogout()}>
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
