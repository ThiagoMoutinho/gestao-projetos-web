import type { Metadata } from "next";

import { getServerSession } from "@/modules/auth/session";
import { ApiError } from "@/lib/api/fetcher";
import { DeliveriesPage } from "@/modules/deliveries/deliveries-page";
import { loadDeliveries } from "@/modules/deliveries/load-deliveries";

export const metadata: Metadata = {
  title: "Entregas e Homologações · Gestão de Projetos",
  description: "Entregas dos projetos visíveis para o acesso atual",
};

export default async function DeliveriesRoute() {
  let snapshot: Awaited<ReturnType<typeof loadDeliveries>> | null = null;
  let message = "";
  try {
    snapshot = await loadDeliveries();
  } catch (error) {
    message = error instanceof ApiError ? error.message : "A consulta das entregas falhou.";
  }
  if (snapshot) {
    const role = (await getServerSession()).data?.user?.role;
    return <DeliveriesPage snapshot={snapshot} viewerRole={typeof role === "string" ? role : ""} />;
  }
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-2 rounded-xl border border-status-critical/25 bg-status-critical-soft px-4 py-4" role="alert">
      <h1 className="text-base font-semibold">Não foi possível carregar as entregas</h1>
      <p className="text-sm text-muted-foreground">{message} Tente novamente em instantes.</p>
    </div>
  );
}
