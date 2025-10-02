"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function RecoveryPage() {
  const [phase, setPhase] = useState<"verifying" | "ready" | "updating" | "done" | "error">("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
  const run = async () => {
    try {
      const url = new URL(window.location.href);
      const query = new URLSearchParams(url.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const code = query.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      } else {
        throw new Error("Invalid link. No auth code or tokens found.");
      }

      const cleanUrl = url.origin + url.pathname;
      window.history.replaceState({}, "", cleanUrl);
      setPhase("ready");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setMsg(message || "Invalid or expired link.");
      setPhase("error");
    }
  };
  run();
}, []);

  const handleUpdate = async () => {
    setMsg("");
    if (password.length < 8) return setMsg("Password must be at least 8 characters.");
    if (password !== confirm) return setMsg("Passwords do not match.");

    setPhase("updating");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setPhase("ready");
    } else {
      setPhase("done");
    }
  };

  // Card بدون any
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb" }}>
      <div
        style={{
          width: 360,
          background: "#fff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (phase === "verifying") {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
        <p>Verifying your reset link…</p>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
        <p style={{ color: "red" }}>{msg || "Invalid link."}</p>
        <p style={{ fontSize: 12, color: "#555" }}>Try requesting a new reset link from the login page.</p>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Password updated</h3>
        <p>You can close this tab and log in to Tactic Portal.</p>
      </Card>
    );
  }

  // phase === "ready"
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Set a new password</h3>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "10px 0", borderRadius: 6, border: "1px solid #ddd" }}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 12px", borderRadius: 6, border: "1px solid #ddd" }}
      />

      {msg && <p style={{ color: "red", marginTop: 0 }}>{msg}</p>}

      <button
        onClick={handleUpdate}
        disabled={phase === "updating"}
        style={{
          width: "100%",
          padding: 12,
          border: "none",
          background: "#000",
          color: "#fff",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
          opacity: phase === "updating" ? 0.7 : 1,
        }}
      >
        {phase === "updating" ? "Updating…" : "Update Password"}
      </button>

      <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #eee" }} />

      <div style={{ fontSize: 12, color: "#666" }}>
        <strong>Tactic Portal</strong>
        <br />
        If you didn’t request this, you can safely ignore this page.
      </div>
    </Card>
  );
}
