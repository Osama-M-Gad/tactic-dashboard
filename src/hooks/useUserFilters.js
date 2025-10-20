"use client";

import { useState, useEffect } from 'react';

// الهوك المخصص لقراءة فلاتر المستخدم
export function useUserFilters() {
  const [filters, setFilters] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('userFilters');
      if (savedData) {
        // بما أنه ملف جافاسكريبت، لا نحدد النوع هنا
        const parsedFilters = JSON.parse(savedData);
        setFilters(parsedFilters);
      }
    } catch (error) {
      console.error("خطأ في قراءة الفلاتر:", error);
      setFilters(null);
    }
    setLoading(false);
  }, [setFilters, setLoading]);

  return { filters, loading };
}