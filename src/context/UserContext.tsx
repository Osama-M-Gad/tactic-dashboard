"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 💡 Mock Supabase Client for standalone execution
const createClient = (url?: string, key?: string) => {
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

  // Types لموك النتائج
  type MockSession = typeof dummySession | null;
  type MockResult = typeof dummyUserSettings | typeof dummyUserProfile | null;

  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: dummySession }, error: null }),
      onAuthStateChange: (callback: (event: string, session: MockSession) => void) => {
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
      result: null as MockResult,
      tableName,
      select: function () { return this; },
      eq: function (column: string, value: unknown) {
        console.log(`Mock query on [${this.tableName}] for: ${column} = ${value}`);
        if (this.tableName === 'user_settings') {
          this.result = dummyUserSettings;
        }
        if (this.tableName === 'Users') {
          this.result = dummyUserProfile;
        }
        return this;
      },
      single: function () {
        return Promise.resolve({ data: this.result || null, error: null });
      },
    }),
  };
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

/* ================================
   1) الأنواع (Types)
================================ */

export interface UserSettings {
  default_region: string[] | null;
  allowed_markets: string[] | null;
  Team_leader: string[] | null;
}

interface AppUser {
  id: string;
  email?: string;
  full_name?: string;
  settings: UserSettings | null;
}

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
}

// ✅ أنواع صريحة لنتائج الجداول
type UsersRow = { full_name: string | null } | null;
type UserSettingsRow = {
  default_region: string[] | null;
  allowed_markets: string[] | null;
  Team_leader: string[] | null;
} | null;

/* ================================
   2) الـ Context
================================ */
const UserContext = createContext<UserContextType | undefined>(undefined);

/* ================================
   3) الـ Provider
================================ */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const currentUser = session.user;

        // اجلب البروفايل والإعدادات مع typing واضح
        const [userProfileResponse, userSettingsResponse] = await Promise.all([
          supabase.from('Users').select().eq('id', currentUser.id).single(),
          supabase.from('user_settings').select().eq('user_id', currentUser.id).single()
        ]);

        const userProfile = (userProfileResponse.data ?? null) as UsersRow;
        const userSettings = (userSettingsResponse.data ?? null) as UserSettingsRow;

        const appUser: AppUser = {
          id: currentUser.id,
          email: currentUser.email,
          full_name: userProfile?.full_name ?? 'No Name',
          settings: userSettings
            ? {
                default_region: userSettings.default_region ?? null,
                allowed_markets: userSettings.allowed_markets ?? null,
                Team_leader: userSettings.Team_leader ?? null,
              }
            : null,
        };

        setUser(appUser);
      }

      setLoading(false);
    };

    fetchUserData();

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

  const value: UserContextType = { user, loading };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

/* ================================
   4) الـ Hook
================================ */
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
