import type { Metadata } from "next";

import { ApiError } from "@/lib/api/fetcher";
import { getServerSession } from "@/modules/auth/session";
import { DeliveriesPage } from "@/modules/deliveries/deliveries-page";
import { DeliveriesPageError } from "@/modules/deliveries/deliveries-page-error";
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
  return <DeliveriesPageError message={message || "A consulta das entregas falhou."} />;
}
