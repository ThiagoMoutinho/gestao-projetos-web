import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomeOverview } from "@/modules/dashboard/home-overview";
import { getServerSession } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: "Início · Gestão de Projetos",
  description: "Panorama dos projetos da CTIN",
};

export default async function HomePage() {
  const session = await getServerSession();
  const user = session.data?.user;

  if (!user) {
    redirect("/login");
  }

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const todayLabel = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return <HomeOverview name={user.name} todayLabel={todayLabel} />;
}
