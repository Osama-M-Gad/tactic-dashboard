// src/components/ImportExcelButton.tsx
'use client';
import * as XLSX from 'xlsx';
import { useStagedClients } from '@/store/useStagedClients';
import type { StagedBranch, StagedClient, StagedFeature, StagedUser } from '@/types/clients';

export default function ImportExcelButton() {
  const { addClients, addBranches, addUsers, addFeatures } = useStagedClients();

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const get = (name: string) => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: undefined }) : [];

    const clients = get('Clients') as any[];
    const branches = get('Branches') as any[];
    const users = get('Users') as any[];
    const features = get('Features') as any[];

    // Map & basic validation (only required fields)
    const mapClients: StagedClient[] = clients
      .filter(r => r['client_code*'] && r['name_ar*'])
      .map(r => ({
        client_code: String(r['client_code*']).trim(),
        name_ar: String(r['name_ar*']).trim(),
        name_en: r['name_en']?.toString().trim(),
        tax_number: r['tax_number']?.toString().trim(),
        phone: r['phone']?.toString().trim(),
        email: r['email']?.toString().trim(),
        default_language: ['ar','en'].includes((r['default_language']||'').toString().toLowerCase())
          ? (r['default_language'].toString().toLowerCase() as 'ar'|'en')
          : undefined,
        active: typeof r['active'] === 'boolean' ? r['active'] : undefined,
        start_date: r['start_date']?.toString().trim(),
      }));

    const mapBranches: StagedBranch[] = branches
      .filter(r => r['client_code*'] && r['branch_code*'] && r['name_ar*'])
      .map(r => ({
        client_code: String(r['client_code*']).trim(),
        branch_code: String(r['branch_code*']).trim(),
        name_ar: String(r['name_ar*']).trim(),
        name_en: r['name_en']?.toString().trim(),
        city: r['city']?.toString().trim(),
        latitude: r['latitude']!=null ? Number(r['latitude']) : undefined,
        longitude: r['longitude']!=null ? Number(r['longitude']) : undefined,
        address: r['address']?.toString().trim(),
      }));

    const mapUsers: StagedUser[] = users
      .filter(r => r['client_code*'] && r['email*'] && r['role*'])
      .map(r => ({
        client_code: String(r['client_code*']).trim(),
        email: String(r['email*']).trim().toLowerCase(),
        role: String(r['role*']).trim() as any,
        full_name: r['full_name']?.toString().trim(),
        phone: r['phone']?.toString().trim(),
      }));

    const mapFeatures: StagedFeature[] = features
      .filter(r => r['client_code*'] && r['feature_key*'])
      .map(r => ({
        client_code: String(r['client_code*']).trim(),
        feature_key: String(r['feature_key*']).trim() as any,
        enabled: !!r['enabled*'] || String(r['enabled*']).toUpperCase()==='TRUE',
      }));

    addClients(mapClients);
    addBranches(mapBranches);
    addUsers(mapUsers);
    addFeatures(mapFeatures);
    alert('تم استيراد البيانات إلى المسودة المحلية ✅');
  };

  return (
    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer bg-black text-white">
      <input type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      Import Excel
    </label>
  );
}
