"use client";
import { useMemo, useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

type YesNo = "yes" | "no";

export default function AddClientMockPage() {
  const router = useRouter();
  const [isArabic, setIsArabic] = useState(
    (typeof window !== "undefined" && localStorage.getItem("lang") === "en") ? false : true
  );

  // حقول أساسية (إجباريّة)
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [commercialNumber, setCommercialNumber] = useState("");
  const [address, setAddress] = useState("");

  // ملفات (ماكيت فقط – بدون رفع فعلي)
  const [nationalFile, setNationalFile] = useState<File | null>(null);        // national_file_url
  const [taxNumber, setTaxNumber] = useState("");
  const [taxFile, setTaxFile] = useState<File | null>(null);                  // tax_file_url
  const [commercialFile, setCommercialFile] = useState<File | null>(null);    // commercial_file_url
  const [nationalAddress, setNationalAddress] = useState("");                 // national_address
  const [agreementFile, setAgreementFile] = useState<File | null>(null);      // agreement_file_url
  const [logoFile, setLogoFile] = useState<File | null>(null);                // logo_url (هنخزن اسم الملف فقط لاحقًا)

  // Multi-selects (ماكيت بقيم تجريبية)
  const [markets, setMarkets] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<string[]>([]);
  const [appSteps, setAppSteps] = useState<string>(""); // كـ JSON نصيًا مؤقتًا

  // Boolean (Yes/No)
  const [enableLocationCheck, setEnableLocationCheck] = useState<YesNo>("no");
  const [requireBiometrics, setRequireBiometrics] = useState<YesNo>("no");
  const [activateUsers, setActivateUsers] = useState<YesNo>("yes");

  // إشعار مؤقت بعد “حفظ”
  const [toast, setToast] = useState<string>("");

  // دكشنري النصوص
  const T = useMemo(() => {
    return isArabic
      ? {
          title: "إضافة عميل جديد",
          basicInfo: "البيانات الأساسية",
          files: "الملفات",
          selections: "الاختيارات (ماكيت)",
          toggles: "إعدادات (Yes/No)",
          name: "اسم العميل",
          code: "كود العميل",
          commercialNumber: "رقم السجل التجاري",
          address: "العنوان",
          nationalFile: "الملف الوطني (صورة/ PDF)",
          taxNumber: "الرقم الضريبي",
          taxFile: "ملف ضريبي (اختياري)",
          commercialFile: "ملف السجل التجاري (اختياري)",
          nationalAddress: "العنوان الوطني (اختياري)",
          agreementFile: "ملف/اتفاقية (اختياري)",
          logoFile: "اللوجو (نحفظ الاسم فقط)",
          markets: "الأسواق المرتبطة",
          categories: "الفئات المرتبطة",
          linkedUsers: "المستخدمون المرتبطون",
          appSteps: "App Steps (JSON نصيًا مؤقتًا)",
          yes: "Yes",
          no: "No",
          enableLocation: "تفعيل التحقق من الموقع",
          requireBio: "تفعيل البايومتركس",
          activateUsers: "تفعيل المستخدمين",
          downloadTemplate: "تحميل قالب Excel (ماكيت)",
          chooseFile: "اختر ملف",
          save: "حفظ (ماكيت)",
          cancel: "إلغاء",
          requiredHint: "الحقول الإلزامية مميزة بعلامة *",
          toastSaved: "تم حفظ البيانات (ماكيت). سنربط القيم لاحقًا.",
        }
      : {
          title: "Add New Client",
          basicInfo: "Basic Info",
          files: "Files",
          selections: "Selections (Mock)",
          toggles: "Settings (Yes/No)",
          name: "Client Name",
          code: "Client Code",
          commercialNumber: "Commercial Number",
          address: "Address",
          nationalFile: "National File (Image/PDF)",
          taxNumber: "Tax Number",
          taxFile: "Tax File (optional)",
          commercialFile: "Commercial File (optional)",
          nationalAddress: "National Address (optional)",
          agreementFile: "Agreement File (optional)",
          logoFile: "Logo (we will store filename only)",
          markets: "Linked Markets",
          categories: "Linked Categories",
          linkedUsers: "Linked Users",
          appSteps: "App Steps (JSON as text for now)",
          yes: "Yes",
          no: "No",
          enableLocation: "Enable Location Check",
          requireBio: "Require Biometrics",
          activateUsers: "Activate Users",
          downloadTemplate: "Download Excel Template (Mock)",
          chooseFile: "Choose file",
          save: "Save (Mock)",
          cancel: "Cancel",
          requiredHint: "Required fields marked with *",
          toastSaved: "Saved (mock). We will wire up storage & DB later.",
        };
  }, [isArabic]);

  // تفعيل/تعطيل زر الحفظ
  const isValid = useMemo(() => {
    return (
      name.trim().length > 0 &&
      commercialNumber.trim().length > 0 &&
      address.trim().length > 0 &&
      !!nationalFile
    );
  }, [name, commercialNumber, address, nationalFile]);

  // إظهار النص التوضيحي بعد الحفظ (ماكيت)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleItem(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    // هنا فقط ماكيت: بنعرض إشعار نجاح، بدون حفظ فعلي
    setToast(T.toastSaved);
  };

  // خيارات تجريبية مؤقتة للـ Multi-select
  const MOCK_MARKETS = ["Riyadh", "Jeddah", "Dammam", "Abha"];
  const MOCK_CATEGORIES = ["Electronics", "Grocery", "Fashion", "Pharmacy"];
  const MOCK_USERS = ["ahmed", "sara", "mohamed", "fatimah"];

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>
      <AppHeader isArabic={isArabic} onToggleLang={() => setIsArabic((s) => !s)} showLogout />

      <div style={{ maxWidth: 980, margin: "24px auto", width: "100%", padding: "0 20px" }}>
        <h2 style={{ marginBottom: 8 }}>{T.title}</h2>
        <p style={{ color: "#bbb", marginTop: 0 }}>{T.requiredHint}</p>

        <form onSubmit={handleSubmit}>
          {/* البيانات الأساسية */}
          <section style={sectionBox}>
            <h3 style={sectionTitle}>{T.basicInfo}</h3>

            <Field label={T.name} required>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </Field>

            <Field label={T.code}>
              <input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
            </Field>

            <Field label={T.commercialNumber} required>
              <input value={commercialNumber} onChange={(e) => setCommercialNumber(e.target.value)} style={inputStyle} />
            </Field>

            <Field label={T.address} required>
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
            </Field>
          </section>

          {/* الملفات */}
          <section style={sectionBox}>
            <h3 style={sectionTitle}>{T.files}</h3>

            <FileField
              label={T.nationalFile}
              required
              file={nationalFile}
              onFile={(f) => setNationalFile(f)}
            />

            <Field label={T.taxNumber}>
              <input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} style={inputStyle} />
            </Field>

            <FileField label={T.taxFile} file={taxFile} onFile={(f) => setTaxFile(f)} />
            <FileField label={T.commercialFile} file={commercialFile} onFile={(f) => setCommercialFile(f)} />

            <Field label={T.nationalAddress}>
              <input value={nationalAddress} onChange={(e) => setNationalAddress(e.target.value)} style={inputStyle} />
            </Field>

            <FileField label={T.agreementFile} file={agreementFile} onFile={(f) => setAgreementFile(f)} />

            <FileField
              label={T.logoFile}
              file={logoFile}
              onFile={(f) => setLogoFile(f)}
              hint={isArabic ? "عند الحفظ الفعلي سنخزن اسم الملف فقط" : "On real save we will store filename only"}
            />
          </section>

          {/* الاختيارات */}
          <section style={sectionBox}>
            <h3 style={sectionTitle}>{T.selections}</h3>

            <MultiRow
              label={T.markets}
              options={MOCK_MARKETS}
              values={markets}
              onToggle={(v) => toggleItem(markets, setMarkets, v)}
            />

            <MultiRow
              label={T.categories}
              options={MOCK_CATEGORIES}
              values={categories}
              onToggle={(v) => toggleItem(categories, setCategories, v)}
            />

            <MultiRow
              label={T.linkedUsers}
              options={MOCK_USERS}
              values={linkedUsers}
              onToggle={(v) => toggleItem(linkedUsers, setLinkedUsers, v)}
            />

            <Field label={T.appSteps}>
              <textarea
                value={appSteps}
                onChange={(e) => setAppSteps(e.target.value)}
                style={{ ...inputStyle, minHeight: 90 }}
                placeholder={isArabic ? `مثال: [{"step":"X"}, {"step":"Y"}]` : `Example: [{"step":"X"}, {"step":"Y"}]`}
              />
            </Field>

            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{ color: "#f5a623", textDecoration: "none", fontWeight: 600 }}
            >
              {T.downloadTemplate}
            </a>
          </section>

          {/* إعدادات Yes/No */}
          <section style={sectionBox}>
            <h3 style={sectionTitle}>{T.toggles}</h3>

            <YesNoRow
              label={T.enableLocation}
              value={enableLocationCheck}
              onChange={setEnableLocationCheck}
              yes={T.yes}
              no={T.no}
            />
            <YesNoRow
              label={T.requireBio}
              value={requireBiometrics}
              onChange={setRequireBiometrics}
              yes={T.yes}
              no={T.no}
            />
            <YesNoRow
              label={T.activateUsers}
              value={activateUsers}
              onChange={setActivateUsers}
              yes={T.yes}
              no={T.no}
            />
          </section>

          {/* أزرار التحكّم */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={secondaryBtn}
            >
              {T.cancel}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              style={{ ...primaryBtn, opacity: isValid ? 1 : 0.6, cursor: isValid ? "pointer" : "not-allowed" }}
            >
              {T.save}
            </button>
          </div>

          {/* Toast */}
          {toast && (
            <div style={{
              marginTop: 16,
              background: "#1b1b1b",
              border: "1px solid #2c2c2c",
              padding: "10px 12px",
              borderRadius: 8,
              color: "#c7ffc7",
              fontWeight: 600
            }}>
              {toast}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ----------------- مكونات صغيرة قابلة لإعادة الاستخدام ----------------- */

const sectionBox: React.CSSProperties = {
  background: "#0f0f0f",
  border: "1px solid #2c2c2c",
  borderRadius: 10,
  padding: 16,
  marginTop: 16,
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  backgroundColor: "#f5a623",
  color: "#000",
  padding: "10px 16px",
  border: "none",
  borderRadius: 8,
  fontWeight: 800,
};

const secondaryBtn: React.CSSProperties = {
  backgroundColor: "#333",
  color: "#fff",
  padding: "10px 16px",
  border: "1px solid #444",
  borderRadius: 8,
  fontWeight: 700,
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", marginBottom: 6, color: "#bbb", fontWeight: 600 }}>
        {label} {required ? <span style={{ color: "#f5a623" }}>*</span> : null}
      </label>
      {children}
    </div>
  );
}

function FileField({
  label,
  file,
  onFile,
  required,
  hint,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", marginBottom: 6, color: "#bbb", fontWeight: 600 }}>
        {label} {required ? <span style={{ color: "#f5a623" }}>*</span> : null}
      </label>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        style={{ ...inputStyle, padding: 6 }}
      />
      {file ? (
        <div style={{ marginTop: 6, color: "#aaa", fontSize: 13 }}>
          {file.name} — {(file.size / 1024).toFixed(1)} KB
        </div>
      ) : null}
      {hint ? <div style={{ marginTop: 4, color: "#888", fontSize: 12 }}>{hint}</div> : null}
    </div>
  );
}

function MultiRow({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 8, color: "#bbb", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const active = values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              style={{
                padding: "8px 12px",
                borderRadius: 20,
                border: active ? "2px solid #f5a623" : "1px solid #444",
                background: active ? "#303030" : "#1a1a1a",
                color: "#eee",
                fontWeight: 700,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
  yes,
  no,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
  yes: string;
  no: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 6, color: "#bbb", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onChange("yes")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: value === "yes" ? "2px solid #f5a623" : "1px solid #444",
            background: value === "yes" ? "#303030" : "#1a1a1a",
            color: "#fff",
            fontWeight: 700,
            minWidth: 80,
          }}
        >
          {yes}
        </button>
        <button
          type="button"
          onClick={() => onChange("no")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: value === "no" ? "2px solid #f5a623" : "1px solid #444",
            background: value === "no" ? "#303030" : "#1a1a1a",
            color: "#fff",
            fontWeight: 700,
            minWidth: 80,
          }}
        >
          {no}
        </button>
      </div>
    </div>
  );
}
