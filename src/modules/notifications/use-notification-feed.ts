"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { ApiError } from "@/lib/api/fetcher";
import { reportFailure } from "@/lib/feedback";
import {
  listMyNotifications,
  listNotifications,
  markNotificationRead,
} from "@/lib/api/generated/notificações-do-acompanhamento/notificações-do-acompanhamento";

import {
  allParams,
  feedReducer,
  fromAll,
  fromInbox,
  INITIAL_FEED,
  inboxParams,
  PAGE_SIZE,
  type FeedFilters,
  type FeedItem,
  type FeedTab,
} from "./notification-feed";

/** Avisa o sino (e quem mais ouvir) que as notificações mudaram. */
export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed";

async function fetchPage(tab: FeedTab, filters: FeedFilters, limit: number, cursor?: string): Promise<{ items: FeedItem[]; nextCursor: string | null; unread: number | null }> {
  if (tab === "mine") {
    const response = await listMyNotifications(inboxParams(filters, cursor, limit));
    if (response.status !== 200) throw new ApiError(response.status, "HTTP_ERROR", "A consulta das notificações falhou.");
    return { items: response.data.data.map(fromInbox), nextCursor: response.data.nextCursor, unread: response.data.unread };
  }
  const response = await listNotifications(allParams(filters, cursor, limit));
  if (response.status !== 200) throw new ApiError(response.status, "HTTP_ERROR", "A consulta das notificações falhou.");
  return { items: response.data.data.map(fromAll), nextCursor: response.data.nextCursor, unread: null };
}

/**
 * Lista paginada (por cursor) das notificações: recomeça ao trocar de aba ou de filtro e ignora respostas atrasadas.
 * A leitura só aparece como feita depois da confirmação da API; ler nunca resolve a pendência.
 */
export function useNotificationFeed(tab: FeedTab, filters: FeedFilters, enabled: boolean, limit: number = PAGE_SIZE) {
  const [state, dispatch] = useReducer(feedReducer, INITIAL_FEED);
  const [version, setVersion] = useState(0);
  const [marking, setMarking] = useState<string | null>(null);
  const request = useRef(0);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) return;
    const id = ++request.current;
    dispatch({ type: "reset" });
    fetchPage(tab, JSON.parse(filtersKey) as FeedFilters, limit)
      .then((page) => {
        if (id === request.current) dispatch({ type: "loaded", ...page, append: false });
      })
      .catch((error: unknown) => {
        if (id === request.current) dispatch({ type: "failed", forbidden: error instanceof ApiError && error.status === 403 });
      });
  }, [tab, filtersKey, version, enabled, limit]);

  const cursor = state.nextCursor;
  const loadMore = useCallback(() => {
    if (!cursor) return;
    const id = request.current;
    dispatch({ type: "loadingMore" });
    fetchPage(tab, JSON.parse(filtersKey) as FeedFilters, limit, cursor)
      .then((page) => {
        if (id === request.current) dispatch({ type: "loaded", ...page, append: true });
      })
      .catch(() => {
        if (id === request.current) dispatch({ type: "loadMoreFailed" });
      });
  }, [tab, filtersKey, cursor, limit]);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  const markRead = useCallback(async (item: FeedItem) => {
    if (!item.deliveryId || item.readAt) return false;
    setMarking(item.deliveryId);
    try {
      const response = await markNotificationRead(item.deliveryId);
      if (response.status !== 200) throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível marcar como lida.");
      // Só depois da confirmação da API a leitura aparece como feita.
      dispatch({ type: "markedRead", deliveryId: item.deliveryId, readAt: response.data.readAt });
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      return true;
    } catch (error) {
      reportFailure(error, "Não foi possível marcar a notificação como lida.");
      return false;
    } finally {
      setMarking(null);
    }
  }, []);

  return { state, marking, loadMore, refresh, markRead };
}
