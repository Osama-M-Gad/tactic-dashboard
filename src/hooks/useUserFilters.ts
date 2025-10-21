"use client";

import { useState, useEffect } from 'react';

// 👇 1. تحديد نوع الفلاتر المطلوبة وتصديره
export type UserFiltersType = {
  default_region: string[] | null;
  default_city: string[] | null;
  allowed_markets: string[] | null;
  Team_leader: string[] | null;
  notifications?: boolean;
  requests?: boolean; // 👈 أضف هذا السطر
};


// الهوك المخصص لقراءة فلاتر المستخدم
export function useUserFilters() {
  // 👇 2. تحديد نوع الحالة (State) باستخدام النوع الجديد
  const [filters, setFilters] = useState<UserFiltersType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('userFilters');
      if (savedData) {
        // نستخدم 'as UserFiltersType' لإخبار TypeScript بالشكل المتوقع للبيانات
        const parsedFilters: unknown = JSON.parse(savedData);
        setFilters(parsedFilters as UserFiltersType); 
      }
    } catch (error) {
      console.error("خطأ في قراءة الفلاتر:", error);
      setFilters(null);
    }
    setLoading(false);
  }, [setFilters, setLoading]);

  // 👇 3. تحديد نوع القيمة المرتجعة
  return { filters, loading } as { filters: UserFiltersType | null, loading: boolean };
}