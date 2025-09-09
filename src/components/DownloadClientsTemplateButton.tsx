"use client";
import * as XLSX from "xlsx";

export default function DownloadClientsTemplateButton() {
  const onClick = () => {
    const headers = [
      "client_code*","name_ar*","name_en","tax_number","phone","email",
      "default_language","active","start_date","markets","categories","app_steps"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, "clients_template.xlsx");
  };
  return (
    <button onClick={onClick} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }}>
      {`Download Excel Template`}
    </button>
  );
}
