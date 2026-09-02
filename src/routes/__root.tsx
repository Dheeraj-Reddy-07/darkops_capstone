import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { Toaster } from "@/components/ui/sonner";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canAccessRoute } from "@/lib/rbac";

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
          The operational data feed did not respond. Retry, or return to the executive overview.
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
          <a
            href="/executive"
            className="rounded-sm border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
          >
            Executive overview
          </a>
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
  const navigate = useRouter().navigate;
  
  const { loading, session } = useAuthGuard();

  // RBAC check for protected routes - must be called before any conditional returns
  useEffect(() => {
    if (!session) return;
    
    const checkRBAC = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      const role = (profile as any)?.role;
      
      if (!canAccessRoute(role, pathname)) {
        // Redirect to appropriate dashboard based on role
        let redirectPath = '/executive';
        if (role === 'CUSTOMER') redirectPath = '/customer';
        else if (role === 'STORE_MANAGER') redirectPath = '/dark-stores';
        else if (role === 'FRAUD_ANALYST') redirectPath = '/fraud';
        else if (role === 'OPERATIONS' || role === 'OPERATIONS_AGENT' || role === 'OPERATIONS_MANAGER') redirectPath = '/operations';
        else if (role === 'ADMIN') redirectPath = '/admin';
        navigate({ to: redirectPath, replace: true });
      }
    };
    
    checkRBAC();
  }, [pathname, session, navigate]);

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">Authenticating...</div>;
  }

  // Public routes: render without shell; redirect authenticated users to role-based dashboard
  const isPublicRoute = pathname === '/login' || pathname === '/';
  if (isPublicRoute) {
    // If already authenticated and on a public route, redirect to role-based dashboard
    if (session) {
      // Fetch user role for redirect
      const supabase = createSupabaseBrowserClient();
      supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data }) => {
        const role = (data as any)?.role;
        let redirectPath = '/executive';
        if (role === 'CUSTOMER') redirectPath = '/customer';
        else if (role === 'STORE_MANAGER') redirectPath = '/dark-stores';
        else if (role === 'FRAUD_ANALYST') redirectPath = '/fraud';
        else if (role === 'OPERATIONS' || role === 'OPERATIONS_AGENT' || role === 'OPERATIONS_MANAGER') redirectPath = '/operations';
        else if (role === 'ADMIN') redirectPath = '/admin';
        navigate({ to: redirectPath });
      });
      return <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">Redirecting…</div>;
    }
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    );
  }

  // Block unauthenticated access to protected routes
  if (!session) {
    return <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">Redirecting…</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {isCustomer ? (
        <CustomerShell>
          <Outlet />
        </CustomerShell>
      ) : isAdmin ? (
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
