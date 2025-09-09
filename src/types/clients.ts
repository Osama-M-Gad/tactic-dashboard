// src/types/clients.ts
export type StagedClient = {
  client_code: string;
  name_ar: string;
  name_en?: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  default_language?: 'ar' | 'en';
  active?: boolean;
  start_date?: string; // YYYY-MM-DD
};


export type StagedBranch = {
  client_code: string;
  branch_code: string;
  name_ar: string;
  name_en?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
};

export type StagedUser = {
  client_code: string;
  email: string;
  full_name?: string;
  role: 'Promoter' | 'Merchandiser' | 'TeamLeader' | 'Admin';
  phone?: string;
};

export type StagedFeature = {
  client_code: string;
  feature_key: 'availability' | 'inventory' | 'whcount' | 'damage' | 'competitor' | 'sos' | 'planogram';
  enabled: boolean;
};

export type StagedBundle = {
  clients: StagedClient[];
  branches: StagedBranch[];
  users: StagedUser[];
  features: StagedFeature[];
};
