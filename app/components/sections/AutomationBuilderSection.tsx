"use client";
import { useState, useRef, useEffect } from "react";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN } from "@/app/lib/theme";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentConfig {
  businessName: string;
  businessType: string;
  city: string;
  serviceArea: string;
  primaryUse: string;
  hours: string;
  bookingProcess: string;
  voiceProvider: "elevenlabs" | "vapi";
  phoneProvider: "twilio" | "telnyx";
  crm: "ghl" | "email";
  summary: string;
}

interface Credentials {
  anthropicKey: string;
  voiceKey: string;
  phoneAccountSid: string;  // Twilio only
  phoneAuthToken: string;   // Twilio only
  phoneKey: string;         // Telnyx only
  phoneNumber: string;
  ghlKey: string;
  ghlLocationId: string;
}

type Phase = "chat" | "vault" | "summary" | "done";

// ── Helpers ────────────────────────────────────────────────────────────────────

function vaultFields(config: AgentConfig): { key: keyof Credentials; label: string; placeholder: string; required: boolean }[] {
  const fields: { key: keyof Credentials; label: string; placeholder: string; required: boolean }[] = [
    { key: "anthropicKey", label: "Anthropic API Key", placeholder: "sk-ant-...", required: true },
  ];

  if (config.voiceProvider === "elevenlabs") {
    fields.push({ key: "voiceKey", label: "ElevenLabs API Key", placeholder: "el-...", required: true });
  } else {
    fields.push({ key: "voiceKey", label: "Vapi API Key", placeholder: "vapi-...", required: true });
  }

  if (config.phoneProvider === "twilio") {
    fields.push({ key: "phoneAccountSid", label: "Twilio Account SID", placeholder: "ACxxxx...", required: true });
    fields.push({ key: "phoneAuthToken", label: "Twilio Auth Token", placeholder: "auth token...", required: true });
  } else {
    fields.push({ key: "phoneKey", label: "Telnyx API Key", placeholder: "KEY...", required: true });
  }

  fields.push({ key: "phoneNumber", label: "Phone Number (E.164)", placeholder: "+13105550100", required: true });

  if (config.crm === "ghl") {
    fields.push({ key: "ghlKey", label: "GoHighLevel API Key", placeholder: "ghl-...", required: true });
    fields.push({ key: "ghlLocationId", label: "GHL Location ID", placeholder: "location id...", required: true });
  }

  return fields;
}

