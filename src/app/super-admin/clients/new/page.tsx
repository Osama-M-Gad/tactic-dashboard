"use client";
import { useMemo, useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ClientPicker from "@/components/ClientPicker";
import { useStagedClients } from "@/store/useStagedClients";
import UploadClientsButton from "@/components/UploadClientsButton";
import MultiSelect from "@/components/MultiSelect";
import DownloadClientsTemplateButton from "@/components/DownloadClientsTemplateButton";

type YesNo = "yes" | "no";
/* eslint-disable @typescript-eslint/no-explicit-any */

type LocalUser = {
  id: string;
  name?: string;
  arabic_name?: string;
  username?: string;
  email?: string;
  mobile?: string;
  role?: string;
  active?: YesNo;
};
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type TableLabels = {
  name: string; arabic_name: string; username: string; email: string;
  mobile: string; role: string; active: string; remove: string;
};

type TDict = {
  title: string;
  steps: string[];
  next: string; back: string; createMock: string; cancel: string;
  requiredHint: string; basicInfo: string; files: string; selections: string; toggles: string;
  name: string; code: string; commercialNumber: string; address: string;
  nationalFile: string; taxNumber: string; taxFile: string; commercialFile: string;
  nationalAddress: string; agreementFile: string; logoFile: string;
  markets: string; categories: string; linkedUsersPick: string; appSteps: string;
  yes: string; no: string; enableLocation: string; requireBio: string; activateUsers: string;
  usersTitle: string; importExcel: string; addUser: string; mustHaveOneUser: string;
  reviewTitle?: string; clientData: string; linkedUsersHeader: string;
  table: TableLabels;
  saveToast: string;
};

type Step1BasicProps = {
  T: TDict;
  clientId: string | null; setClientId: Setter<string | null>;
  name: string; setName: Setter<string>;
  code: string; setCode: Setter<string>;
  commercialNumber: string; setCommercialNumber: Setter<string>;
  address: string; setAddress: Setter<string>;
  nationalFile: File | null; setNationalFile: Setter<File | null>;
  taxNumber: string; setTaxNumber: Setter<string>;
  taxFile: File | null; setTaxFile: Setter<File | null>;
  commercialFile: File | null; setCommercialFile: Setter<File | null>;
  nationalAddress: string; setNationalAddress: Setter<string>;
  agreementFile: File | null; setAgreementFile: Setter<File | null>;
  logoFile: File | null; setLogoFile: Setter<File | null>;
  markets: string[]; setMarkets: Setter<string[]>;
  categories: string[]; setCategories: Setter<string[]>;
  linkedUsersSelection: string[]; setLinkedUsersSelection: Setter<string[]>;
  appStepsSelected: string[]; setAppStepsSelected: Setter<string[]>;
  MOCK_MARKETS: string[]; MOCK_CATEGORIES: string[]; MOCK_PICKER_USERS: string[]; MOCK_STEPS: string[];
  isValid: boolean; isArabic: boolean;
  enableLocationCheck: YesNo; setEnableLocationCheck: Setter<YesNo>;
  requireBiometrics: YesNo; setRequireBiometrics: Setter<YesNo>;
  activateUsers: YesNo; setActivateUsers: Setter<YesNo>;
  // ✅ مهم علشان الأوتوفيل
  hydrateFromClient: (codeOrId: string) => Promise<void>;
};

type Step2UsersProps = {
  T: TDict;
  users: LocalUser[];
  addUserRow: () => void;
  removeUserRow: (id: string) => void;
  updateUserRow: (id: string, patch: Partial<LocalUser>) => void;
  excelFile: File | null;
  handleExcelChange: (e: ChangeEvent<HTMLInputElement>) => void;
  roles: string[];
  isValid: boolean;
  isArabic: boolean;
};

type ReviewData = {
  name: string; code: string; commercialNumber: string; address: string;
  nationalFile: File | null; taxNumber: string; taxFile: File | null; commercialFile: File | null;
  nationalAddress: string; agreementFile: File | null; logoFile: File | null;
  markets: string[]; categories: string[]; linkedUsersSelection: string[]; appStepsSelected: string[];
  enableLocationCheck: YesNo; requireBiometrics: YesNo; activateUsers: YesNo;
  users: LocalUser[];
};

type Step3ReviewProps = { T: TDict; data: ReviewData; isArabic: boolean; };

export default function AddClientWizardMock() {
  const router = useRouter();
  const [isArabic, setIsArabic] = useState(
    typeof window !== "undefined" && localStorage.getItem("lang") === "en" ? false : true
  );

  // ====== حالة الـ Wizard ======
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clientId, setClientId] = useState<string | null>(null);

  // ====== الخطوة 1: بيانات العميل ======
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [commercialNumber, setCommercialNumber] = useState("");
  const [address, setAddress] = useState("");

  const [nationalFile, setNationalFile] = useState<File | null>(null);
  const [taxNumber, setTaxNumber] = useState("");
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [commercialFile, setCommercialFile] = useState<File | null>(null);
  const [nationalAddress, setNationalAddress] = useState("");
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [markets, setMarkets] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [linkedUsersSelection, setLinkedUsersSelection] = useState<string[]>([]);
  const [appStepsSelected, setAppStepsSelected] = useState<string[]>([]);

  const [enableLocationCheck, setEnableLocationCheck] = useState<YesNo>("no");
  const [requireBiometrics, setRequireBiometrics] = useState<YesNo>("no");
  const [activateUsers, setActivateUsers] = useState<YesNo>("yes");

  // ====== الخطوة 2: المستخدمون المرتبطون ======
  const [users, setUsers] = useState<LocalUser[]>([makeEmptyUserRow()]);
  function makeEmptyUserRow(): LocalUser {
    return { id: crypto.randomUUID(), active: "yes" };
  }
  function addUserRow() {
    setUsers((prev) => [...prev, makeEmptyUserRow()]);
  }
  function removeUserRow(id: string) {
    setUsers((prev) => (prev.length > 1 ? prev.filter((u) => u.id !== id) : prev));
  }
  function updateUserRow(id: string, patch: Partial<LocalUser>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }
  const [excelFile, setExcelFile] = useState<File | null>(null);
  function handleExcelChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setExcelFile(f);
  }

  // ====== الخطوة 3 ======
  const [toast, setToast] = useState("");

  const MOCK_MARKETS = ["Riyadh", "Jeddah", "Dammam", "Abha"];
  const MOCK_CATEGORIES = ["Electronics", "Grocery", "Fashion", "Pharmacy"];
  const MOCK_PICKER_USERS = ["ahmed", "sara", "mohamed", "fatimah"];
  const MOCK_STEPS = ["SOS", "DAMDAGE_COUNT", "COMPACTIVITY", "PLANOGRAM", "WH_COUNT"];
  const MOCK_ROLES = ["super_admin", "admin", "team_leader", "mch", "promo", "viewer"];

  // ✅ أوتوفيل بيانات العميل بعد اختياره
  async function hydrateFromClient(codeOrId: string) {
    const res = await fetch("/api/clients/get-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_code: codeOrId }), // لو ClientPicker بيرجع id بدّلها لـ { id: codeOrId }
    });

    const { client } = (await res.json()) as {
      client: null | {
        client_code: string;
        name_ar: string | null;
        name_en: string | null;
        tax_number: string | null;
        markets: string[];
        categories: string[];
        app_steps: string[];
      };
    };

    if (!client) return;

    setName(client.name_ar || client.name_en || "");
    setCode(client.client_code || "");
    setTaxNumber(client.tax_number || "");
    setMarkets(Array.isArray(client.markets) ? client.markets : []);
    setCategories(Array.isArray(client.categories) ? client.categories : []);
    setAppStepsSelected(Array.isArray(client.app_steps) ? client.app_steps : []);
  }

  // ====== النصوص ======
  const T = useMemo<TDict>(() => {
    return isArabic
      ? {
          title: "معالج إضافة عميل جديد",
          steps: ["البيانات الأساسية", "المستخدمون المرتبطون", "المراجعة والتأكيد"],
          next: "التالي",
          back: "السابق",
          createMock: "إنشاء (ماكيت)",
          cancel: "إلغاء",
          requiredHint: "الحقول الإلزامية مميزة بعلامة *",
          basicInfo: "البيانات الأساسية",
          files: "الملفات",
          selections: "الاختيارات",
          toggles: "إعدادات (Yes/No)",
          name: "اسم العميل",
          code: "كود العميل",
          commercialNumber: "رقم السجل التجاري",
          address: "العنوان",
          nationalFile: "الملف الوطني (صورة/ PDF)",
          taxNumber: "الرقم الضريبي",
          taxFile: "ملف ضريبي",
          commercialFile: "ملف السجل التجاري",
          nationalAddress: "العنوان الوطني",
          agreementFile: "ملف/اتفاقية",
          logoFile: "اللوجو",
          markets: "الأسواق المرتبطة",
          categories: "الفئات المرتبطة",
          linkedUsersPick: "اختيار مستخدمين",
          appSteps: "خطوات التطبيق",
          yes: "Yes",
          no: "No",
          enableLocation: "تفعيل الموقع",
          requireBio: "تفعيل البايومتركس",
          activateUsers: "تفعيل المستخدمين",
          usersTitle: "المستخدمون المرتبطون",
          addUser: "إضافة مستخدم",
          importExcel: "استيراد من Excel",
          table: {
            name: "الاسم",
            arabic_name: "الاسم بالعربية",
            username: "اسم الدخول",
            email: "البريد الإلكتروني",
            mobile: "الجوال",
            role: "الدور",
            active: "نشط؟",
            remove: "حذف",
          },
          mustHaveOneUser: "يجب إضافة مستخدم واحد على الأقل.",
          reviewTitle: "مراجعة وتأكيد",
          clientData: "بيانات العميل",
          linkedUsersHeader: "المستخدمون",
          saveToast: "تم إضافة العميل للمسودة ✅",
        }
      : {
          title: "Add New Client - Wizard",
          steps: ["Basic Info", "Linked Users", "Review & Confirm"],
          next: "Next",
          back: "Back",
          createMock: "Create (Mock)",
          cancel: "Cancel",
          requiredHint: "Required fields marked with *",
          basicInfo: "Basic Info",
          files: "Files",
          selections: "Selections",
          toggles: "Settings (Yes/No)",
          name: "Client Name",
          code: "Client Code",
          commercialNumber: "Commercial Number",
          address: "Address",
          nationalFile: "National File",
          taxNumber: "Tax Number",
          taxFile: "Tax File",
          commercialFile: "Commercial File",
          nationalAddress: "National Address",
          agreementFile: "Agreement File",
          logoFile: "Logo",
          markets: "Markets",
          categories: "Categories",
          linkedUsersPick: "Pick Users",
          appSteps: "App Steps",
          yes: "Yes",
          no: "No",
          enableLocation: "Enable Location Check",
          requireBio: "Require Biometrics",
          activateUsers: "Activate Users",
          usersTitle: "Linked Users",
          addUser: "Add User",
          importExcel: "Import from Excel",
          table: {
            name: "Name",
            arabic_name: "Arabic Name",
            username: "Username",
            email: "Email",
            mobile: "Mobile",
            role: "Role",
            active: "Active?",
            remove: "Remove",
          },
          mustHaveOneUser: "At least one user is required.",
          reviewTitle: "Review & Confirm",
          clientData: "Client Data",
          linkedUsersHeader: "Users",
          saveToast: "Added to staging ✅",
        };
  }, [isArabic]);

  // ====== تحقق صحة الخطوات ======
  const isStep1Valid = useMemo(() => {
    return (
      !!clientId &&
      name.trim().length > 0 &&
      commercialNumber.trim().length > 0 &&
      address.trim().length > 0 &&
      !!nationalFile
    );
  }, [clientId, name, commercialNumber, address, nationalFile]);

  const isStep2Valid = useMemo(() => {
    const validUsers = users.filter(
      (u) => (u.username?.trim()?.length || 0) > 0 && (u.role?.trim()?.length || 0) > 0
    );
    return validUsers.length > 0;
  }, [users]);

  // ====== Toast ======
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const nextStep = (s: 1 | 2 | 3): 1 | 2 | 3 => (s === 1 ? 2 : 3);
  const prevStep = (s: 1 | 2 | 3): 1 | 2 | 3 => (s === 3 ? 2 : 1);

  function goNext() {
    if (step === 1 && !isStep1Valid) return;
    if (step === 2 && !isStep2Valid) return;
    setStep((s) => nextStep(s));
  }

  function goBack() {
    setStep((s) => prevStep(s));
  }

  // ====== ربط المسودة (clients) ======
  const { addClient } = useStagedClients();

  function onCreateMock(e: FormEvent) {
    e.preventDefault();

    const client_code = (code || clientId || "").toString().trim();
    const nameBoth = (name || "").toString().trim();

    if (!client_code || !nameBoth) {
      setToast(isArabic ? "أدخل كود العميل والاسم" : "Enter client code and name");
      return;
    }

    const res = addClient({
      client_code,
      name_ar: nameBoth,
      name_en: nameBoth,
      tax_number: taxNumber || undefined,
      phone: undefined,
      email: undefined,
      default_language: isArabic ? "ar" : "en",
      active: true,
      start_date: undefined,
      markets,
      categories,
      app_steps: appStepsSelected,
    });

    setToast(res.ok ? T.saveToast : res.msg || "Error");
  }

  const wrapper: React.CSSProperties = {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div style={wrapper}>
      <AppHeader onToggleLang={() => setIsArabic((s) => !s)} showLogout />

      <div style={{ maxWidth: 1100, margin: "24px auto", width: "100%", padding: "0 20px" }}>
        <h2 style={{ marginBottom: 8 }}>{T.title}</h2>
        <Stepper labels={T.steps} current={step} />

        <form onSubmit={onCreateMock}>
          {/* Step 1 */}
          {step === 1 && (
            <Step1Basic
              T={T}
              clientId={clientId}
              setClientId={setClientId}
              name={name}
              setName={setName}
              code={code}
              setCode={setCode}
              commercialNumber={commercialNumber}
              setCommercialNumber={setCommercialNumber}
              address={address}
              setAddress={setAddress}
              nationalFile={nationalFile}
              setNationalFile={setNationalFile}
              taxNumber={taxNumber}
              setTaxNumber={setTaxNumber}
              taxFile={taxFile}
              setTaxFile={setTaxFile}
              commercialFile={commercialFile}
              setCommercialFile={setCommercialFile}
              nationalAddress={nationalAddress}
              setNationalAddress={setNationalAddress}
              agreementFile={agreementFile}
              setAgreementFile={setAgreementFile}
              logoFile={logoFile}
              setLogoFile={setLogoFile}
              markets={markets}
              setMarkets={setMarkets}
              categories={categories}
              setCategories={setCategories}
              linkedUsersSelection={linkedUsersSelection}
              setLinkedUsersSelection={setLinkedUsersSelection}
              appStepsSelected={appStepsSelected}
              setAppStepsSelected={setAppStepsSelected}
              MOCK_MARKETS={MOCK_MARKETS}
              MOCK_CATEGORIES={MOCK_CATEGORIES}
              MOCK_PICKER_USERS={MOCK_PICKER_USERS}
              MOCK_STEPS={MOCK_STEPS}
              isValid={isStep1Valid}
              isArabic={isArabic}
              enableLocationCheck={enableLocationCheck}
              setEnableLocationCheck={setEnableLocationCheck}
              requireBiometrics={requireBiometrics}
              setRequireBiometrics={setRequireBiometrics}
              activateUsers={activateUsers}
              setActivateUsers={setActivateUsers}
              hydrateFromClient={hydrateFromClient} // ✅ مهم
            />
          )}

          {/* Step 2 */}
          {step === 2 && (
            <Step2Users
              T={T}
              users={users}
              addUserRow={addUserRow}
              removeUserRow={removeUserRow}
              updateUserRow={updateUserRow}
              excelFile={excelFile}
              handleExcelChange={handleExcelChange}
              roles={MOCK_ROLES}
              isValid={isStep2Valid}
              isArabic={isArabic}
            />
          )}

          {/* Step 3 */}
          {step === 3 && (
            <Step3Review
              T={T}
              data={{
                name,
                code,
                commercialNumber,
                address,
                nationalFile,
                taxNumber,
                taxFile,
                commercialFile,
                nationalAddress,
                agreementFile,
                logoFile,
                markets,
                categories,
                linkedUsersSelection,
                appStepsSelected,
                enableLocationCheck,
                requireBiometrics,
                activateUsers,
                users,
              }}
              isArabic={isArabic}
            />
          )}

          {/* أزرار التحكم */}
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 16 }}>
            <button type="button" onClick={() => router.back()} style={secondaryBtn}>
              {T.cancel}
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              {step > 1 && (
                <button type="button" onClick={goBack} style={secondaryBtn}>
                  {T.back}
                </button>
              )}

              {step < 3 && (
                <button
                  type="button"
                  onClick={goNext}
                  style={{
                    ...primaryBtn,
                    opacity: (step === 1 ? isStep1Valid : isStep2Valid) ? 1 : 0.6,
                    cursor: (step === 1 ? isStep1Valid : isStep2Valid) ? "pointer" : "not-allowed",
                  }}
                  disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                >
                  {T.next}
                </button>
              )}

              {step === 3 && (
                <button type="submit" style={primaryBtn}>
                  {T.createMock}
                </button>
              )}
            </div>
          </div>

          {toast && <div style={toastStyle}>{toast}</div>}
        </form>

        {/* تنزيل تمبليت + الرفع إلى سوبابيز */}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <DownloadClientsTemplateButton />
          <UploadClientsButton />
        </div>
      </div>
    </div>
  );
}

