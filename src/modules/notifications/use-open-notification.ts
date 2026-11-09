"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type MouseEvent } from "react";

import type { FeedItem } from "./notification-feed";
import { isPlainClick, needsRead, notificationHref } from "./notification-destination";

/**
 * Abrir uma notificação: se for uma entrega ainda não lida, marca como lida e espera a confirmação da API; depois vai
 * ao projeto relacionado. Se a leitura falhar, `markRead` já avisa o usuário (e a notificação continua não lida): a
 * navegação segue mesmo assim, porque o destino não depende da leitura. Ler nunca resolve a pendência.
 */
export function useOpenNotification(markRead: (item: FeedItem) => Promise<boolean>, onNavigate?: () => void) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);

  const open = useCallback(
    async (item: FeedItem, event: MouseEvent<HTMLElement>) => {
      if (!isPlainClick(event.nativeEvent)) return; // Ctrl/Cmd/botão do meio: o link nativo abre em outra aba.
      event.preventDefault();
      if (opening) return;
      setOpening(item.key);
      try {
        if (needsRead(item)) await markRead(item);
      } finally {
        setOpening(null);
      }
      onNavigate?.();
      router.push(notificationHref(item));
    },
    [markRead, onNavigate, opening, router],
  );

  return { opening, open };
}
