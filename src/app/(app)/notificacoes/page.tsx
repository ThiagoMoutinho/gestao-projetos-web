import type { Metadata } from "next";

import { getServerSession } from "@/modules/auth/session";
import { NotificationCentral } from "@/modules/notifications/notification-central";

export const metadata: Metadata = {
  title: "Notificações · Gestão de Projetos",
  description: "Central de notificações do acompanhamento semanal",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const session = await getServerSession();
  const role = session.data?.user?.role;

  return <NotificationCentral role={typeof role === "string" ? role : null} initialTab={aba === "todas" ? "all" : "mine"} />;
}
