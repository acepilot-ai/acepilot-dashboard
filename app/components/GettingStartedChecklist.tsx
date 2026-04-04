"use client";
import { useState, useEffect } from "react";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN } from "@/app/lib/theme";

const STORAGE_KEY = "ace_checklist";
const DISMISSED_KEY = "ace_checklist_dismissed";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  nav: string;
}

const ITEMS: ChecklistItem[] = [
  {
    id: "connect_ghl",
    label: "Connect GoHighLevel",
    description: "Add your GHL API key so Pipeline and contacts sync automatically.",
    nav: "settings",
  },
  {
    id: "set_territory",
    label: "Set your territory",
    description: "Define where your agents will run outreach.",
    nav: "campaigns",
  },
  {
    id: "run_campaign",
    label: "Launch your first campaign",
    description: "Start your outreach — your agents will handle the rest.",
    nav: "campaigns",
  },
];

interface Props {
  onNavigate: (nav: string) => void;
}

export default function GettingStartedChecklist({ onNavigate }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    if (saved) setChecked(JSON.parse(saved));
    if (wasDismissed) setDismissed(true);
    setMounted(true);
  }, []);

  function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!mounted || dismissed) return null;

  const allDone = ITEMS.every(i => checked[i.id]);
  const doneCount = ITEMS.filter(i => checked[i.id]).length;

  if (allDone) {
    return (
      <div style={{
        background: GREEN + "11", border: `1px solid ${GREEN}44`,
        borderRadius: 10, padding: "12px 16px", marginBottom: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: GREEN, fontSize: 16 }}>✓</span>
          <span style={{ color: GREEN, fontFamily: "monospace", fontSize: 12 }}>
            All set — you&apos;re ready to run.
          </span>
        </div>
        <button onClick={dismiss} style={{ background: "none", border: "none", color: MUTED, fontSize: 16, cursor: "pointer" }}>×</button>
      </div>
    );
  }

  return (
    <div style={{
      background: PANEL, border: `1px solid ${BORDER}`,
      borderRadius: 10, marginBottom: 20, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>GETTING STARTED</span>
          <span style={{
            background: GOLD + "22", border: `1px solid ${GOLD}44`,
            borderRadius: 10, padding: "1px 8px",
            color: GOLD, fontSize: 10, fontFamily: "monospace",
          }}>
            {doneCount}/{ITEMS.length}
          </span>
        </div>
        <button onClick={dismiss} style={{ background: "none", border: "none", color: MUTED, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: BORDER }}>
        <div style={{
          height: "100%", background: GOLD,
          width: `${(doneCount / ITEMS.length) * 100}%`,
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* Items */}
      {ITEMS.map((item, i) => {
        const done = !!checked[item.id];
        return (
          <div
            key={item.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 16px",
              borderBottom: i < ITEMS.length - 1 ? `1px solid ${BORDER}` : "none",
              opacity: done ? 0.5 : 1,
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => toggle(item.id)}
              style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${done ? GREEN : BORDER}`,
                background: done ? GREEN : "none",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginTop: 1,
              }}
            >
              {done && <span style={{ color: "#000", fontSize: 10, lineHeight: 1 }}>✓</span>}
            </button>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{
                color: done ? MUTED : TEXT,
                fontSize: 12, fontFamily: "monospace", fontWeight: 600,
                textDecoration: done ? "line-through" : "none", marginBottom: 3,
              }}>
                {item.label}
              </div>
              <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", lineHeight: 1.5 }}>
                {item.description}
              </div>
            </div>

            {/* Nav link */}
            {!done && (
              <button
                onClick={() => onNavigate(item.nav)}
                style={{
                  background: "none", border: `1px solid ${GOLD}44`,
                  borderRadius: 6, padding: "4px 10px",
                  color: GOLD, fontSize: 10, fontFamily: "monospace",
                  cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                }}
              >
                GO →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
