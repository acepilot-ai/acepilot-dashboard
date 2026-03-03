"use client";
import { useState, useEffect, useCallback } from "react";

export interface ThreadMessage {
  id: string;
  from: "ace" | "trinity";
  content: string;
  ts: string;
  sent_by: string;
}

export function usePollingChannel(intervalMs = 15_000) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const resp = await fetch("/api/agent-relay");
      if (resp.ok) setMessages(await resp.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  const relay = useCallback(async (from: "ace" | "trinity", content: string, sent_by: string) => {
    await fetch("/api/agent-relay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, content, sent_by }),
    });
    await load();
  }, [load]);

  return { messages, loading, relay, refresh: load };
}
