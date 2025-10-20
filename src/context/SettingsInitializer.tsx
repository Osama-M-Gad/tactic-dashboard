"use client";

import { useEffect, createContext, useContext } from 'react';

// 💡 تم وضع محاكاة للـ Hooks هنا لجعل المكون قابلاً للتشغيل بشكل مستقل

// --- تعريف أنواع البيانات للمحاكاة ---
type FilterState = {
  activeRegion: string[] | null;
  activeMarket: string[] | null;
};

// Mock for UserContext data
const mockUserData = {
  user: { id: '123', email: 'test@example.com' },
  userSettings: {
    default_region: ['KSA'],
    allowed_markets: ['Riyadh', 'Jeddah'],
    Team_leader: ['leader-uuid-1'],
  },
  isLoading: false,
};

// Mock for FilterContext data
const mockFilterData = {
  filters: {
    activeRegion: null,
    activeMarket: null,
  },
  // 💡 تم تحديد نوع الدالة هنا لحل خطأ ESLint
  setFilters: (updater: (prevState: FilterState) => FilterState) => {
    console.log("Mock setFilters called with an updater function.");
    // يمكنك محاكاة التحديث هنا إذا أردت
    const newFilters = updater({ activeRegion: null, activeMarket: null });
    console.log("New filters would be:", newFilters);
  },
};

// Mock hooks
const useUser = () => useContext(createContext(mockUserData));
const useFilters = () => useContext(createContext(mockFilterData));


/**
 * هذا المكون لا يعرض أي واجهة مستخدم (UI).
 * وظيفته الوحيدة هي ربط بيانات المستخدم بحالة الفلاتر عند تسجيل الدخول.
 */
const SettingsInitializer = () => {
  // 1. الوصول إلى بيانات المستخدم وإعداداته (من المحاكاة)
  const { user, userSettings, isLoading } = useUser();
  
  // 2. الوصول إلى دالة تحديث الفلاتر (من المحاكاة)
  const { setFilters } = useFilters();

  // 3. استخدام useEffect لمراقبة التغييرات في إعدادات المستخدم
  useEffect(() => {
    // نتأكد من أن التحميل قد انتهى وأن المستخدم قد سجل دخوله ولديه إعدادات
    if (!isLoading && user && userSettings) {
      console.log("Initializing filters with user settings:", userSettings);
      
      // 4. تحديث حالة الفلاتر العامة بالإعدادات الافتراضية للمستخدم
      // 💡 تم تحديد نوع المتغير هنا لحل خطأ ESLint
      setFilters((currentFilters: FilterState) => ({
        ...currentFilters, // نحافظ على أي فلاتر قديمة قد تكون موجودة
        activeRegion: userSettings.default_region || null,
        activeMarket: userSettings.allowed_markets || null,
        // يمكنك إضافة أي فلاتر أخرى هنا بنفس الطريقة
        // activeTeamLeader: userSettings.Team_leader || null,
      }));
    }
    // هذا التأثير (Effect) يجب أن يعمل فقط عندما تتغير إعدادات المستخدم أو حالة التحميل
  }, [user, userSettings, isLoading, setFilters]);

  // هذا المكون لا يعرض أي شيء في الصفحة
  return null;
};

export default SettingsInitializer;