/* ======================= المكوّنات المساعدة ======================= */

function Stepper({ labels, current }: { labels: string[]; current: 1 | 2 | 3 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${labels.length}, 1fr)`,
        gap: 10,
        margin: "12px 0 20px",
      }}
    >
      {labels.map((label, i) => {
        const idx = (i + 1) as 1 | 2 | 3;
        const active = current === idx;
        return (
          <div
            key={label}
            style={{
              background: active ? "#333" : "#1a1a1a",
              border: `2px solid ${active ? "#f5a623" : "#2c2c2c"}`,
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 10,
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

/* --- Styles مشتركة --- */
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

const chipBtn = (active: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 20,
  border: active ? "2px solid #f5a623" : "1px solid #444", // ✅ هنا كانت المشكلة
  background: active ? "#303030" : "#1a1a1a",
  color: "#eee",
  fontWeight: 700,
});

const toastStyle: React.CSSProperties = {
  marginTop: 16,
  background: "#1b1b1b",
  border: "1px solid #2c2c2c",
  padding: "10px 12px",
  borderRadius: 8,
  color: "#c7ffc7",
  fontWeight: 600,
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
            <button key={opt} type="button" onClick={() => onToggle(opt)} style={chipBtn(active)}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ======================= Step 1 ======================= */
function Step1Basic(props: Step1BasicProps) {
  const {
    T,
    clientId,
    setClientId,
    name,
    setName,
    code,
    setCode,
    commercialNumber,
    setCommercialNumber,
    address,
    setAddress,
    nationalFile,
    setNationalFile,
    taxNumber,
    setTaxNumber,
    taxFile,
    setTaxFile,
    commercialFile,
    setCommercialFile,
    nationalAddress,
    setNationalAddress,
    agreementFile,
    setAgreementFile,
    logoFile,
    setLogoFile,
    markets,
    setMarkets,
    categories,
    setCategories,
    linkedUsersSelection,
    setLinkedUsersSelection,
    appStepsSelected,
    setAppStepsSelected,
    MOCK_MARKETS,
    MOCK_CATEGORIES,
    MOCK_PICKER_USERS,
    MOCK_STEPS,
    isValid,
    enableLocationCheck,
    setEnableLocationCheck,
    requireBiometrics,
    setRequireBiometrics,
    activateUsers,
    setActivateUsers,
    isArabic,
    hydrateFromClient, // ✅
  } = props;

  return (
    <>
      <p style={{ color: "#bbb", marginTop: 0 }}>{T.requiredHint}</p>

      <section style={sectionBox}>
        {/* ✅ اختيار العميل */}
        <ClientPicker
          value={clientId}
          onChange={(v) => {
            setClientId(v);
            if (v) hydrateFromClient(v);
          }}
          isArabic={isArabic}
        />

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

      <section style={sectionBox}>
        <h3 style={sectionTitle}>{T.files}</h3>
        <FileField label={T.nationalFile} required file={nationalFile} onFile={setNationalFile} />
        <Field label={T.taxNumber}>
          <input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} style={inputStyle} />
        </Field>
        <FileField label={T.taxFile} file={taxFile} onFile={setTaxFile} />
        <FileField label={T.commercialFile} file={commercialFile} onFile={setCommercialFile} />
        <Field label={T.nationalAddress}>
          <input value={nationalAddress} onChange={(e) => setNationalAddress(e.target.value)} style={inputStyle} />
        </Field>
        <FileField label={T.agreementFile} file={agreementFile} onFile={setAgreementFile} />
        <FileField label={T.logoFile} file={logoFile} onFile={setLogoFile} hint={T.logoFile} />
      </section>

      <section style={sectionBox}>
        <h3 style={sectionTitle}>{T.selections}</h3>

        {/* ✅ MultiSelect للماركتس */}
        <MultiSelect
          label={T.markets}
          options={MOCK_MARKETS}
          values={markets}
          onChange={setMarkets}
          placeholder={isArabic ? "اختر الأسواق..." : "Select markets..."}
          rtl={isArabic}
        />

        {/* ✅ MultiSelect للفئات بدل MultiRow */}
        <MultiSelect
          label={T.categories}
          options={MOCK_CATEGORIES}
          values={categories}
          onChange={setCategories}
          placeholder={isArabic ? "اختر الفئات..." : "Select categories..."}
          rtl={isArabic}
        />

        {/* ✅ MultiSelect للمستخدمين */}
        <MultiSelect
          label={T.linkedUsersPick}
          options={MOCK_PICKER_USERS}
          values={linkedUsersSelection}
          onChange={setLinkedUsersSelection}
          placeholder={isArabic ? "اختر المستخدمين..." : "Select users..."}
          rtl={isArabic}
        />

        {/* لسه مخلّي App Steps بالـ chips لحد ما نعملها من الدروب داون برضو */}
        <MultiRow
          label={T.appSteps}
          options={MOCK_STEPS}
          values={appStepsSelected}
          onToggle={(v) => toggleHelper(appStepsSelected, setAppStepsSelected, v)}
        />
      </section>

      <section style={sectionBox}>
        <h3 style={sectionTitle}>{T.toggles}</h3>

        <YesNoRow label={T.enableLocation} value={enableLocationCheck} onChange={setEnableLocationCheck} yes={T.yes} no={T.no} />
        <YesNoRow label={T.requireBio} value={requireBiometrics} onChange={setRequireBiometrics} yes={T.yes} no={T.no} />
        <YesNoRow label={T.activateUsers} value={activateUsers} onChange={setActivateUsers} yes={T.yes} no={T.no} />
      </section>

      {!isValid && <div style={{ marginTop: 10, color: "#ffb3b3" }}>{/* رسالة توضيحية إن حبيت */}</div>}
    </>
  );
}

function toggleHelper(list: string[], setList: (v: string[]) => void, value: string) {
  setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
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
        <button type="button" onClick={() => onChange("yes")} style={chipBtn(value === "yes")}>
          {yes}
        </button>
        <button type="button" onClick={() => onChange("no")} style={chipBtn(value === "no")}>
          {no}
        </button>
      </div>
    </div>
  );
}

/* ======================= Step 2 ======================= */
function Step2Users(props: Step2UsersProps) {
  const { T, users, addUserRow, removeUserRow, updateUserRow, excelFile, handleExcelChange, roles, isValid, isArabic } = props;
  return (
    <>
      <section style={sectionBox}>
        <h3 style={sectionTitle}>{T.usersTitle}</h3>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button type="button" onClick={addUserRow} style={primaryBtn}>
            {T.addUser}
          </button>

          <label style={{ ...secondaryBtn, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelChange} style={{ display: "none" }} />
            {T.importExcel}
          </label>

          {excelFile && <div style={{ color: "#bbb", alignSelf: "center" }}>{(isArabic ? "ملف: " : "File: ") + excelFile.name}</div>}
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #2c2c2c", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#151515" }}>
                {["name", "arabic_name", "username", "email", "mobile", "role", "active", "remove"].map((key) => (
                  <th key={key} style={thStyle}>
                    {(T.table as any)[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={tdStyle}>
                    <input value={u.name ?? ""} onChange={(e) => updateUserRow(u.id, { name: e.target.value })} style={inputStyle} />
                  </td>
                  <td style={tdStyle}>
                    <input value={u.arabic_name ?? ""} onChange={(e) => updateUserRow(u.id, { arabic_name: e.target.value })} style={inputStyle} />
                  </td>
                  <td style={tdStyle}>
                    <input value={u.username ?? ""} onChange={(e) => updateUserRow(u.id, { username: e.target.value })} style={inputStyle} />
                  </td>
                  <td style={tdStyle}>
                    <input value={u.email ?? ""} onChange={(e) => updateUserRow(u.id, { email: e.target.value })} style={inputStyle} />
                  </td>
                  <td style={tdStyle}>
                    <input value={u.mobile ?? ""} onChange={(e) => updateUserRow(u.id, { mobile: e.target.value })} style={inputStyle} />
                  </td>
                  <td style={tdStyle}>
                    <select value={u.role ?? ""} onChange={(e) => updateUserRow(u.id, { role: e.target.value })} style={{ ...inputStyle, background: "#1a1a1a" }}>
                      <option value="">{isArabic ? "اختَر" : "Select"}</option>
                      {roles.map((r: string) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={u.active ?? "yes"}
                      onChange={(e) => updateUserRow(u.id, { active: e.target.value as YesNo })}
                      style={{ ...inputStyle, background: "#1a1a1a" }}
                    >
                      <option value="yes">{T.yes}</option>
                      <option value="no">{T.no}</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => removeUserRow(u.id)} style={{ ...secondaryBtn, padding: "8px 12px" }}>
                      {T.table.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isValid && <div style={{ marginTop: 10, color: "#ffb3b3" }}>{T.mustHaveOneUser}</div>}
      </section>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "start",
  color: "#bbb",
  padding: "10px 8px",
  borderBottom: "1px solid #2c2c2c",
  fontWeight: 700,
};
const tdStyle: React.CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #2c2c2c",
  verticalAlign: "middle",
};

/* ======================= Step 3 ======================= */
function Step3Review({ T, data, isArabic }: Step3ReviewProps) {
  const {
    name,
    code,
    commercialNumber,
    address,
    nationalFile,
    taxNumber,
    taxFile,
    commercialFile,
    nationalAddress,
    agreementFile,
    logoFile,
    markets,
    categories,
    linkedUsersSelection,
    appStepsSelected,
    enableLocationCheck,
    requireBiometrics,
    activateUsers,
    users,
  } = data;

  return (
    <>
      <section style={sectionBox}>
        <h3 style={sectionTitle}>{T.clientData}</h3>

        <KV label={isArabic ? "اسم العميل" : "Client Name"} value={name} />
        <KV label={isArabic ? "كود العميل" : "Client Code"} value={code || "-"} />
        <KV label={isArabic ? "السجل التجاري" : "Commercial No."} value={commercialNumber} />
        <KV label={isArabic ? "العنوان" : "Address"} value={address} />

        <KV label={T.nationalFile} value={nationalFile?.name || "-"} />
        <KV label={T.taxNumber} value={taxNumber || "-"} />
        <KV label={T.taxFile} value={taxFile?.name || "-"} />
        <KV label={T.commercialFile} value={commercialFile?.name || "-"} />
        <KV label={T.nationalAddress} value={nationalAddress || "-"} />
        <KV label={T.agreementFile} value={agreementFile?.name || "-"} />
        <KV label={T.logoFile} value={logoFile?.name || "-"} />

        <KV label={T.markets} value={markets.join(", ") || "-"} />
        <KV label={T.categories} value={categories.join(", ") || "-"} />
        <KV label={T.linkedUsersPick} value={linkedUsersSelection.join(", ") || "-"} />
        <KV label={T.appSteps} value={appStepsSelected.join(", ") || "-"} />

        <KV label={T.enableLocation} value={enableLocationCheck === "yes" ? T.yes : T.no} />
        <KV label={T.requireBio} value={requireBiometrics === "yes" ? T.yes : T.no} />
        <KV label={T.activateUsers} value={activateUsers === "yes" ? T.yes : T.no} />
      </section>

      <section style={sectionBox}>
        <h3 style={sectionTitle}>{T.linkedUsersHeader}</h3>

        <div style={{ overflowX: "auto", border: "1px solid #2c2c2c", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#151515" }}>
                {["name", "arabic_name", "username", "email", "mobile", "role", "active"].map((key) => (
                  <th key={key} style={thStyle}>
                    {(T.table as any)[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td style={tdStyle}>{u.name || "-"}</td>
                  <td style={tdStyle}>{u.arabic_name || "-"}</td>
                  <td style={tdStyle}>{u.username || "-"}</td>
                  <td style={tdStyle}>{u.email || "-"}</td>
                  <td style={tdStyle}>{u.mobile || "-"}</td>
                  <td style={tdStyle}>{u.role || "-"}</td>
                  <td style={tdStyle}>{u.active === "yes" ? T.yes : T.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function KV({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px dashed #2c2c2c" }}>
      <div style={{ minWidth: 220, color: "#bbb", fontWeight: 700 }}>{label}</div>
      <div style={{ color: "#fff" }}>{String(value)}</div>
    </div>
  );
}
