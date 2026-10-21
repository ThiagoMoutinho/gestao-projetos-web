"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { logout } from "./client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

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
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className={cn("w-full", className)}
      onClick={onLogout}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      Sair
    </Button>
  );
}
