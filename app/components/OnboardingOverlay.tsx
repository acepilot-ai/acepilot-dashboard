"use client";
import { useState, useEffect } from "react";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN } from "@/app/lib/theme";

const STORAGE_KEY = "ace_onboarded";

const STEPS = [
  {
    icon: "⚡",
    title: "Welcome to AcePilot",
    body: "Your AI-powered outreach command center. This quick tour covers the 5 main sections — takes about 60 seconds.",
    section: null,
  },
  {
    icon: "🎯",
    title: "Mission Control",
    body: "Your live dashboard. Every outreach send, reply, and agent action appears here in real time. Watch your stats climb and your agents work.",
    section: "MISSION CONTROL",
  },
  {
    icon: "📋",
    title: "Pipeline",
    body: "Track contacts, opportunities, and closer performance. All data syncs directly from your CRM — no manual entry required.",
    section: "PIPELINE",
  },
  {
    icon: "📊",
    title: "Analytics",
    body: "30-day volume trends, reply rates by trade, sender performance, and territory heat maps. Know exactly what's working and where.",
    section: "ANALYTICS",
  },
  {
    icon: "📡",
    title: "Campaigns",
    body: "Control your outreach campaigns. Pause or resume at any time, manage territories, and view the message templates your agents are sending.",
    section: "CAMPAIGNS",
  },
  {
    icon: "🏗️",
    title: "Workspace",
    body: "Your working space. Todos, notes, files, and direct chat with your AI agent. Everything your team needs in one place.",
    section: "WORKSPACE",
  },
];

interface Props {
  onDismiss: () => void;
}

export default function OnboardingOverlay({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so it fades in after the dashboard renders
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    onDismiss();
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else dismiss();
  }

  function prev() {
    if (step > 0) setStep(s => s - 1);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.82)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.3s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: DARK, border: `1px solid ${GOLD}44`,
        borderRadius: 16, padding: 36,
        display: "flex", flexDirection: "column", gap: 0,
        boxShadow: `0 0 60px ${GOLD}18`,
        margin: "0 16px",
      }}>
        {/* Progress bar */}
        <div style={{ height: 2, background: BORDER, borderRadius: 2, marginBottom: 28, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: GOLD, borderRadius: 2,
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Step counter */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>
            {current.section ?? "OVERVIEW"} · {step + 1} OF {STEPS.length}
          </div>
          <button
            onClick={dismiss}
            style={{
              background: "none", border: "none", color: MUTED,
              fontSize: 11, fontFamily: "monospace", letterSpacing: 1,
              cursor: "pointer", padding: "4px 8px",
            }}
          >
            SKIP TOUR ×
          </button>
        </div>

        {/* Icon */}
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>{current.icon}</div>

        {/* Title */}
        <div style={{
          color: GOLD, fontSize: 18, fontFamily: "monospace",
          fontWeight: 700, marginBottom: 14, textAlign: "center",
        }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{
          color: TEXT, fontSize: 14, fontFamily: "monospace",
          lineHeight: 1.75, textAlign: "center", marginBottom: 32,
        }}>
          {current.body}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={prev}
              style={{
                padding: "11px 20px", background: "none",
                border: `1px solid ${BORDER}`, borderRadius: 8,
                color: MUTED, fontFamily: "monospace", fontSize: 12,
                cursor: "pointer",
              }}
            >
              ← BACK
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 1, padding: "12px 20px",
              background: GOLD, border: "none", borderRadius: 8,
              color: "#000", fontFamily: "monospace",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            {isLast ? "LET'S GO →" : "NEXT →"}
          </button>
        </div>

        {/* Dot indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 20 : 6, height: 6,
                borderRadius: 3, border: "none",
                background: i === step ? GOLD : BORDER,
                cursor: "pointer", padding: 0,
                transition: "width 0.2s ease, background 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook — returns true if the overlay should be shown
export function useShowOnboarding(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);
  return show;
}
