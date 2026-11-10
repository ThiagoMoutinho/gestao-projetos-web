import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/fetcher";
import { getServerSession } from "@/modules/auth/session";
import { HomeOverview, HomeOverviewError } from "@/modules/dashboard/home-overview";
import { civilDateInput } from "@/modules/projects/eap-present";
import { loadPortfolioSnapshot, type PortfolioSnapshot } from "@/modules/projects/load-project-list";

export const metadata: Metadata = {
  title: "Início · Gestão de Projetos",
  description: "Panorama dos projetos da CTIN",
};

/** Mesmo fuso das datas civis da EAP, para "hoje" coincidir com os prazos exibidos. */
const TIME_ZONE = "America/Belem";

export default async function HomePage() {
  const session = await getServerSession();
  const user = session.data?.user;

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(now);
  const todayLabel = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  let snapshot: PortfolioSnapshot | null = null;
  let message = "A consulta dos projetos falhou.";

  try {
    snapshot = await loadPortfolioSnapshot();
  } catch (error) {
    if (error instanceof ApiError) {
      message = error.message;
    }
  }

  if (!snapshot) {
    return <HomeOverviewError name={user.name} todayLabel={todayLabel} message={message} />;
  }

  return (
    <HomeOverview
      name={user.name}
      todayLabel={todayLabel}
      today={civilDateInput(now.toISOString())}
      rows={snapshot.rows}
      signals={snapshot.signals}
    />
  );
}
