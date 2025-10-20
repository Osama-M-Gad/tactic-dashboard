"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// 1. تحديد أنواع البيانات للفلاتر
//    - أضف أي فلاتر أخرى تحتاجها هنا (مثل: activeTeamLeader, etc.)
type FilterState = {
  activeRegion: string[] | null;
  activeMarket: string[] | null;
  // أضف أي فلاتر أخرى هنا
};

// 2. تحديد شكل الـ Context الذي سنوّفره للمكونات
type FilterContextType = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  // يمكنك إضافة دوال مساعدة هنا لاحقًا، مثل دالة لإعادة تعيين كل الفلاتر
  // clearAllFilters: () => void;
};

// 3. إنشاء الـ Context مع قيمة ابتدائية
//    - القيمة الابتدائية هنا مجرد شكل مؤقت، القيمة الحقيقية ستكون في الـ Provider
const FilterContext = createContext<FilterContextType | undefined>(undefined);

// 4. إنشاء المزوّد (Provider Component)
//    - هذا المكون هو الذي سيحتوي على منطق إدارة الحالة
export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<FilterState>({
    activeRegion: null,
    activeMarket: null,
    // الحالة الابتدائية للفلاتر الأخرى
  });

  // القيمة التي ستتم مشاركتها مع جميع المكونات الفرعية
  const value = { filters, setFilters };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

// 5. إنشاء Hook مخصص لتسهيل الاستخدام
//    - بدلاً من استيراد useContext و FilterContext في كل مرة، نستخدم هذا الـ hook
export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
