import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  Eye,
  EyeOff,
  Loader2,
  BarChart3,
  Layers,
  Store,
  ShieldAlert,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  ExternalLink,
  Zap,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in - DarkOps Platform" },
      {
        name: "description",
        content: "Sign in to DarkOps Resolution Care & Operational Command Center.",
      },
    ],
  }),
  component: LoginPage,
});

interface DemoRole {
  label: string;
  roleTitle: string;
  email: string;
  description: string;
  badge: string;
  color: string;
  icon: any;
}

const DEMO_CATEGORIES: Record<string, { label: string; roles: DemoRole[] }> = {
  management: {
    label: "Management & Ops",
    roles: [
      {
        label: "Executive",
        roleTitle: "Network Executive",
        email: "exec@darkops.com",
        description: "Macro network metrics, PulseScore trends & city performance",
        badge: "EXECUTIVE",
        color: "text-primary border-primary/30 bg-primary/10",
        icon: BarChart3,
      },
      {
        label: "Operations",
        roleTitle: "Ops Manager",
        email: "manager@darkops.com",
        description: "Case resolution, SLA tracking & operational queues",
        badge: "OPERATIONS",
        color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
        icon: Layers,
      },
      {
        label: "Store Manager",
        roleTitle: "Hub Manager (DS-1462)",
        email: "storemanager@darkops.com",
        description: "Single store operational health & work order execution",
        badge: "STORE MGR",
        color: "text-amber-500 border-amber-500/30 bg-amber-500/10",
        icon: Store,
      },
      {
        label: "Platform Admin",
        roleTitle: "System Admin",
        email: "admin@darkops.com",
        description: "Full system administration & user access management",
        badge: "ADMIN",
        color: "text-purple-400 border-purple-400/30 bg-purple-400/10",
        icon: Building2,
      },
    ],
  },
  support: {
    label: "Support & Care",
    roles: [
      {
        label: "Support Lead",
        roleTitle: "Customer Support Lead",
        email: "support@darkops.com",
        description: "Ticket queues, agent assignments & escalation review",
        badge: "SUPPORT LEAD",
        color: "text-rose-500 border-rose-500/30 bg-rose-500/10",
        icon: Users,
      },
      {
        label: "Agent A (Priya)",
        roleTitle: "Support Specialist",
        email: "agent.a@darkops.com",
        description: "Frontline complaint investigation & refund decisions",
        badge: "AGENT",
        color: "text-rose-400 border-rose-400/30 bg-rose-400/10",
        icon: Users,
      },
      {
        label: "Agent B (Rohan)",
        roleTitle: "Support Specialist",
        email: "agent.b@darkops.com",
        description: "Frontline complaint investigation & customer care",
        badge: "AGENT",
        color: "text-rose-400 border-rose-400/30 bg-rose-400/10",
        icon: Users,
      },
    ],
  },
  customer: {
    label: "Customer & Handoff",
    roles: [
      {
        label: "Customer Demo",
        roleTitle: "Rajat Sharma (Customer)",
        email: "customer@darkops.com",
        description: "Customer complaint submission & order tracking portal",
        badge: "CUSTOMER",
        color: "text-sky-400 border-sky-400/30 bg-sky-400/10",
        icon: Users,
      },
    ],
  },
};

