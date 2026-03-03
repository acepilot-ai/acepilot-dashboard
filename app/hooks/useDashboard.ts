"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ActivityItem {
  ts: string;
  type: "SEND" | "REPLY" | "SCAN" | "ALERT" | "REPORT" | "ERROR";
  msg: string;
  // Enriched detail fields (populated from JSONL)
  business_name?: string;
  website?: string;
  address?: string;
  trade?: string;
  sender?: string;
  outcome?: string;
  territory?: string;
  place_id?: string;
  ghl_contact?: string;
  from_email?: string;
  classification?: string;
}

export interface AgentStatus {
  name: string;
  last_modified: string; // ISO string
  today_count: number;
  status: "running" | "idle" | "error";
}

export interface StatsCache {
  generated_at: string;
  pds: {
    total: number;
    today: number;
    by_outcome: { form: number; email: number; skip: number; error: number };
    today_by_outcome: { form: number; email: number; skip: number; error: number };
    by_sender: Record<string, { total: number; today: number; form: number; email: number; replies: number; interested: number }>;
    by_trade:  Record<string, { total: number; form: number; email: number; replies: number; interested: number }>;
    rolling_7d:  Array<{ date: string; total: number; form: number; email: number; replies: number }>;
    rolling_30d: Array<{ date: string; total: number; form: number; email: number }>;
  };
  stephie: {
    total: number;
    today: number;
    by_outcome: { form: number; email: number; skip: number; error: number };
    today_by_outcome: { form: number; email: number; skip: number; error: number };
    rolling_30d: Array<{ date: string; total: number }>;
  };
  replies: {
    total: number;
    by_classification: Record<string, number>;
  };
  activity: ActivityItem[];
  agents: Record<string, { last_modified: string; today_count: number }>;
}

export interface GHLData {
  total_contacts: number;
  open_opportunities: number;
  closers: Array<{
    name: string;
    id: string;
    territory: string;
    leads: number;
    sends: number;
    cold: number;
  }>;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
  created_by: string;
}

export interface FileEntry {
  name: string;
  size: number;
  uploaded_at: string;
  uploaded_by: string;
  gist_file_key: string;
  download_url: string;
}

export interface WorkspaceData {
  todos: Todo[];
  notes: string;
  files: FileEntry[];
}

// ── Polling hook factory ───────────────────────────────────────────────────────

function usePolling<T>(
  url: string,
  intervalMs: number
): { data: T | null; loading: boolean; error: string | null; lastUpdated: Date | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const resp = await fetch(url, { signal: abortRef.current.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchData, intervalMs]);

  return { data, loading, error, lastUpdated, refresh: fetchData };
}

// ── Exported hooks ─────────────────────────────────────────────────────────────

export function useStats() {
  return usePolling<StatsCache>("/api/stats", 60_000);
}

export function useGHL() {
  return usePolling<GHLData>("/api/ghl", 120_000);
}

export function useClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Workspace hook (mutation-aware) ───────────────────────────────────────────

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch("/api/workspace");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setData(await resp.json());
      setError(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    const resp = await fetch("/api/workspace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    await load();
    return resp.json();
  }, [load]);

  return { data, loading, error, refresh: load, mutate };
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function relativeTime(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
