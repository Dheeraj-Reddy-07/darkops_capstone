import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  HelpCircle,
  Sparkles,
  PhoneCall,
  ArrowRight,
  Package,
  Bike,
  Receipt,
  User,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/simulated-upstream/order-confirmation")({
  head: () => ({
    meta: [
      { title: "10MinMart - Superfast Grocery Delivery" },
      { name: "description", content: "Real-world Quick Commerce simulated order confirmation page." },
    ],
  }),
  component: SimulatedUpstreamPage,
});

const DEMO_ORDER = {
  orderId: "ORD-884213",
  customerId: "usr-cust-001",
  customerName: "Rajat Sharma",
  storeName: "Bengaluru Ring Road (DS-1525)",
  placedAt: "Today, 08:00 AM",
  deliveredAt: "Today, 08:11 AM (Delivered in 11 mins)",
  totalAmount: 1840,
  handlingFee: 5,
  paymentMethod: "UPI · Google Pay",
  address: "Flat 1204, Brigade Enclave, Outer Ring Rd, Bellandur, Bengaluru 560103",
  riderName: "Ramesh Kumar",
  riderRating: "4.9 ★",
  items: [
    {
      id: "item-1",
      name: "Nandini Toned Fresh Milk",
      weight: "1L × 2 Pouch",
      price: 136,
      qty: 2,
      category: "Dairy & Milk",
      emoji: "🥛",
    },
    {
      id: "item-2",
      name: "Farm Fresh Organic Brown Eggs",
      weight: "12 Pack",
      price: 120,
      qty: 1,
      category: "Eggs & Meat",
      emoji: "🥚",
    },
    {
      id: "item-3",
      name: "Amul Pasteurised Salted Butter",
      weight: "500g Pack",
      price: 1584,
      qty: 1,
      category: "Dairy & Butter",
      emoji: "🧈",
    },
  ],
};

const ISSUE_CATEGORIES = [
  { id: "missing_item", label: "Item missing", hint: "Part of order not delivered", icon: "🔍" },
  { id: "damaged_item", label: "Damaged / Leaked", hint: "Spoiled or broken package", icon: "💔" },
  { id: "wrong_item", label: "Wrong item", hint: "Received different item", icon: "📦" },
  { id: "quality_issue", label: "Quality issue", hint: "Expired or poor quality", icon: "🥛" },
  { id: "late_delivery", label: "Late delivery", hint: "Arrived past promised ETA", icon: "⏰" },
];