function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeDemoCategory, setActiveDemoCategory] = useState<string>("management");
  const [showDemoDrawer, setShowDemoDrawer] = useState(true);

  // Read message or error passed via query string (e.g., from failed handoff verification)
  const initialError =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("message") ||
        new URLSearchParams(window.location.search).get("error") ||
        null
      : null;

  const [error, setError] = useState<string | null>(initialError);
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
          setError(
            "The email or password you entered is incorrect. Check your credentials and try again.",
          );
        } else if (
          authError.message.toLowerCase().includes("network") ||
          authError.message.toLowerCase().includes("fetch")
        ) {
          setError("Unable to reach the authentication server. Check your internet connection.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      queryClient.clear();
      await router.invalidate();

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser!.id)
        .single();

      const role = (profile as any)?.role as string | undefined;

      let redirectPath = "/executive";
      if (role === "CUSTOMER") redirectPath = "/customer";
      else if (role === "STORE_MANAGER") redirectPath = "/dark-stores";
      else if (role === "CUSTOMER_SUPPORT") redirectPath = "/support";
      else if (role === "OPERATIONS") redirectPath = "/operations";
      else if (role === "PLATFORM_ADMIN") redirectPath = "/admin";
      else if (role === "ADMIN") redirectPath = "/admin";
      else if (role === "OPERATIONS_MANAGER" || role === "OPERATIONS_AGENT")
        redirectPath = "/operations";

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
        const { error: profileError } = await (supabase.from("profiles") as any).insert([
          {
            id: authData.user.id,
            email: email.trim(),
            full_name: fullName,
            role: "CUSTOMER",
          },
        ]);

        if (profileError) {
          setError("Account created but profile setup failed. Please contact support.");
          setLoading(false);
          return;
        }

        await router.invalidate();
        navigate({ to: "/customer" });
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
    <div className="flex min-h-screen bg-background font-sans antialiased text-foreground">
      {/* Theme toggle - fixed top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Left Panel - Customer-Safe Platform Overview & Assurance */}
      <div className="hidden lg:flex lg:flex-col lg:w-[480px] xl:w-[540px] border-r border-border bg-gradient-to-b from-surface via-background to-surface p-10 justify-between relative overflow-hidden">
        {/* Ambient Background Accents */}
        <div className="absolute -top-24 -left-24 size-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Top Header & Brand */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 border border-primary/30 group-hover:scale-105 transition-transform">
                <span className="size-3.5 rounded-[3px] bg-primary" />
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Dark<span className="text-primary">Ops</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-500">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SYSTEM STATUS · ALL OPERATIONAL</span>
            </div>
          </div>

          <div className="pt-4 space-y-2">
            <span className="text-[11px] font-bold tracking-widest text-primary uppercase">
              Resolution Care & Operations Platform
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight leading-snug text-foreground">
              Monitor. Resolve.
              <br />
              <span className="text-primary">Decide. At scale.</span>
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-md pt-1">
              DarkOps powers seamless resolution care for customers and end-to-end operational coordination across the delivery network.
            </p>
          </div>
        </div>

        {/* Middle Platform Assurance Pillars (Customer-Safe) */}
        <div className="relative z-10 my-6 space-y-3">
          <div className="rounded-xl border border-border bg-surface/80 backdrop-blur p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2.5 font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                <span>Service Assurance Commitments</span>
              </span>
              <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                24/7 Care
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Clock className="size-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Instant Issue Triage</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Order issues are automatically routed to resolution specialists with real-time SLA tracking.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Fair & Transparent Resolutions</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Instant refunds, replacements, or agent reviews calculated with automated eligibility rules.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Lock className="size-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Enterprise Data Privacy</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Strict role-based access control, customer data isolation, and encrypted transaction security.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-muted-foreground border-t border-border/70 pt-4">
          <span>Deloitte Capstone · 2026</span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Lock className="size-3.5 text-primary" />
            <span>256-bit Encrypted</span>
          </span>
        </div>
      </div>

      {/* Right Panel - Sign In Form & Fenced Evaluator Demo Access */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 overflow-y-auto">
        {/* Mobile Header */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/15">
            <span className="size-3 rounded-[3px] bg-primary" />
          </span>
          <span className="text-base font-bold tracking-tight">
            Dark<span className="text-primary">Ops</span>
          </span>
        </div>

        <div className="w-full max-w-md space-y-6">
          {/* Form Header */}
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {isLogin ? "Sign in to DarkOps" : "Create an Account"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isLogin
                ? "Enter your account credentials to access your portal."
                : "Register a new customer account to access DarkOps Care."}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-500 flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Login / Register Form */}
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-3.5">
            {!isLogin && (
              <div className="space-y-1">
                <label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required={!isLogin}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setError(null);
                  }}
                  placeholder="Rajat Sharma"
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete={isLogin ? "email" : "username"}
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@darkops.com"
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 pr-10 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
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
              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required={!isLogin}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••"
                    className="h-9 w-full rounded-md border border-border bg-surface px-3 pr-10 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading || !email || !password || (!isLogin && (!fullName || !confirmPassword))
              }
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isLogin ? "Authenticating…" : "Creating account…"}
                </>
              ) : isLogin ? (
                "Sign in to DarkOps"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {isLogin ? "Don't have an account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>

          {/* Fenced Capstone Evaluator Access Drawer */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShowDemoDrawer(!showDemoDrawer)}
              className="w-full border-b border-border bg-surface-2/50 px-4 py-3 flex items-center justify-between hover:bg-surface-2 transition-colors text-left"
            >
              <div>
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>Capstone Evaluator Quick-Access</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pre-seeded demo credentials for testing platform RBAC roles
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded hidden sm:inline">
                  password123
                </span>
                {showDemoDrawer ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {showDemoDrawer && (
              <div className="space-y-0">
                {/* Category Tabs Header */}
                <div className="flex border-b border-border bg-surface-3/30 p-1 gap-1 text-xs font-semibold">
                  {Object.entries(DEMO_CATEGORIES).map(([catKey, cat]) => (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setActiveDemoCategory(catKey)}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-md text-[11px] transition-all text-center",
                        activeDemoCategory === catKey
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Role Buttons for Active Category */}
                <div className="p-2 space-y-1.5">
                  {DEMO_CATEGORIES[activeDemoCategory]?.roles.map((role) => {
                    const IconComponent = role.icon;
                    const isSelected = email === role.email;
                    return (
                      <button
                        key={role.email}
                        type="button"
                        onClick={() => fillDemo(role.email)}
                        className={cn(
                          "w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "border-border/60 bg-background hover:bg-surface-2/80 hover:border-border",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs mt-0.5",
                            role.color,
                          )}
                        >
                          <IconComponent className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground">{role.label}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded border", role.color)}>
                              {role.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{role.email}</p>
                          <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                            {role.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Special Upstream Handoff Action Card */}
                {activeDemoCategory === "customer" && (
                  <div className="p-2 pt-0 border-t border-border/60 bg-purple-500/5">
                    <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                        <span className="flex items-center gap-1.5">
                          <Zap className="size-4 text-amber-400" />
                          10MinMart Q-Commerce Handoff
                        </span>
                        <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded border border-purple-400/30">
                          HMAC Signed
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Test production upstream customer entry. Issues a signed token from 10MinMart grocery app and logs in automatically.
                      </p>
                      <Button
                        asChild
                        size="sm"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold h-8"
                      >
                        <Link to="/simulated-upstream/order-confirmation">
                          <span>Launch 10MinMart Upstream Demo</span>
                          <ExternalLink className="ml-1.5 size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground pt-1">
            <Link to="/" className="hover:text-foreground transition-colors font-medium">
              ← Back to Platform Overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
