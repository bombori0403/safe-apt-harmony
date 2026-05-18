import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        setSession(null);
        setLoading(false);
        return;
      }

      const { data: userData, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !userData.user) {
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) await supabase.auth.signOut({ scope: "local" });
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
