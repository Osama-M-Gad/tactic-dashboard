'use client';
import { useState } from 'react';
import { useStagedClients } from '@/store/useStagedClients';

export default function UploadClientsButton() {
  const clients = useStagedClients(s => s.clients);
  const resetClients = useStagedClients(s => s.resetClients);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!clients.length) return alert('لا يوجد عملاء في المسودة!');
    setBusy(true);
    try {
      const res = await fetch('/api/clients/upload-clients', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ clients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      alert(`تم رفع/تحديث ${data.upserted} عميل ✅`);
      resetClients();
    } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  alert(`خطأ: ${msg}`);
}
 finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={upload} disabled={busy}
      className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50">
      {busy ? 'جارٍ الرفع...' : 'Upload Clients to Supabase'}
    </button>
  );
}
