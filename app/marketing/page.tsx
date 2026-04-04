"use client";
import { useState } from "react";

// ── Design tokens ──────────────────────────────────────────────────────────────
const GOLD   = "#C9A84C";
const DARK   = "#0A0A0F";
const PANEL  = "#12121A";
const BORDER = "#1E1E2E";
const TEXT   = "#E8E8F0";
const MUTED  = "#6B6B8A";
const GREEN  = "#2ECC71";

// ── Tier data ──────────────────────────────────────────────────────────────────
const TIERS = [
  {
    name: "Starter",
    price: "$99",
    period: "/month",
    tagline: "One agent. One campaign. Full power.",
    features: [
      "1 AI agent",
      "300 outreach contacts/day",
      "Basic analytics",
      "1 closer seat",
      "Email support",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$299",
    period: "/month",
    tagline: "Scale your operation.",
    features: [
      "3 AI agents",
      "Full analytics suite",
      "Territory manager",
      "5 closer seats",
      "Pipeline + CRM sync",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$499",
    period: "/month",
    tagline: "White-label and resell.",
    features: [
      "Unlimited AI agents",
      "White-label rights",
      "Resell to your clients",
      "Unlimited seats",
      "Full automation builder",
      "Dedicated onboarding",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tell us what you need",
    body: "Type what you want in plain English. AcePilot interviews you, collects your tools, and wires everything together.",
  },
  {
    number: "02",
    title: "Agents go to work",
    body: "Your AI agents run outreach, classify replies, route leads, and update your CRM — automatically, around the clock.",
  },
  {
    number: "03",
    title: "You close the deals",
    body: "Warm leads land in your pipeline, pre-qualified and ready. Your closers handle conversations. Agents handle everything else.",
  },
];

// ── Sign-up form ───────────────────────────────────────────────────────────────
function SignupForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", business: "", tier: "Growth" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // v1: just a short delay, manual provisioning
    await new Promise(r => setTimeout(r, 1200));
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <div style={{ color: GREEN, fontSize: 18, fontFamily: "monospace", fontWeight: 700, marginBottom: 12 }}>
          You&apos;re on the list.
        </div>
        <div style={{ color: MUTED, fontSize: 13, fontFamily: "monospace", lineHeight: 1.7 }}>
          We&apos;ll have your workspace ready within 24 hours.<br />
          Check {form.email} for next steps.
        </div>
        <button onClick={onClose} style={{ marginTop: 24, padding: "10px 24px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}>
          CLOSE
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", fontWeight: 700, marginBottom: 4, textAlign: "center" }}>
        Start your 30-day free trial
      </div>
      <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", textAlign: "center", marginBottom: 8 }}>
        No credit card required. Manual provisioning for v1 — we&apos;ll set you up within 24 hours.
      </div>

      {[
        { key: "name", label: "Your Name", placeholder: "Ron Parent" },
        { key: "email", label: "Work Email", placeholder: "ron@yourbusiness.com" },
        { key: "business", label: "Business Name", placeholder: "Precision Data Strategies LLC" },
      ].map(f => (
        <div key={f.key}>
          <label style={{ display: "block", color: MUTED, fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5 }}>{f.label}</label>
          <input
            required
            type={f.key === "email" ? "email" : "text"}
            placeholder={f.placeholder}
            value={form[f.key as keyof typeof form]}
            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
            style={{ width: "100%", boxSizing: "border-box", background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontFamily: "monospace", fontSize: 13, padding: "10px 12px", outline: "none" }}
          />
        </div>
      ))}

      <div>
        <label style={{ display: "block", color: MUTED, fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5 }}>Plan</label>
        <select
          value={form.tier}
          onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}
          style={{ width: "100%", background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontFamily: "monospace", fontSize: 13, padding: "10px 12px", outline: "none" }}
        >
          <option>Starter — $99/mo</option>
          <option>Growth — $299/mo</option>
          <option>Agency — $499/mo</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{ marginTop: 8, padding: "13px", background: loading ? BORDER : GOLD, border: "none", borderRadius: 8, color: loading ? MUTED : "#000", fontFamily: "monospace", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "SUBMITTING..." : "START FREE TRIAL →"}
      </button>
    </form>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────────
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: PANEL, border: `1px solid ${GOLD}44`, borderRadius: 16, padding: 32, boxShadow: `0 0 60px ${GOLD}18` }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <div style={{ background: DARK, color: TEXT, minHeight: "100vh", fontFamily: "monospace" }}>

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: DARK + "ee", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: GOLD, fontSize: 22 }}>◉</span>
            <span style={{ color: TEXT, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>ACEPILOT</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a href="#how" style={{ color: MUTED, fontSize: 11, letterSpacing: 1, textDecoration: "none" }}>HOW IT WORKS</a>
            <a href="#pricing" style={{ color: MUTED, fontSize: 11, letterSpacing: 1, textDecoration: "none" }}>PRICING</a>
            <a href="#agencies" style={{ color: MUTED, fontSize: 11, letterSpacing: 1, textDecoration: "none" }}>AGENCIES</a>
            <button
              onClick={() => setSignupOpen(true)}
              style={{ padding: "8px 18px", background: GOLD, border: "none", borderRadius: 6, color: "#000", fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}
            >
              FREE TRIAL
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center" }}>
        <div style={{ color: GOLD, fontSize: 64, marginBottom: 24, lineHeight: 1 }}>◉</div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 20px", letterSpacing: -1, color: TEXT }}>
          Deploy AI agents that<br />
          <span style={{ color: GOLD }}>run your outreach.</span>
        </h1>
        <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.8, maxWidth: 520, margin: "0 auto 40px" }}>
          AcePilot wires together your outreach, CRM, and voice tools into a single AI-powered command center. Your agents work 24/7. You close the deals.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setSignupOpen(true)}
            style={{ padding: "14px 32px", background: GOLD, border: "none", borderRadius: 8, color: "#000", fontFamily: "monospace", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}
          >
            START YOUR 30-DAY TRIAL →
          </button>
          <a
            href="/login"
            style={{ padding: "14px 24px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontFamily: "monospace", fontSize: 13, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            LOG IN
          </a>
        </div>
        <div style={{ marginTop: 20, color: MUTED, fontSize: 11, letterSpacing: 1 }}>
          No credit card required &nbsp;·&nbsp; 30-day free trial &nbsp;·&nbsp; Cancel anytime
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "20px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center", gap: "clamp(24px, 5vw, 80px)", flexWrap: "wrap" }}>
          {[
            { value: "300+", label: "contacts/day per campaign" },
            { value: "6", label: "AI agents deployed" },
            { value: "24/7", label: "automated outreach" },
            { value: "$0", label: "manual follow-up cost" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ color: GOLD, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: MUTED, fontSize: 10, letterSpacing: 1, marginTop: 3 }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ maxWidth: 1000, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, margin: 0 }}>Three steps to a working AI agent</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {STEPS.map(s => (
            <div key={s.number} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
              <div style={{ color: GOLD, fontSize: 32, fontWeight: 800, marginBottom: 16, opacity: 0.6 }}>{s.number}</div>
              <div style={{ color: TEXT, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{s.title}</div>
              <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.7 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: PANEL, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>PRICING</div>
            <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, margin: "0 0 12px" }}>Simple, transparent pricing</h2>
            <div style={{ color: MUTED, fontSize: 14 }}>30-day free trial on every plan. No credit card required.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {TIERS.map(t => (
              <div
                key={t.name}
                style={{
                  background: t.highlight ? DARK : PANEL,
                  border: `1px solid ${t.highlight ? GOLD : BORDER}`,
                  borderRadius: 14,
                  padding: 28,
                  position: "relative",
                  boxShadow: t.highlight ? `0 0 40px ${GOLD}18` : "none",
                }}
              >
                {t.highlight && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: GOLD, color: "#000", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "4px 14px", borderRadius: 20 }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ color: t.highlight ? GOLD : TEXT, fontSize: 13, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{t.name.toUpperCase()}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: TEXT }}>{t.price}</span>
                  <span style={{ color: MUTED, fontSize: 13 }}>{t.period}</span>
                </div>
                <div style={{ color: MUTED, fontSize: 12, marginBottom: 24 }}>{t.tagline}</div>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                  {t.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: GREEN, fontSize: 12, marginTop: 1 }}>✓</span>
                      <span style={{ color: TEXT, fontSize: 12, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSignupOpen(true)}
                  style={{
                    width: "100%", padding: "12px",
                    background: t.highlight ? GOLD : "none",
                    border: `1px solid ${t.highlight ? GOLD : BORDER}`,
                    borderRadius: 8, color: t.highlight ? "#000" : TEXT,
                    fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", letterSpacing: 1,
                  }}
                >
                  {t.cta.toUpperCase()} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AGENCY MATH ── */}
      <section id="agencies" style={{ maxWidth: 840, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>FOR AGENCIES</div>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, margin: "0 0 16px" }}>
            The white-label math is obvious.
          </h2>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.8, maxWidth: 500, margin: "0 auto" }}>
            Pay $499/month for the Agency plan. Resell AcePilot workspaces to your clients at $299/month each. With 10 clients, you net $2,490/month on autopilot.
          </p>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 32, marginBottom: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
            {[
              { label: "Your Agency Cost", value: "$499", sub: "per month", color: TEXT },
              { label: "Per Client Charge", value: "$299", sub: "per month", color: GOLD },
              { label: "Clients Needed to Break Even", value: "2", sub: "clients", color: TEXT },
              { label: "Net at 10 Clients", value: "$2,491", sub: "per month", color: GREEN },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ color: s.color, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
                <div style={{ color: MUTED, fontSize: 10, letterSpacing: 1 }}>{s.sub.toUpperCase()}</div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { title: "Your brand, not ours", body: "Full white-label rights. Clients see your agency name throughout." },
            { title: "Your clients' API costs", body: "Clients connect their own Twilio, ElevenLabs, and GHL accounts. You never touch their infrastructure." },
            { title: "Unlimited scale", body: "No per-seat fees at the Agency tier. Add clients without adding cost." },
          ].map(f => (
            <div key={f.title} style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ color: TEXT, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
              <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.6 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: PANEL, borderTop: `1px solid ${BORDER}`, padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ color: GOLD, fontSize: 48, marginBottom: 20 }}>◉</div>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, margin: "0 0 16px" }}>
            Ready to put your outreach on autopilot?
          </h2>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.8, marginBottom: 32 }}>
            30 days free. No credit card. We&apos;ll have your workspace running within 24 hours.
          </p>
          <button
            onClick={() => setSignupOpen(true)}
            style={{ padding: "16px 40px", background: GOLD, border: "none", borderRadius: 8, color: "#000", fontFamily: "monospace", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}
          >
            START YOUR 30-DAY TRIAL →
          </button>
          <div style={{ marginTop: 16, color: MUTED, fontSize: 11, letterSpacing: 1 }}>
            No credit card &nbsp;·&nbsp; Manual provisioning v1 — live within 24 hours
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ color: GOLD }}>◉</span>
          <span style={{ color: MUTED, fontSize: 11, letterSpacing: 2 }}>ACEPILOT.AI</span>
        </div>
        <div style={{ color: MUTED, fontSize: 11 }}>
          © 2026 Precision Data Strategies LLC &nbsp;·&nbsp;
          <a href="/login" style={{ color: MUTED, textDecoration: "none" }}>Dashboard Login</a>
        </div>
      </footer>

      {/* ── SIGNUP MODAL ── */}
      <Modal open={signupOpen} onClose={() => setSignupOpen(false)}>
        <SignupForm onClose={() => setSignupOpen(false)} />
      </Modal>

    </div>
  );
}
