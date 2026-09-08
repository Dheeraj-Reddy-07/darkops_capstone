import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { logSecurityEvent } from "../services/audit.service";
import { format } from "date-fns";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// Chatbot security: Blocklist of dangerous keywords targeting administrative/internal data
const BLOCKED_KEYWORDS = [
  "all customers",
  "all orders",
  "all complaints",
  "dump database",
  "show me all",
  "list all users",
  "admin panel",
  "internal data",
  "other customer",
  "another customer",
  "fraud records",
  "internal notes",
  "agent notes",
  "system prompt",
  "your instructions",
  "ignore previous",
  "bypass security",
  "escalate privileges",
];

// Helper to translate internal complaint state into customer-safe status description
function getCustomerSafeStatus(c: any) {
  if (c.status === "resolved") {
    return {
      label: "Resolved",
      details: c.resolution ? `Resolution: ${c.resolution}` : "Your complaint has been resolved.",
      isLiveCallEligible: false,
    };
  }
  if (c.status === "closed") {
    return {
      label: "Closed",
      details: "This complaint record has been closed.",
      isLiveCallEligible: false,
    };
  }

  // Calculate SLA eligibility for open complaints
  const createdAtMs = c.created_at ? new Date(c.created_at).getTime() : Date.now();
  const slaMinsMap: Record<string, number> = { P1: 15, P2: 30, P3: 120, P4: 240 };
  const slaMins = slaMinsMap[c.priority] || 120;
  const slaDueMs = createdAtMs + slaMins * 60 * 1000;
  const isBreached = Date.now() > slaDueMs;

  if (isBreached) {
    return {
      label: "Response SLA Exceeded (Live support available)",
      details:
        "Our standard review window has passed. You are now eligible to connect with a live support agent on your complaint details page.",
      isLiveCallEligible: true,
    };
  }

  return {
    label: "Being reviewed by support team",
    details: "Your complaint is currently under review by our operations team within SLA.",
    isLiveCallEligible: false,
  };
}

