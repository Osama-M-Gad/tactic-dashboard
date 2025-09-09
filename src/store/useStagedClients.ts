'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StagedClient = {
  client_code: string;
  name_ar: string;
  name_en?: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  default_language?: 'ar' | 'en';
  active?: boolean;
  start_date?: string;        // YYYY-MM-DD
  markets?: string[];         // ✅ جديد
  categories?: string[];      // ✅ جديد
  app_steps?: string[];       // ✅ جديد
};


type State = {
  clients: StagedClient[];
  addClient: (c: StagedClient) => { ok: boolean; msg?: string };
  removeClient: (client_code: string) => void;
  resetClients: () => void;
};

export const useStagedClients = create<State>()(
  persist(
    (set, get) => ({
      clients: [],
      addClient: (c) => {
        if (!c.client_code?.trim() || !c.name_ar?.trim()) {
          return { ok: false, msg: 'client_code و name_ar مطلوبين' };
        }
        const exists = get().clients.some(
          x => x.client_code.trim().toLowerCase() === c.client_code.trim().toLowerCase()
        );
        if (exists) return { ok: false, msg: 'client_code موجود بالفعل' };
        set(s => ({ clients: [...s.clients, { active: true, default_language: 'ar', ...c }] }));
        return { ok: true };
      },
      removeClient: (client_code) =>
        set(s => ({ clients: s.clients.filter(x => x.client_code !== client_code) })),
      resetClients: () => set({ clients: [] }),
    }),
    { name: 'staged-clients-v1' }
  )
);