function SimulatedUpstreamPage() {
  const [selectedCategory, setSelectedCategory] = useState("missing_item");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(true);

  const handleReportProblem = async () => {
    setIsRedirecting(true);
    try {
      const response = await fetch("/api/v1/integration/handoff/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: DEMO_ORDER.customerId,
          order_id: DEMO_ORDER.orderId,
          issue_category: selectedCategory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate handoff token from 10MinMart backend.");
      }

      const data = await response.json();
      if (!data.handoff_url) {
        throw new Error("Invalid handoff token response.");
      }

      toast.success("Handoff Token Signed Successfully ⚡", {
        description: "Redirecting to DarkOps Care with authenticated order session...",
      });

      setTimeout(() => {
        window.location.href = data.handoff_url;
      }, 500);
    } catch (err: any) {
      toast.error("Handoff Failed", { description: err.message || "Unable to initiate handoff" });
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-purple-500 selection:text-white">
      {/* Real-World Quick Commerce Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        {/* Top Announcement Bar */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white px-4 py-1.5 text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2">
          <Sparkles className="size-3.5 text-amber-300 animate-pulse" />
          <span>SIMULATED UPSTREAM PLATFORM - "10MINMART" QUICK COMMERCE</span>
          <span className="hidden sm:inline bg-purple-900/60 px-2 py-0.5 rounded text-[10px] text-purple-200 border border-purple-400/30">
            Parody Q-Commerce App
          </span>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo & Location Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-700 to-amber-400 font-black text-white text-xl shadow-md shadow-purple-500/20">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
                  10Min<span className="text-purple-600">Mart</span>
                </span>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">
                  Superfast Groceries
                </span>
              </div>
            </div>

            {/* Delivery Location Pill (Real-world Q-Commerce feature) */}
            <div className="hidden md:flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 border border-slate-200 text-xs">
              <MapPin className="size-4 text-purple-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="font-bold text-slate-800 leading-tight">Delivery in 10 mins</span>
                <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                  Flat 1204, Brigade Enclave...
                </span>
              </div>
              <ChevronRight className="size-3.5 text-slate-400 ml-1" />
            </div>
          </div>

          {/* Search Bar & User Actions */}
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                readOnly
                placeholder="Search 'milk, eggs, butter'..."
                className="w-full rounded-xl bg-slate-100 border border-slate-200 py-1.5 pl-9 pr-3 text-xs text-slate-700 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200/80 rounded-xl px-3 py-1.5 text-xs text-purple-900 font-semibold">
              <User className="size-3.5 text-purple-600" />
              <span className="hidden sm:inline">{DEMO_ORDER.customerName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* Handoff Explanation Callout for Capstone Evaluators */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 p-4 shadow-sm text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
            <ShieldCheck className="size-4 text-purple-600 shrink-0" />
            <span>Upstream Signed Handoff Demonstration</span>
          </div>
          <p className="text-slate-700 leading-relaxed">
            This screen simulates an external grocery app. Clicking 
            <strong className="text-purple-900"> "Report a problem on DarkOps Care"</strong> issues a 
            cryptographic HMAC signed token and lands directly in DarkOps pre-authenticated - without a second login.
          </p>
        </div>

        {/* 1. Hero Delivery Success Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>ORDER DELIVERED IN 11 MINS</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Delivered to Flat 1204 🎉
              </h1>
              <p className="text-xs text-slate-500">
                Order ID: <span className="font-mono font-bold text-slate-800">{DEMO_ORDER.orderId}</span> · {DEMO_ORDER.placedAt}
              </p>
            </div>

            <div className="text-right bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Total Amount Paid</span>
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{DEMO_ORDER.totalAmount + DEMO_ORDER.handlingFee}
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">
                ✓ {DEMO_ORDER.paymentMethod}
              </span>
            </div>
          </div>

          {/* Q-Commerce Delivery Timeline Steps */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-purple-600" />
                Delivery Tracker Timeline
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Fulfilled in 11 mins
              </span>
            </div>

            {/* Stepper bar */}
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="flex flex-col items-center gap-1">
                <div className="h-2 w-full rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">Order Placed</span>
                <span className="text-[10px] text-slate-400">08:00 AM</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-2 w-full rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">Packed</span>
                <span className="text-[10px] text-slate-400">08:04 AM</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-2 w-full rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">Out for Delivery</span>
                <span className="text-[10px] text-slate-400">08:06 AM</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-2 w-full rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-700">Delivered</span>
                <span className="text-[10px] text-slate-400">08:11 AM</span>
              </div>
            </div>
          </div>

          {/* Delivery Partner Details Card */}
          <div className="flex items-center justify-between rounded-2xl bg-purple-50/60 border border-purple-200/70 p-3.5 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-600 text-white font-bold text-sm shadow-xs">
                <Bike className="size-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{DEMO_ORDER.riderName}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {DEMO_ORDER.riderRating}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">SwiftRiders Executive · Dark Store DS-1525</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast.info("Rider Call", { description: "Delivery executive Ramesh Kumar already completed handover." })}
              className="flex items-center gap-1.5 rounded-xl bg-white border border-purple-200 px-3 py-1.5 font-bold text-purple-700 hover:bg-purple-100 transition-colors"
            >
              <PhoneCall className="size-3.5" />
              <span>Call Rider</span>
            </button>
          </div>
        </div>

        {/* 2. Order Items List */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-slate-900 text-base">
              <ShoppingBag className="size-5 text-purple-600" />
              <span>Items Delivered ({DEMO_ORDER.items.length})</span>
            </div>
            <span className="text-xs text-slate-500">Fulfilled from {DEMO_ORDER.storeName}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {DEMO_ORDER.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3.5 text-xs">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl border border-slate-200/60">
                    {item.emoji}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.weight} · Qty: <span className="font-bold text-slate-700">{item.qty}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-sm">₹{item.price}</div>
                  <div className="text-[10px] text-slate-400">₹{item.price / item.qty} / unit</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bill Summary Accordion */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <button
              type="button"
              onClick={() => setShowBillDetails(!showBillDetails)}
              className="flex w-full items-center justify-between text-xs font-bold text-slate-700 hover:text-purple-700"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="size-4 text-purple-600" />
                <span>Bill Summary</span>
              </span>
              <span>{showBillDetails ? "Hide details ▲" : "Show details ▼"}</span>
            </button>

            {showBillDetails && (
              <div className="rounded-2xl bg-slate-50 p-3.5 text-xs space-y-2 text-slate-600 border border-slate-200/60">
                <div className="flex justify-between">
                  <span>Item Total</span>
                  <span className="font-mono text-slate-800">₹{DEMO_ORDER.totalAmount}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Delivery Fee</span>
                  <span>FREE (10MinMart Pass)</span>
                </div>
                <div className="flex justify-between">
                  <span>Handling & Packaging Fee</span>
                  <span className="font-mono text-slate-800">₹{DEMO_ORDER.handlingFee}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Total Paid</span>
                  <span>₹{DEMO_ORDER.totalAmount + DEMO_ORDER.handlingFee}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Real-World Quick Commerce Support / Handoff Action Section */}
        <div className="rounded-3xl border-2 border-purple-200 bg-gradient-to-b from-white via-purple-50/40 to-purple-100/30 p-6 shadow-md space-y-4 text-center">
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-1">
              <HelpCircle className="size-3.5 text-purple-600" />
              Order Assistance
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              Need Help with this Order?
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Had an issue with missing, damaged, or delayed items? Raise a complaint to transfer directly to DarkOps resolution care.
            </p>
          </div>

          {/* Action CTA Button */}
          <div className="space-y-2 pt-2 max-w-md mx-auto">
            <button
              type="button"
              onClick={handleReportProblem}
              disabled={isRedirecting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 px-6 py-4 text-sm font-black text-white shadow-lg shadow-purple-600/30 transition-all hover:from-purple-800 hover:to-indigo-800 active:scale-[0.99] disabled:opacity-50"
            >
              {isRedirecting ? (
                <>
                  <Sparkles className="size-4 animate-spin text-amber-300" />
                  <span>Signing HMAC Token & Handing Off to DarkOps...</span>
                </>
              ) : (
                <>
                  <span>Raise a Complaint on DarkOps Care</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="size-3.5 text-purple-600" />
              <span>
                Signed HMAC Token Handoff · Grounds session in Order #{DEMO_ORDER.orderId}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
