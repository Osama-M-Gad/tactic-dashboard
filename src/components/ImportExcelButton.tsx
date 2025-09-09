"use client";

import * as XLSX from "xlsx";
import type { ChangeEvent } from "react";
import { useStagedClients } from "@/store/useStagedClients";
import type { StagedClient } from "@/store/useStagedClients";

// -------- Helpers: safe coercion from unknown ----------
type SheetRow = Record<string, unknown>;

const toStr = (v: unknown): string | undefined =>
  v == null || v === "" ? undefined : String(v).trim();

const toBool = (v: unknown): boolean | undefined => {
  if (v === true || v === false) return v;
  const sv = String(v ?? "").trim().toLowerCase();
  if (!sv) return undefined;
  if (sv === "true" || sv === "1" || sv === "yes") return true;
  if (sv === "false" || sv === "0" || sv === "no") return false;
  return undefined;
};

const toStrArray = (v: unknown): string[] | undefined => {
  if (Array.isArray(v)) return v.map(String);
  const s = toStr(v);
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
};

// -------------------------------------------------------

export default function ImportExcelButton() {
  // نجيب دالة إضافة عميل واحد من الستور
  const addClient = useStagedClients((s) => s.addClient);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);

    // helper: read a sheet safely
    const readSheet = (name: string): SheetRow[] => {
      const ws = wb.Sheets[name];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json(ws, { defval: undefined }) as SheetRow[];
    };

    const rawClients = readSheet("Clients");
    // ممكن نستخدم الشيتس الأخرى لاحقًا
    // const rawBranches = readSheet("Branches");
    // const rawUsers = readSheet("Users");
    // const rawFeatures = readSheet("Features");

    // --- map rows -> StagedClient
    const clients: StagedClient[] = rawClients
      .filter((r) => toStr(r["client_code*"]) && toStr(r["name_ar*"]))
      .map((r) => ({
        client_code: toStr(r["client_code*"])!, // required
        name_ar: toStr(r["name_ar*"])!,         // required
        name_en: toStr(r["name_en"]),
        tax_number: toStr(r["tax_number"]),
        phone: toStr(r["phone"]),
        email: toStr(r["email"]),
        default_language: ((): "ar" | "en" | undefined => {
          const v = (toStr(r["default_language"]) || "").toLowerCase();
          return v === "ar" || v === "en" ? (v as "ar" | "en") : undefined;
        })(),
        active: toBool(r["active"]),
        start_date: toStr(r["start_date"]),
        markets: toStrArray(r["markets"]),
        categories: toStrArray(r["categories"]),
        app_steps: toStrArray(r["app_steps"]),
      }));

    // أضف العملاء واحدًا واحدًا للستور
    let ok = 0;
    let fail = 0;

    for (const c of clients) {
      const res = addClient(c);
      if (res.ok) {
        ok++;
      } else {
        fail++;
      }
    }

    alert(`تم استيراد العملاء إلى المسودة ✅ (نجح: ${ok}, فشل/مكرر: ${fail})`);
    // Reset قيمة input عشان تقدر تختار نفس الملف تاني لو حبيت
    e.target.value = "";
  };

  return (
    <label
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer bg-black text-white"
      title="Import clients from Excel"
    >
      <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onChange} />
      Import Excel
    </label>
  );
}