function mask(val: string) {
  if (!val) return "";
  if (val.length <= 8) return "•".repeat(val.length);
  return val.slice(0, 4) + "•".repeat(val.length - 8) + val.slice(-4);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ChatBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div style={{
        maxWidth: "80%",
        padding: "10px 14px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: isUser ? GOLD + "22" : PANEL,
        border: `1px solid ${isUser ? GOLD + "44" : BORDER}`,
        color: TEXT,
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

function ConfigBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
      <span style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", minWidth: 120, paddingTop: 2 }}>{label}</span>
      <span style={{ color: TEXT, fontSize: 12, fontFamily: "monospace", flex: 1 }}>{value}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AutomationBuilderSection() {
  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "What do you want to build? Just tell me in plain English — I'll take it from there." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [creds, setCreds] = useState<Credentials>({
    anthropicKey: "", voiceKey: "", phoneAccountSid: "", phoneAuthToken: "",
    phoneKey: "", phoneNumber: "", ghlKey: "", ghlLocationId: ""
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.phase === "vault" && data.config) {
        setConfig(data.config);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Got everything I need. Let's wire it up — I'll need your API credentials for the tools you chose.`
        }]);
        setTimeout(() => setPhase("vault"), 800);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function vaultComplete() {
    if (!config) return;
    const fields = vaultFields(config);
    return fields.every(f => !f.required || creds[f.key].trim().length > 0);
  }

  const PROVIDER_LABEL: Record<string, string> = {
    elevenlabs: "ElevenLabs", vapi: "Vapi",
    twilio: "Twilio", telnyx: "Telnyx",
    ghl: "GoHighLevel", email: "Email (no CRM)",
  };

  // ── Render: Chat ─────────────────────────────────────────────────────────────
  if (phase === "chat") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>AUTOMATION BUILDER</div>
          <div style={{ color: MUTED, fontSize: 12, fontFamily: "monospace" }}>Voice agent for local service business</div>
        </div>

        {/* Chat window */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: "16px 0",
          display: "flex", flexDirection: "column",
        }}>
          {messages.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: PANEL, border: `1px solid ${BORDER}`, color: MUTED, fontSize: 13, fontFamily: "monospace" }}>
                ···
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type here..."
            rows={2}
            style={{
              flex: 1, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8,
              color: TEXT, fontFamily: "monospace", fontSize: 13, padding: "10px 12px",
              resize: "none", outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              padding: "0 20px", background: loading || !input.trim() ? BORDER : GOLD,
              border: "none", borderRadius: 8, color: loading || !input.trim() ? MUTED : "#000",
              fontFamily: "monospace", fontSize: 12, fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
            SEND
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Vault ─────────────────────────────────────────────────────────────
  if (phase === "vault" && config) {
    const fields = vaultFields(config);
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>CREDENTIAL VAULT</div>
          <div style={{ color: MUTED, fontSize: 12, fontFamily: "monospace" }}>
            Keys are stored in memory only — never sent to a third party.
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ color: TEXT, fontSize: 12, fontFamily: "monospace", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
            Building: <span style={{ color: GOLD }}>{config.businessName}</span> — {config.businessType} voice agent
          </div>

          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", color: MUTED, fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5 }}>
                {f.label}{f.required && <span style={{ color: GOLD }}> *</span>}
              </label>
              <input
                type="password"
                value={creds[f.key]}
                onChange={e => setCreds(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6,
                  color: TEXT, fontFamily: "monospace", fontSize: 12,
                  padding: "8px 12px", outline: "none",
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setPhase("chat")}
            style={{
              padding: "10px 20px", background: "none", border: `1px solid ${BORDER}`,
              borderRadius: 8, color: MUTED, fontFamily: "monospace", fontSize: 12, cursor: "pointer",
            }}
          >
            BACK
          </button>
          <button
            onClick={() => setPhase("summary")}
            disabled={!vaultComplete()}
            style={{
              flex: 1, padding: "10px 20px",
              background: vaultComplete() ? GOLD : BORDER,
              border: "none", borderRadius: 8,
              color: vaultComplete() ? "#000" : MUTED,
              fontFamily: "monospace", fontSize: 12, fontWeight: 600,
              cursor: vaultComplete() ? "pointer" : "not-allowed",
            }}
          >
            REVIEW CONFIGURATION →
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Summary ────────────────────────────────────────────────────────────
  if (phase === "summary" && config) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>HERE&apos;S WHAT WE&apos;LL BUILD</div>
        </div>

        {/* Summary card */}
        <div style={{ background: PANEL, border: `1px solid ${GOLD}44`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ color: GOLD, fontSize: 14, fontFamily: "monospace", fontWeight: 600, marginBottom: 16 }}>
            {config.businessName}
          </div>
          <div style={{ color: TEXT, fontSize: 13, fontFamily: "monospace", lineHeight: 1.7, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
            {config.summary}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            <ConfigBadge label="BUSINESS TYPE" value={config.businessType} />
            <ConfigBadge label="LOCATION" value={`${config.city} — ${config.serviceArea}`} />
            <ConfigBadge label="PRIMARY USE" value={config.primaryUse} />
            <ConfigBadge label="HOURS" value={config.hours} />
            <ConfigBadge label="BOOKING" value={config.bookingProcess} />
            <ConfigBadge label="VOICE" value={PROVIDER_LABEL[config.voiceProvider] ?? config.voiceProvider} />
            <ConfigBadge label="PHONE" value={PROVIDER_LABEL[config.phoneProvider] ?? config.phoneProvider} />
            <ConfigBadge label="CRM" value={PROVIDER_LABEL[config.crm] ?? config.crm} />
          </div>
        </div>

        {/* Credentials summary */}
        <div style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>CREDENTIALS LOADED</div>
          {vaultFields(config).map(f => (
            <div key={f.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: MUTED, fontSize: 11, fontFamily: "monospace" }}>{f.label}</span>
              <span style={{ color: GREEN, fontSize: 11, fontFamily: "monospace" }}>{creds[f.key] ? "✓ " + mask(creds[f.key]) : "—"}</span>
            </div>
          ))}
        </div>

        {/* Notice */}
        <div style={{ background: GOLD + "11", border: `1px solid ${GOLD}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
          <div style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", lineHeight: 1.6 }}>
            Full provisioning is coming in a future release. Confirming saves this configuration for handoff to the provisioning pipeline.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setPhase("vault")}
            style={{
              padding: "10px 20px", background: "none", border: `1px solid ${BORDER}`,
              borderRadius: 8, color: MUTED, fontFamily: "monospace", fontSize: 12, cursor: "pointer",
            }}
          >
            BACK
          </button>
          <button
            onClick={() => setPhase("done")}
            style={{
              flex: 1, padding: "12px 20px",
              background: GOLD, border: "none", borderRadius: 8,
              color: "#000", fontFamily: "monospace", fontSize: 13, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            CONFIRM &amp; GENERATE CONFIGURATION
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────────
  if (phase === "done" && config) {
    return (
      <div style={{ maxWidth: 520, margin: "80px auto", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
        <div style={{ color: GREEN, fontSize: 16, fontFamily: "monospace", fontWeight: 600, marginBottom: 10 }}>
          Configuration Generated
        </div>
        <div style={{ color: TEXT, fontSize: 13, fontFamily: "monospace", lineHeight: 1.7, marginBottom: 24 }}>
          {config.businessName}&apos;s voice agent configuration is ready for provisioning.
          A full provisioning pipeline is coming — this config will be picked up automatically.
        </div>
        <button
          onClick={() => {
            setPhase("chat");
            setMessages([{ role: "assistant", content: "What do you want to build? Just tell me in plain English — I'll take it from there." }]);
            setConfig(null);
            setCreds({ anthropicKey: "", voiceKey: "", phoneAccountSid: "", phoneAuthToken: "", phoneKey: "", phoneNumber: "", ghlKey: "", ghlLocationId: "" });
          }}
          style={{
            padding: "10px 24px", background: "none", border: `1px solid ${GOLD}`,
            borderRadius: 8, color: GOLD, fontFamily: "monospace", fontSize: 12, cursor: "pointer",
          }}
        >
          BUILD ANOTHER AGENT
        </button>
      </div>
    );
  }

  return null;
}
