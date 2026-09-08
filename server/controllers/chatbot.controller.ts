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
    let suggestions = ["Check complaint status", "Which order is my complaint about?", "My account info"];

    // ── Intent 1: Action / Creation Attempts (Read-Only Guard) ────────────────
    const isActionAttempt =
      lastUserMessage.includes("create") ||
      lastUserMessage.includes("file") ||
      lastUserMessage.includes("submit") ||
      lastUserMessage.includes("report issue") ||
      lastUserMessage.includes("refund me") ||
      lastUserMessage.includes("reorder") ||
      lastUserMessage.includes("open ticket") ||
      lastUserMessage.includes("cancel order") ||
      lastUserMessage.includes("missing item") ||
      lastUserMessage.includes("wrong item") ||
      lastUserMessage.includes("damaged item");

    if (isActionAttempt) {
      response =
        "I am a read-only support assistant and cannot create complaints or process refunds directly. To report an issue with an order, please go to your **Orders** tab, select the specific order, and click **Report Issue**. Our automated intelligence layer will process your complaint immediately.";
      suggestions = ["Check complaint status", "My account info"];
      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 2: Complaint Order Association / Context ───────────────────────
    if (
      lastUserMessage.includes("which order") ||
      lastUserMessage.includes("associated order") ||
      lastUserMessage.includes("complaint order") ||
      lastUserMessage.includes("what order")
    ) {
      if (!rawComplaints || rawComplaints.length === 0) {
        response = "You currently do not have any complaint records on file.";
      } else {
        const openComplaints = rawComplaints.filter(
          (c) => c.status !== "resolved" && c.status !== "closed",
        );
        const target = openComplaints.length > 0 ? openComplaints[0] : rawComplaints[0];
        const storeName = (target.stores as any)?.name || "Dark Store";
        response = `Your complaint (**${target.complaint_ref}**) is associated with Order **${target.order_id}** from **${storeName}**.\n- **Issue:** ${target.summary}\n- **Detail:** ${target.detail}`;
      }
      suggestions = ["Check complaint status", "My account info"];
      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 3: Live Agent Escalation Queries ─────────────────────────────────
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
          "You currently do not have any open complaints. To request support, please open your order under the Orders tab and select 'Report Issue'. Live support becomes available if an open case exceeds its SLA.";
        suggestions = ["Check complaint status", "My account info"];
      } else {
        const eligibleComplaint = openComplaints.find(
          (c) => getCustomerSafeStatus(c).isLiveCallEligible,
        );

        if (eligibleComplaint) {
          response = `Your complaint (${eligibleComplaint.complaint_ref}) for Order ${eligibleComplaint.order_id} has passed our standard SLA response window. Live support is now unlocked! You can click 'Connect me to a live agent' on your Complaint details page.`;
          suggestions = ["Check complaint status", "My account info"];
        } else {
          const mostRecent = openComplaints[0];
          response = `Your complaint (${mostRecent.complaint_ref}) for Order ${mostRecent.order_id} is currently being reviewed by our support team within SLA. Live agent connection will automatically become available if your case remains unresolved past SLA.`;
          suggestions = ["Check complaint status", "My account info"];
        }
      }

      return res.status(200).json({ message: response, suggestions });
    }

    // ── Intent 4: Order Boundary & Context Queries ─────────────────────────────
    if (
      lastUserMessage.includes("order") ||
      lastUserMessage.includes("delivery") ||
      lastUserMessage.includes("where") ||
      lastUserMessage.includes("track")
    ) {
      const activeOrder = rawOrders.find((o) => o.status !== "delivered");

      if (activeOrder) {
        const storeName = (activeOrder.stores as any)?.name || "Local Dark Store";
        response = `Your active order (**${activeOrder.id}**) from **${storeName}** is currently **${activeOrder.status}**.\n\nFull order details are available under the **Orders** tab. I am here to help you check any complaint related to your orders.`;
      } else if (rawOrders.length > 0) {
        const mostRecent = rawOrders[0];
        const storeName = (mostRecent.stores as any)?.name || "Local Dark Store";
        response = `Your most recent order (**${mostRecent.id}**) from **${storeName}** is **${mostRecent.status}**.\n\nFull order history is available under the **Orders** tab. I am here to help you check your complaint records.`;
      } else {
        response =
          "Your complete order history is available under the **Orders** tab. I am here to help you check your complaint records or explain the status of a reported issue.";
      }

      suggestions = ["Check complaint status", "Which order is my complaint about?", "My account info"];
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
        const openComplaints = rawComplaints.filter(
          (c) => c.status !== "resolved" && c.status !== "closed",
        );
        const resolvedCount = rawComplaints.length - openComplaints.length;

        const targetComplaint = openComplaints.length > 0 ? openComplaints[0] : rawComplaints[0];
        const safeStatus = getCustomerSafeStatus(targetComplaint);
        const submittedAt = format(new Date(targetComplaint.created_at), "dd MMM, HH:mm 'IST'");
        const storeName = (targetComplaint.stores as any)?.name || "Dark Store";

        const summaryHeader =
          openComplaints.length > 0
            ? `You have **${openComplaints.length}** open complaint(s) out of **${rawComplaints.length}** total record(s).`
            : `All **${rawComplaints.length}** of your complaint(s) have been resolved.`;

        const sectionHeader =
          openComplaints.length > 0 ? "Active Open Complaint:" : "Most Recent Complaint:";

        response = `${summaryHeader}\n\n**${sectionHeader}**\n- **Reference:** ${targetComplaint.complaint_ref}\n- **Order:** ${targetComplaint.order_id} (${storeName})\n- **Category:** ${targetComplaint.summary}\n- **Submitted:** ${submittedAt}\n- **Status:** ${safeStatus.label}\n- **Details:** ${safeStatus.details}`;

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
