"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// ── User store (prototype: env vars + Vercel API) ───────────────────────────
// Production: swap this layer for a real database. UX is identical.

function getUsers(): Record<string, { password: string; role: string; envKey: string }> {
  const users: Record<string, { password: string; role: string; envKey: string }> = {};
  if (process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD) {
    users[process.env.DASHBOARD_USERNAME] = {
      password: process.env.DASHBOARD_PASSWORD,
      role: "SUPER_ADMIN",
      envKey: "DASHBOARD_PASSWORD",
    };
  }
  if (process.env.TAYLOR_DASHBOARD_USERNAME && process.env.TAYLOR_DASHBOARD_PASSWORD) {
    users[process.env.TAYLOR_DASHBOARD_USERNAME] = {
      password: process.env.TAYLOR_DASHBOARD_PASSWORD,
      role: "ADMIN",
      envKey: "TAYLOR_DASHBOARD_PASSWORD",
    };
  }
  return users;
}

async function persistPassword(envKey: string, newPassword: string): Promise<void> {
  const vercelToken = process.env.VERCEL_TOKEN;
  const project = "acepilot-dashboard";
  if (!vercelToken) return;

  // Find existing env var ID
  const listRes = await fetch(`https://api.vercel.com/v10/projects/${project}/env`, {
    headers: { Authorization: `Bearer ${vercelToken}` },
  });
  if (!listRes.ok) return;
  const listData = await listRes.json();
  const existing = (listData.envs || []).find((e: { key: string }) => e.key === envKey);

  if (existing?.id) {
    // Patch existing
    await fetch(`https://api.vercel.com/v10/projects/${project}/env/${existing.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: newPassword }),
    });
  } else {
    // Create new
    await fetch(`https://api.vercel.com/v10/projects/${project}/env`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        key: envKey,
        value: newPassword,
        type: "encrypted",
        target: ["production", "preview", "development"],
      }),
    });
  }
}

// ── Server action ───────────────────────────────────────────────────────────

async function changePassword(formData: FormData) {
  "use server";
  const jar = await cookies();
  const username = jar.get("ace_user")?.value || "";
  const current = (formData.get("current") as string || "").trim();
  const next = (formData.get("next") as string || "").trim();
  const confirm = (formData.get("confirm") as string || "").trim();

  const users = getUsers();
  const user = users[username];

  if (!user || user.password !== current) {
    redirect("/account?error=wrong_password");
  }
  if (next.length < 8) {
    redirect("/account?error=too_short");
  }
  if (next !== confirm) {
    redirect("/account?error=mismatch");
  }

  // Update session cookie immediately — user stays logged in
  const opts = { maxAge: 86400 * 30, path: "/" } as const;
  jar.set("auth", next, { ...opts, httpOnly: true });

  // Persist to Vercel env in background (best-effort for prototype)
  await persistPassword(user.envKey, next);

  redirect("/account?success=1");
}

// ── Page ───────────────────────────────────────────────────────────────────

const GOLD   = "#C9A84C";
const DARK   = "#080810";
const PANEL  = "#0D0D1A";
const BORDER = "#1A1A2E";
const TEXT   = "#E8E8F0";
const MUTED  = "#555570";
const GREEN  = "#2ECC71";
const RED    = "#E74C3C";
const BLUE   = "#3498DB";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const username = jar.get("ace_user")?.value || "";
  const role = jar.get("ace_role")?.value || "";

  if (!username) redirect("/login");

  const errorMessages: Record<string, string> = {
    wrong_password: "Current password is incorrect.",
    too_short: "New password must be at least 8 characters.",
    mismatch: "New passwords do not match.",
  };
  const errorMsg = params.error ? errorMessages[params.error] || "An error occurred." : null;
  const success = !!params.success;

  const roleColor = role === "SUPER_ADMIN" ? GOLD : role === "ADMIN" ? BLUE : MUTED;
  const roleLabel = role === "SUPER_ADMIN" ? "SUPER ADMIN" : role === "ADMIN" ? "ADMIN" : role;

  return (
    <div style={{ minHeight: "100vh", background: DARK, fontFamily: "monospace", color: TEXT }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Top bar */}
      <div style={{
        padding: "16px 32px", borderBottom: `1px solid ${BORDER}`,
        background: PANEL, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/ace-logo.png" alt="AcePilot" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: 3 }}>ACEPILOT.AI</span>
          </a>
          <span style={{ color: BORDER }}>›</span>
          <span style={{ fontSize: 11, color: MUTED, letterSpacing: 2 }}>ACCOUNT</span>
        </div>
        <a href="/" style={{
          fontSize: 10, color: MUTED, letterSpacing: 1, textDecoration: "none",
          border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px",
        }}>← DASHBOARD</a>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 24px" }}>

        {/* Profile card */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: "28px 32px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 2, marginBottom: 20 }}>PROFILE</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#14142A", border: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: roleColor,
            }}>
              {username[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, color: TEXT, letterSpacing: 1 }}>{username}</div>
              <div style={{ fontSize: 10, color: roleColor, letterSpacing: 2, marginTop: 4 }}>{roleLabel}</div>
            </div>
          </div>
        </div>

        {/* Password change card */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: "28px 32px",
        }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 2, marginBottom: 24 }}>CHANGE PASSWORD</div>

          {success && (
            <div style={{
              background: "#0A1F0A", border: `1px solid ${GREEN}`,
              borderRadius: 8, padding: "12px 16px",
              fontSize: 12, color: GREEN, marginBottom: 20,
            }}>
              Password updated. You are still logged in.
            </div>
          )}

          {errorMsg && (
            <div style={{
              background: "#1A0A0A", border: `1px solid ${RED}`,
              borderRadius: 8, padding: "12px 16px",
              fontSize: 12, color: RED, marginBottom: 20,
            }}>
              {errorMsg}
            </div>
          )}

          <form action={changePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { name: "current", label: "CURRENT PASSWORD" },
              { name: "next",    label: "NEW PASSWORD" },
              { name: "confirm", label: "CONFIRM NEW PASSWORD" },
            ].map(({ name, label }) => (
              <div key={name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, color: MUTED }}>{label}</label>
                <input
                  name={name}
                  type="password"
                  autoComplete={name === "current" ? "current-password" : "new-password"}
                  required
                  style={{
                    background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8,
                    padding: "11px 14px", color: TEXT, fontSize: 13,
                    fontFamily: "monospace", outline: "none", width: "100%",
                  }}
                />
              </div>
            ))}

            <button type="submit" style={{
              marginTop: 8, background: GOLD, border: "none", borderRadius: 8,
              padding: "12px", color: DARK, fontSize: 12, fontWeight: 700,
              letterSpacing: 2, cursor: "pointer", fontFamily: "monospace",
            }}>
              UPDATE PASSWORD
            </button>
          </form>
        </div>

        <div style={{ fontSize: 10, color: "#1A1A2E", textAlign: "center", marginTop: 24 }}>
          Precision Data Strategies LLC
        </div>
      </div>
    </div>
  );
}
