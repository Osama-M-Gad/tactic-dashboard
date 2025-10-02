"use client";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleUpdate = async () => {
    setMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMsg(error.message);
    else setMsg("Password updated. You can close this tab and login.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 340, background: "#fff", padding: 20, borderRadius: 8 }}>
        <h3>Set a new password</h3>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "10px 0", borderRadius: 4, border: "1px solid #ccc" }}
        />
        {msg && <p style={{ color: msg.includes("updated") ? "green" : "red" }}>{msg}</p>}
        <button onClick={handleUpdate} style={{ width: "100%", padding: 10, border: "none", background: "#f5a623", borderRadius: 4, fontWeight: "bold", cursor: "pointer" }}>
          Update
        </button>
      </div>
    </div>
  );
}
