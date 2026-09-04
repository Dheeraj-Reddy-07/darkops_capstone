import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in - DarkOps" },
      { name: "description", content: "Sign in to DarkOps Operational Intelligence Platform." },
    ],
  }),
  component: LoginPage,
});

const DEMO_ROLES = [
  { label: "Executive", email: "exec@darkops.com", color: "text-primary" },
  { label: "Operations", email: "manager@darkops.com", color: "text-ok" },
  { label: "Customer Support", email: "support@darkops.com", color: "text-crit" },
  { label: "Support Agent A", email: "agent.a@darkops.com", color: "text-crit" },
  { label: "Support Agent B", email: "agent.b@darkops.com", color: "text-crit" },
  { label: "Store Manager", email: "storemanager@darkops.com", color: "text-warn" },
  { label: "Platform Admin", email: "admin@darkops.com", color: "text-muted-foreground" },
  { label: "Customer", email: "customer@darkops.com", color: "text-info" },
] as const;

function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("invalid")) {
          setError("The email or password you entered is incorrect. Check your credentials and try again.");
        } else if (authError.message.toLowerCase().includes("network") || authError.message.toLowerCase().includes("fetch")) {
          setError("Unable to reach the authentication server. Check your internet connection.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // Clear React Query cache to prevent stale data from previous sessions
      queryClient.clear();
      
      await router.invalidate();
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser!.id)
        .single();
      
      const role = (profile as any)?.role as string | undefined;
      console.log('[Login] User role:', role, 'for email:', email);
      
      let redirectPath = '/executive';
      if (role === 'CUSTOMER') redirectPath = '/customer';
      else if (role === 'STORE_MANAGER') redirectPath = '/dark-stores';
      else if (role === 'CUSTOMER_SUPPORT') redirectPath = '/support';
      else if (role === 'OPERATIONS') redirectPath = '/operations';
      else if (role === 'PLATFORM_ADMIN') redirectPath = '/admin';
      else if (role === 'ADMIN') redirectPath = '/admin'; // Fallback for old role name
      else if (role === 'OPERATIONS_MANAGER' || role === 'OPERATIONS_AGENT') redirectPath = '/operations'; // Fallback for old role names
      
      console.log('[Login] Redirecting to:', redirectPath);
      navigate({ to: redirectPath });
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          setError("An account with this email already exists.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Create profile entry
        const { error: profileError } = await (supabase.from('profiles') as any).insert([
          {
            id: authData.user.id,
            email: email.trim(),
            full_name: fullName,
            role: 'CUSTOMER',
          },
        ]);

        if (profileError) {
          setError("Account created but profile setup failed. Please contact support.");
          setLoading(false);
          return;
        }

        await router.invalidate();
        navigate({ to: '/customer' });
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setConfirmPassword("password123");
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:flex-col lg:w-[440px] xl:w-[520px] border-r border-border bg-surface p-12">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-[5px] bg-primary/15">
            <span className="size-3 rounded-[3px] bg-primary" />
          </span>
          <span className="text-[16px] font-semibold tracking-tight">
            Dark<span className="text-primary">Ops</span>
          </span>
        </div>

        <div className="mt-auto">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Operational Intelligence Platform
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground leading-snug">
            Monitor. Resolve.<br />Decide. At scale.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
            Real-time visibility into dark-store health, case operations,
            fraud risk, and executive network analytics - in one command center.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { metric: "14", desc: "Dark stores monitored across Bengaluru metro" },
              { metric: "< 2s", desc: "Average PulseScore update latency" },
              { metric: "74/100", desc: "Current network PulseScore" },
            ].map((kpi) => (
              <div key={kpi.metric} className="flex items-baseline gap-3">
                <span className="num text-2xl font-semibold text-primary">{kpi.metric}</span>
                <span className="text-xs text-muted-foreground">{kpi.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-12 text-xs text-muted-foreground">
          Deloitte Capstone · 2026
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <span className="flex size-7 items-center justify-center rounded-[5px] bg-primary/15">
            <span className="size-3 rounded-[3px] bg-primary" />
          </span>
          <span className="text-[16px] font-semibold tracking-tight">
            Dark<span className="text-primary">Ops</span>
          </span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground">{isLogin ? "Sign in" : "Create account"}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isLogin ? "Enter your credentials to access the platform." : "Enter your details to create your account."}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-sm border border-crit/40 bg-crit/10 px-4 py-3 text-sm text-crit">
              {error}
            </div>
          )}

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="text-xs font-medium text-foreground">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required={!isLogin}
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setError(null); }}
                  placeholder="John Doe"
                  className="h-9 w-full rounded-sm border border-border bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete={isLogin ? "email" : "username"}
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@darkops.com"
                className="h-9 w-full rounded-sm border border-border bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="h-9 w-full rounded-sm border border-border bg-surface px-3 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required={!isLogin}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    className="h-9 w-full rounded-sm border border-border bg-surface px-3 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || (!isLogin && (!fullName || !confirmPassword))}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isLogin ? "Authenticating…" : "Creating account…"}
                </>
              ) : (
                isLogin ? "Sign in to DarkOps" : "Create account"
              )}
            </button>
          </form>

          {/* Toggle between login and register */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? "Don't have an account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>

          {/* Demo access */}
          <div className="mt-8 rounded-sm border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-xs font-medium text-foreground">Demo access</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Click a role to populate credentials · password is{" "}
                <code className="num font-medium text-foreground">password123</code>
              </p>
            </div>
            <div className="divide-y divide-border">
              {DEMO_ROLES.map((role) => (
                <button
                  key={role.email}
                  type="button"
                  onClick={() => fillDemo(role.email)}
                  className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                >
                  <span className={`text-[13px] font-medium ${role.color}`}>{role.label}</span>
                  <span className="num text-[11px] text-muted-foreground">{role.email}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              ← Back to overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
