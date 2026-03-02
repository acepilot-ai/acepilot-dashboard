import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;
  if (
    username === process.env.DASHBOARD_USERNAME &&
    password === process.env.DASHBOARD_PASSWORD
  ) {
    const cookieStore = await cookies();
    cookieStore.set("auth", password, {
      httpOnly: true,
      maxAge: 86400 * 30,
      path: "/",
    });
    redirect("/");
  } else {
    redirect("/login?error=1");
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = !!params.error;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080810",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "monospace",
    }}>
      <div style={{
        background: "#0D0D1A",
        border: "1px solid #1A1A2E",
        borderRadius: 16,
        padding: "40px 48px",
        width: 380,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#555570", letterSpacing: 3 }}>ACEPILOT.AI</div>
          <div style={{ fontSize: 22, color: "#C9A84C", fontWeight: 700, letterSpacing: 2 }}>MISSION CONTROL</div>
          <div style={{ fontSize: 11, color: "#555570" }}>Authorized personnel only</div>
        </div>

        <form action={login} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 10, letterSpacing: 2, color: "#555570" }}>USERNAME</label>
            <input
              name="username"
              type="text"
              autoFocus
              autoComplete="username"
              style={{
                background: "#080810",
                border: `1px solid ${hasError ? "#E74C3C" : "#1A1A2E"}`,
                borderRadius: 8,
                padding: "12px 16px",
                color: "#E8E8F0",
                fontSize: 13,
                fontFamily: "monospace",
                outline: "none",
                width: "100%",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 10, letterSpacing: 2, color: "#555570" }}>PASSWORD</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              style={{
                background: "#080810",
                border: `1px solid ${hasError ? "#E74C3C" : "#1A1A2E"}`,
                borderRadius: 8,
                padding: "12px 16px",
                color: "#E8E8F0",
                fontSize: 13,
                fontFamily: "monospace",
                outline: "none",
                width: "100%",
              }}
            />
          </div>

          {hasError && (
            <div style={{ fontSize: 11, color: "#E74C3C", fontFamily: "monospace" }}>
              — Access denied. Check credentials and try again.
            </div>
          )}

          <button
            type="submit"
            style={{
              background: "#C9A84C",
              border: "none",
              borderRadius: 8,
              padding: "13px",
              color: "#080810",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: "pointer",
              fontFamily: "monospace",
              marginTop: 4,
            }}
          >
            ENTER
          </button>
        </form>

        <div style={{ fontSize: 10, color: "#222235", textAlign: "center" }}>
          Precision Data Strategies LLC
        </div>
      </div>
    </div>
  );
}
