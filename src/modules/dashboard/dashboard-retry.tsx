"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

/** Refaz as consultas do servidor sem recarregar a página inteira. */
export function DashboardRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button type="button" variant="outline" loading={pending} onClick={() => startTransition(() => router.refresh())}>
      <RotateCw aria-hidden="true" />
      Tentar novamente
    </Button>
  );
}
