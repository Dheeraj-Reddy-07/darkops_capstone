import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { logSecurityEvent } from "../services/audit.service";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// Chatbot security: Allowlist of safe operations
const ALLOWED_OPERATIONS = [
  "order_status",
  "recent_orders",
  "complaint_status",
  "file_complaint",
  "human_agent",
  "account_info",
  "refund_info",
  "help",
] as const;

// Chatbot security: Blocklist of dangerous keywords
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

export const handleCustomerChat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const requestId = (req as any).requestId || "unknown";
    const { messages } = req.body as ChatRequest;

    if (!messages || messages.length === 0) {
      throw new HTTPError(400, "INVALID_REQUEST", "No messages provided");
    }

    const lastUserMessage = messages[messages.length - 1].content.toLowerCase();

    // Chatbot security: Check for blocked keywords
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
          message: lastUserMessage.substring(0, 100), // First 100 chars for logging
        },
      });

      return res.status(200).json({
        message:
          "I can only help you with your own orders, complaints, and account information. I don't have access to other customers' data or internal systems.",
        suggestions: [
          "Check my order status",
          "View recent orders",
          "Check complaint status",
          "Talk to human agent",
        ],
      });
    }

    // Find customer with ownership verification
    let customer;
    const { data: customerByProfile, error: profileErr } = await adminClient
      .from("customers")
      .select("id, full_name, email")
      .eq("profile_id", auth.user.id)
      .single();

    if (!profileErr && customerByProfile) {
      customer = customerByProfile;
    } else {
      const { data: customerByEmail, error: emailErr } = await adminClient
        .from("customers")
        .select("id, full_name, email")
        .eq("email", auth.user.email)
        .single();

      if (emailErr || !customerByEmail) {
        throw new HTTPError(404, "NOT_FOUND", "Customer profile not found");
      }
      customer = customerByEmail;
    }

    // Chatbot security: All database queries must include customer_id filter
    let response = "";

    // Order-related queries (always filtered by customer_id)
    if (lastUserMessage.includes("order") || lastUserMessage.includes("delivery")) {
      if (
        lastUserMessage.includes("status") ||
        lastUserMessage.includes("where") ||
        lastUserMessage.includes("track")
      ) {
        // SECURITY: Always filter by customer_id
        const { data: activeOrders } = await adminClient
          .from("orders")
          .select("id, status, eta_at, placed_at, stores(name)")
          .eq("customer_id", customer.id) // Ownership filter
          .neq("status", "delivered")
          .order("placed_at", { ascending: false })
          .limit(1);

        if (activeOrders && activeOrders.length > 0) {
          const order = activeOrders[0] as any;
          const eta = order.eta_at
            ? new Date(order.eta_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "not available";
          response = `You have an active order (${order.id}) from ${order.stores?.name || "your local store"}. Current status: ${order.status}. Estimated delivery time: ${eta}.`;
        } else {
          const { data: recentOrder } = await adminClient
            .from("orders")
            .select("id, status, delivered_at, stores(name)")
            .eq("customer_id", customer.id) // Ownership filter
            .order("placed_at", { ascending: false })
            .limit(1);

          if (recentOrder && recentOrder.length > 0) {
            const order = recentOrder[0] as any;
            response = `Your most recent order (${order.id}) from ${order.stores?.[0]?.name || "your local store"} is ${order.status}.`;
          } else {
            response =
              "You don't have any orders yet. Would you like to place an order through the quick-commerce app?";
          }
        }
      } else if (lastUserMessage.includes("recent") || lastUserMessage.includes("history")) {
        // SECURITY: Always filter by customer_id
        const { data: recentOrders } = await adminClient
          .from("orders")
          .select("id, status, placed_at, total_amount_paise, stores(name)")
          .eq("customer_id", customer.id) // Ownership filter
          .order("placed_at", { ascending: false })
          .limit(3);

        if (recentOrders && recentOrders.length > 0) {
          const orderList = recentOrders
            .map(
              (o: any) =>
                `- Order ${o.id}: ${o.status} (${o.stores?.[0]?.name || "Local Store"}, ₹${o.total_amount_paise / 100})`,
            )
            .join("\n");
          response = `Here are your recent orders:\n${orderList}`;
        } else {
          response = "You don't have any orders yet.";
        }
      } else {
        response =
          "I can help you with your orders. Try asking about your order status, recent orders, or delivery tracking.";
      }
    }
    // Complaint-related queries (always filtered by customer_id)
    else if (
      lastUserMessage.includes("complaint") ||
      lastUserMessage.includes("issue") ||
      lastUserMessage.includes("problem")
    ) {
      if (lastUserMessage.includes("status") || lastUserMessage.includes("track")) {
        // SECURITY: Always filter by customer_id
        const { data: complaints } = await adminClient
          .from("complaints")
          .select("id, complaint_ref, status, summary, created_at")
          .eq("customer_id", customer.id) // Ownership filter
          .neq("status", "resolved")
          .neq("status", "closed")
          .order("created_at", { ascending: false });

        if (complaints && complaints.length > 0) {
          const complaintList = complaints
            .map((c) => `- ${c.complaint_ref}: ${c.status} - ${c.summary}`)
            .join("\n");
          response = `You have ${complaints.length} open complaint${complaints.length > 1 ? "s" : ""}:\n${complaintList}\n\nI can help you escalate any of these to a human agent if needed.`;
        } else {
          response =
            "You don't have any open complaints. If you have an issue with an order, you can report it from the Support page.";
        }
      } else if (
        lastUserMessage.includes("new") ||
        lastUserMessage.includes("file") ||
        lastUserMessage.includes("report")
      ) {
        response =
          "To file a new complaint, please go to the Support page and select the order with the issue. You can attach photos and describe the problem there.";
      } else {
        response =
          "I can help you with your complaints. Try asking about your complaint status or how to file a new complaint.";
      }
    }
    // Human agent escalation (only for customer's own complaints)
    else if (
      lastUserMessage.includes("human") ||
      lastUserMessage.includes("agent") ||
      lastUserMessage.includes("talk to person") ||
      lastUserMessage.includes("support")
    ) {
      // SECURITY: Only show customer's own complaints
      const { data: openComplaints } = await adminClient
        .from("complaints")
        .select("id, complaint_ref, status, summary")
        .eq("customer_id", customer.id) // Ownership filter
        .neq("status", "resolved")
        .neq("status", "closed")
        .order("created_at", { ascending: false });

      if (openComplaints && openComplaints.length > 0) {
        const complaintList = openComplaints
          .map((c: any) => `${c.complaint_ref}: ${c.summary} (${c.status})`)
          .join("\n");
        response = `I can connect you with a human agent. You have ${openComplaints.length} open complaint${openComplaints.length > 1 ? "s" : ""}:\n${complaintList}\n\nPlease provide the complaint reference you'd like to escalate, or I can escalate your most recent issue (${openComplaints[0].complaint_ref}).`;
      } else {
        response =
          "I can connect you with a human agent. Since you don't have any open complaints, I'll create a support ticket for you. Please describe your issue and I'll escalate it to our support team.";
      }
    }
    // Greetings
    else if (
      lastUserMessage.includes("hello") ||
      lastUserMessage.includes("hi") ||
      lastUserMessage.includes("hey")
    ) {
      response = `Hello ${customer.full_name?.split(" ")[0] || "there"}! I'm here to help you with your orders, complaints, and any questions you might have. What can I assist you with today?`;
    }
    // Help
    else if (lastUserMessage.includes("help") || lastUserMessage.includes("what can you do")) {
      response =
        "I can help you with:\n- Checking your order status and delivery tracking\n- Viewing your recent orders\n- Checking your complaint status\n- Escalating issues to human agents\n- General questions about your account\n\nJust ask me anything about your orders or complaints!";
    }
    // Account info (only customer's own account)
    else if (lastUserMessage.includes("account") || lastUserMessage.includes("profile")) {
      response = `Your account is registered under ${customer.email}. You can view your full profile details, order history, and support history from the Profile page.`;
    }
    // Refund-related
    else if (lastUserMessage.includes("refund") || lastUserMessage.includes("money back")) {
      response =
        "Refunds are processed based on your complaint resolution. If you have a refund-related question, please check your complaint status or file a new complaint from the Support page.";
    }
    // Default fallback
    else {
      response =
        "I'm not sure I understood that. I can help you with your orders, complaints, or account information. Try asking about your order status, recent orders, or complaint status. Or you can ask to speak with a human agent.";
    }

    res.status(200).json({
      message: response,
      suggestions: [
        "Check my order status",
        "View recent orders",
        "Check complaint status",
        "Talk to human agent",
      ],
    });
  } catch (error) {
    next(error);
  }
};
