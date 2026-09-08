import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Session } from "@supabase/supabase-js";
import { isPublicRoute } from "@/lib/auth-utils";

export function useAuthGuard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session && !isPublicRoute(pathname)) {
        navigate({ to: "/login" });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && !isPublicRoute(pathname)) {
        navigate({ to: "/login" });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, pathname]);

  return { session, loading };
}
