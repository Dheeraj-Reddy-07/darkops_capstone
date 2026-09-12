import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/layout/app-shell";
import { AdminShell } from "@/components/layout/admin-shell";
import { CustomerShell } from "@/components/layout/customer-shell";
import { SupportShell } from "@/components/layout/support-shell";
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canAccessRoute } from "@/lib/rbac";
import { getLandingRoute, isPublicRoute, normalizeRole } from "@/lib/auth-utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="num text-6xl font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Record not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This case, store or complaint is not in the operational dataset.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          This view didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The operational data feed did not respond. Retry, or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
          <Link
            to="/"
            className="rounded-sm border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isCustomer = pathname.startsWith("/customer");
  const isAdmin = pathname.startsWith("/admin");
  const isSupport = pathname.startsWith("/support");
  const navigate = useRouter().navigate;

  const { loading, session } = useAuthGuard();

  // Fetch user profile once - single source of truth for role
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      if (!session) return null;
      const supabase = createSupabaseBrowserClient();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      return profile as any;
    },
    enabled: !!session,
    retry: 1,
  });

  const normalizedRole = normalizeRole(userProfile?.role);
  const userRole = normalizedRole || userProfile?.role;

  // PLATFORM_ADMIN should use AdminShell for /dark-stores as well for consistent admin console
  const useAdminShell =
    isAdmin || (userRole === "PLATFORM_ADMIN" && pathname.startsWith("/dark-stores"));

  // Navigation & RBAC side effects
  useEffect(() => {
    if (loading || profileLoading) return;

    if (isPublicRoute(pathname)) {
      if (session && userProfile) {
        const landingRoute = getLandingRoute(userRole);
        if (landingRoute) {
          navigate({ to: landingRoute, replace: true });
        }
      }
    } else {
      if (!session) {
        navigate({ to: "/login", replace: true });
      } else if (userRole && !canAccessRoute(userRole as any, pathname)) {
        const landingRoute = getLandingRoute(userRole);
        if (landingRoute) {
          navigate({ to: landingRoute, replace: true });
        } else {
          navigate({ to: "/login", replace: true });
        }
      }
    }
  }, [pathname, userRole, session, userProfile, loading, profileLoading, navigate]);

  // Handle public routes
  if (isPublicRoute(pathname)) {
    if (loading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
          Loading...
        </div>
      );
    }

    if (session && userProfile) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
          Redirecting to dashboard…
        </div>
      );
    }

    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    );
  }

  // Show loading while auth or profile is resolving
  if (loading || profileLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
        Authenticating...
      </div>
    );
  }

  // Block unauthenticated access to protected routes
  if (!session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting to login…
      </div>
    );
  }

  // If profile failed to load, show error
  if (!userProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Unable to load profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Please try logging in again.</p>
          <div className="mt-6">
            <button
              onClick={() => navigate({ to: "/login" })}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {isCustomer ? (
        <CustomerShell>
          <Outlet />
        </CustomerShell>
      ) : isSupport ? (
        <SupportShell>
          <Outlet />
        </SupportShell>
      ) : useAdminShell ? (
        <AdminShell>
          <Outlet />
        </AdminShell>
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
