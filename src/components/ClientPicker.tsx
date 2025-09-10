"use client";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/utils/supabaseClient";

type ClientRow = { id: string; name: string | null; code: string | null };

export default function ClientPicker({
  value,
  onChange,
  isArabic,
}: {
  value?: string | null;
  onChange: (id: string | null) => void;
  isArabic: boolean;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);

    useEffect(() => {
      let gone = false;
      async function run() {
        setLoading(true);
        const supabase = getSupabaseClient();
        const query = supabase
          .from("client")
          .select("id,name,code")
          .order("name", { ascending: true })
          .limit(20);
        const { data } = q
          ? await query.ilike("name", `%${q}%`)
          : await query;
        if (!gone) setRows((data as ClientRow[]) || []);
        setLoading(false);
      }
      run();
      return () => { gone = true; };
    }, [q]);

  const T = useMemo(() => isArabic ? {p:"اختَر العميل", s:"ابحث بالاسم/الكود"} : {p:"Select client", s:"Search by name/code"}, [isArabic]);

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", marginBottom: 6, color: "#bbb", fontWeight: 600 }}>{T.p}</label>
      <input
        placeholder={T.s}
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #333", background:"#1a1a1a", color:"#fff" }}
      />
      <div style={{ marginTop: 8, display:"flex", flexWrap:"wrap", gap:8 }}>
        {loading ? <span style={{color:"#aaa"}}>{isArabic?"جارٍ التحميل...":"Loading..."}</span> : null}
        {rows.map(r => {
          const active = value === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={()=>onChange(r.id)}
              style={{
                padding:"8px 12px",
                borderRadius:20,
                border: active ? "2px solid #f5a623" : "1px solid #444",
                background: active ? "#303030" : "#1a1a1a",
                color:"#eee",
                fontWeight:700
              }}
              title={`${r.name || ""} ${r.code ? `(${r.code})` : ""}`}
            >
              {(r.name || "-") + (r.code ? ` (${r.code})` : "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
