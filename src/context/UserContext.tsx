"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { createClient } from '@supabase/supabase-js'; // This will be mocked

// 💡 Mock Supabase Client for standalone execution
const createClient = (url?: string, key?: string) => {
    // تم استخدام المتغيرات لإزالة أخطاء ESLint
    console.log("Supabase mock client initialized.", {
        urlProvided: !!url,
        keyProvided: !!key,
    });


    const dummyUserSettings = {
        default_region: ['KSA-CENTRAL'],
        allowed_markets: ['Riyadh', 'Jeddah'],
        Team_leader: ['uuid-team-leader-1']
    };

    const dummyUserProfile = {
        full_name: 'Abdullah'
    };
    
    const dummyUser = {
        id: 'user-uuid-12345',
        email: 'test@example.com',
    };

    const dummySession = {
        user: dummyUser
    };
    
    // Define a type for the mock session to avoid 'any'
    type MockSession = typeof dummySession | null;
    // Define a union type for possible mock results to avoid 'any'
    type MockResult = typeof dummyUserSettings | typeof dummyUserProfile | null;


    return {
        auth: {
            getSession: () => Promise.resolve({ data: { session: dummySession }, error: null }),
            onAuthStateChange: (callback: (event: string, session: MockSession) => void) => {
                // Simulate initial auth state
                setTimeout(() => callback('SIGNED_IN', dummySession), 100);
                return {
                    data: {
                        subscription: {
                            unsubscribe: () => console.log("Unsubscribed from auth changes."),
                        },
                    },
                };
            },
        },
        from: (tableName: string) => ({
            result: null as MockResult, // Property to hold the mock result
            tableName,
            select: function() { return this; },
            eq: function(column: string, value: unknown) {
                // تم استخدام المتغيرات لإزالة أخطاء ESLint
                console.log(`Mock query on [${this.tableName}] for: ${column} = ${value}`);
                if (this.tableName === 'user_settings') {
                    this.result = dummyUserSettings;
                }
                if (this.tableName === 'Users') {
                    this.result = dummyUserProfile;
                }
                return this;
            },
            single: function() {
                return Promise.resolve({ data: this.result || null, error: null });
            },
        }),
    };
};


const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");


// 1. تعريف الأنواع (Types) للبيانات
// ===================================

// نوع لإعدادات المستخدم، يطابق جدول user_settings
interface UserSettings {
  default_region: string[] | null;
  allowed_markets: string[] | null;
  Team_leader: string[] | null;
}

// نوع لكائن المستخدم الكامل الذي سيتم استخدامه في التطبيق
interface AppUser {
  id: string;
  email?: string;
  // أضف أي بيانات أخرى من جدول Users مثل full_name
  full_name?: string; 
  settings: UserSettings | null; // إعدادات الفلترة الخاصة به
}

// نوع لقيمة الـ Context التي ستكون متاحة للمكونات
interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  // يمكنك إضافة دوال أخرى هنا مستقبلاً مثل logout
}

// 2. إنشاء الـ Context
// ======================
// نقوم بإنشاء الكونتكست بقيمة ابتدائية
const UserContext = createContext<UserContextType | undefined>(undefined);


// 3. إنشاء المكون المزوِّد (Provider)
// ======================================
// هذا هو المكون الأهم. سيقوم بجلب البيانات وتوفيرها للتطبيق.

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      // أولاً، نحصل على جلسة المستخدم الحالية من Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const currentUser = session.user;

        // الآن، نجلب بياناته من جدول Users وإعداداته من user_settings
        // Promise.all تسمح لنا بتنفيذ الطلبين في نفس الوقت لتحسين الأداء
        const [userProfileResponse, userSettingsResponse] = await Promise.all([
          supabase.from('Users').select('full_name').eq('id', currentUser.id).single(),
          supabase.from('user_settings').select('*').eq('user_id', currentUser.id).single()
        ]);

        const userProfile = userProfileResponse.data;
        const userSettings = userSettingsResponse.data;

        // ندمج كل البيانات في كائن واحد
        const appUser: AppUser = {
          id: currentUser.id,
          email: currentUser.email,
          full_name: userProfile?.full_name || 'No Name',
          settings: userSettings ? {
            default_region: userSettings.default_region,
            allowed_markets: userSettings.allowed_markets,
            Team_leader: userSettings.Team_leader,
          } : null,
        };

        setUser(appUser);
      }
      setLoading(false);
    };

    fetchUserData();

    // يمكنك إضافة تتبع لتغييرات حالة المصادقة هنا إذا لزم الأمر
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            fetchUserData();
        } else if (event === 'SIGNED_OUT') {
            setUser(null);
        }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };

  }, []);

  const value = {
    user,
    loading,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}


// 4. إنشاء Custom Hook (خطوة اختيارية ولكن موصى بها بشدة)
// =========================================================
// هذا الـ Hook يسهل الوصول إلى بيانات المستخدم من أي مكون.

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}


