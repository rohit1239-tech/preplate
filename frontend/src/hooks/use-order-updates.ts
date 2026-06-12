"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { appConfig } from "@/lib/config";
import { queryKeys } from "@/services/query-keys";
import type { Order, OrderStatus } from "@/types";

interface OrderStatusEvent {
  type: "order_status_update";
  order_id: string;
  order_number: string;
  status: OrderStatus;
}

export function useOrderUpdates(enabled: boolean) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const socket = new WebSocket(`${appConfig.wsBaseUrl}/orders/`);
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    socket.onerror = () => setIsConnected(false);
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as OrderStatusEvent;
      if (event.type !== "order_status_update") return;
      queryClient.setQueryData<Order>(queryKeys.order(event.order_id), (current) =>
        current ? { ...current, status: event.status } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    };

    return () => socket.close();
  }, [enabled, queryClient]);

  return { isConnected };
}