export const handleCustomerChat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const requestId = (req as any).requestId || "unknown";
    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HTTPError(400, "INVALID_REQUEST", "No messages provided");
    }

    const lastUserMessage = messages[messages.length - 1].content.trim().toLowerCase();

    // 1. Security Check: Blocklist
    const hasBlockedKeyword = BLOCKED_KEYWORDS.some((keyword) =>
      lastUserMessage.includes(keyword.toLowerCase()),
    );

    if (hasBlockedKeyword) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "PRIVILEGE_ESCALATION_ATTEMPT",
        resourceType: "chatbot",
        resourceId: "N/A",
        requestId,
        ip: req.ip,
        metadata: {
          reason: "blocked_keyword_in_chatbot",
          message: lastUserMessage.substring(0, 100),
        },
      });

      return res.status(200).json({
        message:
          "I can only help you with your authorized orders, complaints, and account details. I do not have access to internal systems or other customers' records.",
        suggestions: [
          "Where is my order?",
          "Check my complaint status",
          "My account information",
        ],
      });
    }

    // 2. Resolve authenticated customer ID
    let customer: { id: string; full_name: string; email: string };
    const { data: customerByProfile } = await adminClient
      .from("customers")
      .select("id, full_name, email")
      .eq("profile_id", auth.user.id)
      .maybeSingle();

    if (customerByProfile) {
      customer = customerByProfile;
    } else {
      const { data: customerByEmail } = await adminClient
        .from("customers")
        .select("id, full_name, email")
        .eq("email", auth.user.email)
        .maybeSingle();

      if (!customerByEmail) {
        throw new HTTPError(404, "NOT_FOUND", "Customer profile not found");
      }
      customer = customerByEmail;
    }

    // 3. Fetch real customer orders (IDOR protected via customer_id)
    const { data: rawOrders = [] } = await adminClient
      .from("orders")
      .select("id, status, placed_at, total_amount_paise, eta_at, delivered_at, item_count, stores(name)")
      .eq("customer_id", customer.id)
      .order("placed_at", { ascending: false });

    // 4. Fetch real customer complaints (IDOR protected via customer_id)
    const { data: rawComplaints = [] } = await adminClient
      .from("complaints")
      .select("id, complaint_ref, order_id, summary, detail, category, status, priority, type, created_at, resolution, order_value_paise, stores(name)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    let response = "";
    let suggestions = ["Where is my order?", "Check complaint status", "My account info"];

    // ── Intent 1: Action / Creation Attempts (Read-Only Guard) ────────────────
    const isActionAttempt =
      lastUserMessage.includes("create") ||
      lastUserMessage.includes("file") ||
      lastUserMessage.includes("submit") ||
      lastUserMessage.includes("report issue") ||
      lastUserMessage.includes("refund me") ||
      lastUserMessage.includes("reorder") ||
      lastUserMessage.includes("open ticket") ||
      lastUserMessage.includes("cancel order");

    if (isActionAttempt) {
      response =
        "I am a read-only support assistant and cannot create complaints or process refunds directly. To report an issue with an order, please go to your **Orders** tab, select the specific order, and click **Report Issue**. Our automated intelligence system will process your report immediately.";
      suggestions = ["Where is my order?", "Check complaint status"];
      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 2: Live Agent Escalation Queries ─────────────────────────────────
    if (
      lastUserMessage.includes("human") ||
      lastUserMessage.includes("agent") ||
      lastUserMessage.includes("talk to person") ||
      lastUserMessage.includes("live call") ||
      lastUserMessage.includes("speak to someone")
    ) {
      const openComplaints = (rawComplaints || []).filter(
        (c) => c.status !== "resolved" && c.status !== "closed",
      );

      if (openComplaints.length === 0) {
        response =
          "You currently do not have any open complaints. If you have an issue with an order, please visit your Orders tab and select 'Report Issue'.";
        suggestions = ["Where is my order?", "My account info"];
      } else {
        const eligibleComplaint = openComplaints.find(
          (c) => getCustomerSafeStatus(c).isLiveCallEligible,
        );

        if (eligibleComplaint) {
          response = `Your complaint (${eligibleComplaint.complaint_ref}) for Order ${eligibleComplaint.order_id} has passed our standard SLA response window. Live support is now unlocked for your case! You can click 'Connect me to a live agent' on your Complaint details page.`;
          suggestions = ["Check complaint status", "Where is my order?"];
        } else {
          const mostRecent = openComplaints[0];
          response = `Your complaint (${mostRecent.complaint_ref}) for Order ${mostRecent.order_id} is currently being reviewed by our support team. Standard review is within SLA. Live agent connection will become available if your case remains unresolved past SLA.`;
          suggestions = ["Check complaint status", "Where is my order?"];
        }
      }

      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 3: Order Status Queries ─────────────────────────────────────────
    if (
      lastUserMessage.includes("order") ||
      lastUserMessage.includes("delivery") ||
      lastUserMessage.includes("where") ||
      lastUserMessage.includes("track")
    ) {
      if (!rawOrders || rawOrders.length === 0) {
        response = "You currently do not have any order history in your account.";
        suggestions = ["Check complaint status", "My account info"];
      } else {
        const activeOrder = rawOrders.find((o) => o.status !== "delivered");

        if (activeOrder) {
          const storeName = (activeOrder.stores as any)?.name || "Local Dark Store";
          const placedAtFormatted = format(new Date(activeOrder.placed_at), "dd MMM, HH:mm 'IST'");
          const etaFormatted = activeOrder.eta_at
            ? format(new Date(activeOrder.eta_at), "HH:mm 'IST'")
            : "in progress";

          response = `You have an active order (**${activeOrder.id}**) from **${storeName}**.\n\n- **Status:** ${activeOrder.status}\n- **Placed At:** ${placedAtFormatted}\n- **Estimated Delivery:** ${etaFormatted}\n- **Total Amount:** ₹${(activeOrder.total_amount_paise / 100).toFixed(2)}`;
          suggestions = ["Check complaint status", "Where is my order?", "My account info"];
        } else {
          // Show recent order summary
          const topOrders = rawOrders.slice(0, 3);
          const orderSummary = topOrders
            .map((o) => {
              const storeName = (o.stores as any)?.name || "Local Dark Store";
              const dateStr = format(new Date(o.placed_at), "dd MMM, HH:mm 'IST'");
              return `- **${o.id}**: ${o.status} (₹${(o.total_amount_paise / 100).toFixed(2)}, ${storeName} · ${dateStr})`;
            })
            .join("\n");

          response = `You have no active undelivered orders. Here are your most recent orders:\n\n${orderSummary}`;
          suggestions = ["Check complaint status", "Where is my order?"];
        }
      }

      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 4: Complaint Status Queries ─────────────────────────────────────
    if (
      lastUserMessage.includes("complaint") ||
      lastUserMessage.includes("issue") ||
      lastUserMessage.includes("problem") ||
      lastUserMessage.includes("status") ||
      lastUserMessage.includes("claim")
    ) {
      if (!rawComplaints || rawComplaints.length === 0) {
        response =
          "You currently do not have any complaint records. If you experience an issue with a recent order, you can submit a report from your Orders page.";
        suggestions = ["Where is my order?", "My account info"];
      } else {
        const openCount = rawComplaints.filter(
          (c) => c.status !== "resolved" && c.status !== "closed",
        ).length;
        const resolvedCount = rawComplaints.length - openCount;

        const latestComplaint = rawComplaints[0];
        const safeStatus = getCustomerSafeStatus(latestComplaint);
        const submittedAt = format(new Date(latestComplaint.created_at), "dd MMM, HH:mm 'IST'");
        const storeName = (latestComplaint.stores as any)?.name || "Dark Store";

        response = `You have **${rawComplaints.length}** total complaint(s) (**${openCount}** open, **${resolvedCount}** resolved).\n\n**Most Recent Complaint:**\n- **Reference:** ${latestComplaint.complaint_ref}\n- **Order:** ${latestComplaint.order_id} (${storeName})\n- **Issue:** ${latestComplaint.summary}\n- **Submitted:** ${submittedAt}\n- **Status:** ${safeStatus.label}\n- **Details:** ${safeStatus.details}`;

        suggestions = ["Where is my order?", "Check complaint status", "My account info"];
      }

      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 5: Account Information ──────────────────────────────────────────
    if (
      lastUserMessage.includes("account") ||
      lastUserMessage.includes("profile") ||
      lastUserMessage.includes("who am i") ||
      lastUserMessage.includes("my info")
    ) {
      response = `Here is your authenticated profile information:\n\n- **Name:** ${customer.full_name || "Valued Customer"}\n- **Email:** ${customer.email}\n- **Customer ID:** ${customer.id}\n- **Active Orders:** ${rawOrders.filter((o) => o.status !== "delivered").length}\n- **Total Complaints:** ${rawComplaints.length}`;
      suggestions = ["Where is my order?", "Check complaint status"];
      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 6: Greetings & General Help Fallback ────────────────────────────
    const firstName = customer.full_name ? customer.full_name.split(" ")[0] : "there";

    if (
      lastUserMessage.includes("hello") ||
      lastUserMessage.includes("hi") ||
      lastUserMessage.includes("hey")
    ) {
      response = `Hello ${firstName}! I'm your DarkOps Care Assistant. I can look up your real-time order status, complaint records, and account information. What would you like to check today?`;
    } else {
      response = `Hello ${firstName}! I am a read-only support assistant. I can fetch your real-time order tracking, complaint history, or account details. Try asking:\n- *"Where is my order?"*\n- *"Check complaint status"*\n- *"My account info"*`;
    }

    return res.status(200).json({ message: response, suggestions });
  } catch (error) {
    next(error);
  }
};
