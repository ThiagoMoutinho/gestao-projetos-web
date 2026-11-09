import type { ListMyNotifications200DataItem } from "@/lib/api/generated/model/listMyNotifications200DataItem";
import type { ListMyNotificationsParams } from "@/lib/api/generated/model/listMyNotificationsParams";
import type { ListNotifications200DataItem } from "@/lib/api/generated/model/listNotifications200DataItem";
import type { ListNotificationsParams } from "@/lib/api/generated/model/listNotificationsParams";

import { isNotificationKind, type NotificationKind } from "./notification-state.ts";

/** Quantos cartões cada página traz. */
export const PAGE_SIZE = 20;

/**
 * Uma notificação como a lista a exibe. Na aba "Minhas" há leitura individual (`readAt`, `deliveryId`, `visibility`);
 * na aba "Todas" (ADMIN e PMO) há o resumo dos destinatários (`recipients`, `unread`).
 */
export type FeedItem = {
  /** Chave única na lista: a entrega (Minhas) ou a notificação (Todas). */
  key: string;
  notificationId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  projectId: string;
  projectName: string;
  cycleStart: string;
  sequenceStart: string | null;
  dueDate: string;
  scheduledFor: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionReason: string | null;
  deliveryId: string | null;
  visibility: "TO" | "CC" | null;
  deliveredAt: string | null;
  readAt: string | null;
  recipients: number | null;
  unread: number | null;
};

export type FeedTab = "mine" | "all";

export type FeedFilters = {
  kind: "" | NotificationKind;
  projectId: string;
  read: "" | "UNREAD" | "READ";
  pending: "" | "PENDING" | "RESOLVED";
};

export const EMPTY_FILTERS: FeedFilters = { kind: "", projectId: "", read: "", pending: "" };

export function hasActiveFilters(filters: FeedFilters) {
  return filters.kind !== "" || filters.projectId !== "" || filters.read !== "" || filters.pending !== "";
}

/** Filtros da lista (tipo, projeto e pendência). A leitura é escolhida nas abas Todas/Não lidas/Lidas, não é "filtro de lista". */
export function hasListFilters(filters: FeedFilters) {
  return filters.kind !== "" || filters.projectId !== "" || filters.pending !== "";
}

/** Parâmetros da caixa de entrada: leitura individual (`read`) e pendência (`resolved`). */
export function inboxParams(filters: FeedFilters, cursor?: string, limit = PAGE_SIZE): ListMyNotificationsParams {
  return {
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.read ? { read: filters.read === "READ" ? "true" : "false" } : {}),
    ...(filters.pending ? { resolved: filters.pending === "RESOLVED" ? "true" : "false" } : {}),
    ...(cursor ? { cursor } : {}),
    limit,
  };
}

/** Parâmetros de "Todas": a leitura é por destinatário, então "não lida" = ainda há quem não leu; "lida" = todos leram. */
export function allParams(filters: FeedFilters, cursor?: string, limit = PAGE_SIZE): ListNotificationsParams {
  return {
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.read ? { unread: filters.read === "UNREAD" ? "true" : "false" } : {}),
    ...(filters.pending ? { resolved: filters.pending === "RESOLVED" ? "true" : "false" } : {}),
    ...(cursor ? { cursor } : {}),
    limit,
  };
}

function kindOf(value: string): NotificationKind {
  if (!isNotificationKind(value)) {
    throw new Error(`Tipo de notificação desconhecido: ${value}`);
  }
  return value;
}

export function fromInbox(item: ListMyNotifications200DataItem): FeedItem {
  const n = item.notification;
  return {
    key: `mine:${item.deliveryId}`,
    notificationId: n.id,
    kind: kindOf(n.kind),
    title: n.title,
    body: n.body,
    projectId: n.projectId,
    projectName: n.projectName,
    cycleStart: n.cycleStart,
    sequenceStart: n.sequenceStart,
    dueDate: n.dueDate,
    scheduledFor: n.scheduledFor,
    createdAt: n.createdAt,
    resolvedAt: n.resolvedAt,
    resolutionReason: n.resolutionReason,
    deliveryId: item.deliveryId,
    visibility: item.visibility,
    deliveredAt: item.deliveredAt,
    readAt: item.readAt,
    recipients: null,
    unread: null,
  };
}

export function fromAll(item: ListNotifications200DataItem): FeedItem {
  return {
    key: `all:${item.id}`,
    notificationId: item.id,
    kind: kindOf(item.kind),
    title: item.title,
    body: item.body,
    projectId: item.projectId,
    projectName: item.projectName,
    cycleStart: item.cycleStart,
    sequenceStart: item.sequenceStart,
    dueDate: item.dueDate,
    scheduledFor: item.scheduledFor,
    createdAt: item.createdAt,
    resolvedAt: item.resolvedAt,
    resolutionReason: item.resolutionReason,
    deliveryId: null,
    visibility: null,
    deliveredAt: item.createdAt,
    readAt: null,
    recipients: item.recipients,
    unread: item.unread,
  };
}

export type FeedState = {
  status: "loading" | "ready" | "error" | "forbidden";
  items: FeedItem[];
  nextCursor: string | null;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  /** Total de não lidas do usuário (só na aba Minhas). */
  unread: number | null;
};

export const INITIAL_FEED: FeedState = { status: "loading", items: [], nextCursor: null, loadingMore: false, loadMoreFailed: false, unread: null };

export type FeedAction =
  | { type: "reset" }
  | { type: "loaded"; items: FeedItem[]; nextCursor: string | null; unread: number | null; append: boolean }
  | { type: "failed"; forbidden: boolean }
  | { type: "loadingMore" }
  | { type: "loadMoreFailed" }
  | { type: "markedRead"; deliveryId: string; readAt: string };

/** Junta páginas sem repetir: se um item já está na lista (mesma chave), o existente é mantido. */
function mergeUnique(current: FeedItem[], incoming: FeedItem[]) {
  const seen = new Set(current.map((item) => item.key));
  return [...current, ...incoming.filter((item) => !seen.has(item.key))];
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "reset":
      return { ...INITIAL_FEED, unread: state.unread };
    case "loaded":
      return {
        status: "ready",
        items: action.append ? mergeUnique(state.items, action.items) : mergeUnique([], action.items),
        nextCursor: action.nextCursor,
        loadingMore: false,
        loadMoreFailed: false,
        unread: action.unread ?? state.unread,
      };
    case "failed":
      return { ...state, status: action.forbidden ? "forbidden" : "error", loadingMore: false };
    case "loadingMore":
      return { ...state, loadingMore: true, loadMoreFailed: false };
    case "loadMoreFailed":
      return { ...state, loadingMore: false, loadMoreFailed: true };
    case "markedRead": {
      // A leitura só é refletida depois da confirmação da API; marcar de novo não altera nada (idempotente).
      const target = state.items.find((item) => item.deliveryId === action.deliveryId);
      if (!target || target.readAt) return state;
      return {
        ...state,
        items: state.items.map((item) => (item.deliveryId === action.deliveryId ? { ...item, readAt: action.readAt } : item)),
        unread: state.unread === null ? null : Math.max(0, state.unread - 1),
      };
    }
  }
}
