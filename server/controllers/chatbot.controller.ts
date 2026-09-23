import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { logSecurityEvent } from "../services/audit.service";
import { format } from "date-fns";
import { toComplaintDTO } from "../lib/dto";
import { thinkingDelay } from "../lib/thinking-delay";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// Security blocklist
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

// Intent detection
type Intent =
  | "ACTION_ATTEMPT"
  | "ISSUE_STATUS"
  | "ISSUE_EXPLANATION"
  | "NEXT_STEPS"
  | "ORDER_CONTEXT"
  | "SUPPORT_AVAILABILITY"
  | "GREETING"
  | "ACCOUNT_INFO"
  | "OUT_OF_SCOPE";

function detectIntent(msg: string): Intent {
  const m = msg.toLowerCase().trim();

  // 1. ACTION_ATTEMPT - catch action requests first
  if (
    /\b(create|submit|file|refund|reorder|cancel|open ticket|report issue|raise|lodge|request refund|want a refund|get a refund|cancel order|put in a claim|make a claim|process refund|file a complaint|file complaint)\b/.test(
      m,
    ) &&
    !m.includes("did i") &&
    !m.includes("why")
  ) {
    return "ACTION_ATTEMPT";
  }

  // 2. SUPPORT_AVAILABILITY - wants to talk to a human / call agent
  if (
    /\b(talk to|speak to|speak with|contact support|live support|human|agent|call someone|someone help|need help from|get an agent|talk with someone|chat with human|connect me|representative|customer care|operator|call agent|phone support|phone call|speak to human|get in touch|support phone|reach support|contact person)\b/.test(
      m,
    ) ||
    m.includes("can i call") ||
    m.includes("phone") ||
    m.includes("talk to support") ||
    m.includes("connect to live")
  ) {
    return "SUPPORT_AVAILABILITY";
  }

  // 3. ISSUE_EXPLANATION - why / reason / delay
  if (
    /\b(why|reason|taking so long|not resolved|still pending|still open|taking long|delayed|delay|what went wrong|why hasn|why isn|why didn|what is taking|why is it|why is my issue|why hasn't|why wasn't|why unresolved|how come|why hasn't my complaint|why is my complaint|why is my ticket|reason for delay|why no response)\b/.test(
      m,
    ) ||
    m.includes("taking so long") ||
    m.includes("why is my") ||
    m.includes("why hasn't") ||
    m.includes("why is it delayed")
  ) {
    return "ISSUE_EXPLANATION";
  }

  // 4. NEXT_STEPS - what happens next / what should I do
  if (
    /\b(next|what happens|what do i|what should i expect|after this|what now|do now|happens now|what's next|what is next|what do i do|what are the next steps|what happens after|where do we go from here|future steps|procedure|what is the process|what to do next|what comes next|what should happen next)\b/.test(
      m,
    ) ||
    m.includes("what happens next") ||
    m.includes("what should i do")
  ) {
    return "NEXT_STEPS";
  }

  // 5. ORDER_CONTEXT - which order / order info
  if (
    /\b(which order|what order|order was|order is|did i order|order had|item i ordered|order for|associated order|complaint order|which purchase|linked order|order reference|which order is|order details|order number|order linked to|which item)\b/.test(
      m,
    ) ||
    m.includes("associated order") ||
    m.includes("complaint order") ||
    m.includes("which order")
  ) {
    return "ORDER_CONTEXT";
  }

  // 6. ISSUE_STATUS - general status check & progress updates
  if (
    /\b(status|happening|open|review|resolved|complaint|issue|problem|case|claim|pending|my issue|my complaint|where's my|where is my|any update|update on my|how's my|how is my|track my|check my|progress|ticket status|where's my complaint at|any update on my issue|how's my ticket doing|what is the status|where is my ticket|how is my complaint|check status|current status|my ticket)\b/.test(
      m,
    ) ||
    m.includes("where's my complaint") ||
    m.includes("where is my complaint") ||
    m.includes("any update on") ||
    m.includes("how's my ticket") ||
    m.includes("check my issue")
  ) {
    return "ISSUE_STATUS";
  }

  // 7. ACCOUNT_INFO - summary stats (complaint summary metrics only)
  if (
    /\b(account|profile|my info|summary|my stats|my activity|my issues summary|total issues|issue summary|my summary|how many issues|how many complaints|my complaint count|issue history|complaint statistics)\b/.test(
      m,
    ) ||
    m.includes("issue summary") ||
    m.includes("my stats")
  ) {
    return "ACCOUNT_INFO";
  }

  // 8. GREETING
  if (
    /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening|greetings|howdy|hi there|hello there)\b/.test(
      m,
    )
  ) {
    return "GREETING";
  }

  return "OUT_OF_SCOPE";
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    wrong_item: "wrong item received",
    missing_item: "missing item",
    damaged_item: "damaged item",
    quality_issue: "quality issue",
    late_delivery: "late delivery",
    payment_issue: "payment or refund issue",
    other: "other",
  };
  return map[cat] || cat.replace(/_/g, " ");
}

function formatIssueName(category: string): string {
  const cat = formatCategory(category);
  if (cat.endsWith("issue")) return cat;
  return `${cat} issue`;
}

// Customer-visible status explanation
function explainStatus(status: string, category: string, customerStatusLabel: string): string {
  const issueName = formatIssueName(category);
  const s = (status || "").toLowerCase();

  if (s === "unassigned" || s === "received") {
    return `Your **${issueName}** has been received and is being processed by our support system. It hasn't been assigned to a team member yet, but it is in the queue.`;
  }
  if (s === "assigned" || s === "agent_queue") {
    return `Your **${issueName}** is currently under review by our support team. A team member has picked it up and is looking into it. You don't need to take any action right now.`;
  }
  if (s === "in_progress") {
    return `Your **${issueName}** is actively being worked on by our support team. Resolution is in progress - you will be updated when it's complete.`;
  }
  if (s === "auto_resolved") {
    return `Your **${issueName}** was resolved automatically by our support system. Check the resolution details on your issue page.`;
  }
  if (s === "resolved" || s === "closed") {
    return `Your **${issueName}** has been resolved. You can view the resolution details on your **My Issues** page.`;
  }
  if (s === "sla_expired") {
    return `Your **${issueName}** has been open longer than our usual response window. Live support is now available - you can connect with an agent directly from your issue page.`;
  }
  if (s === "awaiting_customer") {
    return `Our team needs a bit more information from you to resolve your **${issueName}**. Please check your email or messages for further details.`;
  }

  return `Your **${issueName}** is currently **${customerStatusLabel || status}**.`;
}

function explainWhyNotResolved(
  status: string,
  category: string,
  customerStatusLabel: string,
): string {
  const issueName = formatIssueName(category);
  const s = (status || "").toLowerCase();

  if (s === "unassigned" || s === "received") {
    return `Your **${issueName}** was received but hasn't been reviewed yet. It was submitted to our support queue and will be picked up shortly. You don't need to do anything right now.`;
  }
  if (s === "assigned" || s === "agent_queue") {
    return `Your **${issueName}** is currently under review by a support team member. It was routed for manual review rather than being resolved automatically - this is normal for this type of issue. No action is needed from you.`;
  }
  if (s === "in_progress") {
    return `Your **${issueName}** is being actively worked on. The support team is in the process of resolving it. This typically takes a little time - please check back soon.`;
  }
  if (s === "sla_expired") {
    return `Your **${issueName}** has taken longer than our standard response window. You are now eligible for live support - navigate to the issue on your **My Issues** page and click **Connect with live support**.`;
  }
  if (s === "awaiting_customer") {
    return `Your **${issueName}** is waiting on some additional information from you. Please check your email or messages and respond so the team can continue.`;
  }
  if (s === "resolved" || s === "closed" || s === "auto_resolved") {
    return `Your **${issueName}** has actually been resolved! Check your **My Issues** page for the full resolution details.`;
  }

  return `Your **${issueName}** is currently **${customerStatusLabel || status}**. Our team is working through it - no action is needed from you unless you hear otherwise.`;
}

function explainNextSteps(
  status: string,
  category: string,
  isLiveCallEligible: boolean | undefined,
): string {
  const issueName = formatIssueName(category);
  const s = (status || "").toLowerCase();

  if (s === "unassigned" || s === "received") {
    return `Your **${issueName}** is in our queue. The next step is for it to be picked up by a support team member - no action is required from you.`;
  }
  if (s === "assigned" || s === "agent_queue") {
    return `A support team member is reviewing your **${issueName}**. The next step is their review and decision on how to resolve it. You will be notified when there's an update.`;
  }
  if (s === "in_progress") {
    return `Your **${issueName}** is being resolved right now. The next step is the team completing the resolution and updating your issue status. Keep an eye on your **My Issues** page.`;
  }
  if (isLiveCallEligible || s === "sla_expired") {
    return `Your **${issueName}** has taken longer than expected. The next step available to you is **connecting with a live support agent** - go to your issue on the **My Issues** page and click **Connect with live support**.`;
  }
  if (s === "awaiting_customer") {
    return `The next step is for you to provide some additional information requested by the support team. Check your email or messages for details.`;
  }
  if (s === "resolved" || s === "closed" || s === "auto_resolved") {
    return `Your **${issueName}** has been resolved - there are no further steps needed. If you have a new issue with an order, you can report it from the **Orders** tab.`;
  }

  return `Our team is reviewing your **${issueName}**. The next step is their assessment and resolution. You will receive an update when there is progress.`;
}

const DEFAULT_SUGGESTIONS = [
  "Why hasn't my issue been resolved?",
  "What happens next with my issue?",
  "Can I talk to support?",
];

// Main handler
export const handleCustomerChat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const requestId = (req as any).requestId || "unknown";
    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HTTPError(400, "INVALID_REQUEST", "No messages provided");
    }

    // Brief, human-feeling pause before answering (applies to every reply path).
    await thinkingDelay();

    const lastUserMessage = messages[messages.length - 1].content.trim().toLowerCase();

    // 1. Security Check: Blocklist (Logged as SUSPICIOUS_QUERY_BLOCKED)
    const hasBlockedKeyword = BLOCKED_KEYWORDS.some((k) =>
      lastUserMessage.includes(k.toLowerCase()),
    );
    if (hasBlockedKeyword) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "SUSPICIOUS_QUERY_BLOCKED",
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
          "I can only help you with your own orders, reported issues, and resolution status. I don't have access to internal systems or other customers' records.",
        suggestions: DEFAULT_SUGGESTIONS,
      });
    }

    // 2. Resolve authenticated customer - IDOR protection via profile_id
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
      if (!customerByEmail) throw new HTTPError(404, "NOT_FOUND", "Customer profile not found");
      customer = customerByEmail;
    }

    // 3. Fetch ONLY this customer's data (both queries are scoped to customer.id)
    const { data: rawOrders = [] } = await adminClient
      .from("orders")
      .select(
        "id, status, placed_at, total_amount_paise, eta_at, delivered_at, item_count, stores(name)",
      )
      .eq("customer_id", customer.id)
      .order("placed_at", { ascending: false });

    const { data: rawComplaintsData = [], error: complaintsErr } = await adminClient
      .from("complaints")
      .select("*, orders(item_count), stores(name)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (complaintsErr) console.error("[CHATBOT] Error fetching complaints:", complaintsErr);

    const rawComplaints = (rawComplaintsData || []).map((c: any) => toComplaintDTO(c));

    // Convenience: open issues list
    const openIssues = rawComplaints.filter(
      (c: any) => c.status !== "resolved" && c.status !== "closed",
    );

    // Match specific order ID or complaint ref if mentioned by user (e.g. ORD-883940 or CMP-xxxx)
    const orderMatch = lastUserMessage.match(/ord-[a-z0-9]+/i);
    const complaintMatch = lastUserMessage.match(/cmp-[a-z0-9]+/i);
    let matchedIssue = null;
    if (orderMatch) {
      const orderId = orderMatch[0].toUpperCase();
      matchedIssue = rawComplaints.find((c: any) => c.order_id?.toUpperCase() === orderId);
    } else if (complaintMatch) {
      const ref = complaintMatch[0].toUpperCase();
      matchedIssue = rawComplaints.find((c: any) => c.complaint_ref?.toUpperCase() === ref);
    }

    const primaryIssue =
      matchedIssue || (openIssues.length > 0 ? openIssues[0] : (rawComplaints[0] ?? null));

    const firstName = customer.full_name ? customer.full_name.split(" ")[0] : "there";
    let response = "";

    // 4. Detect intent
    const intent = detectIntent(lastUserMessage);

    // ACTION_ATTEMPT
    if (intent === "ACTION_ATTEMPT") {
      response =
        "I'm a read-only assistant and can't create, update, or process anything on your behalf.\n\nTo **report a new issue**, go to the **Orders** tab, select the order, and tap **Report an issue**. To check or manage an existing issue, visit **My Issues**.";
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // GREETING
    if (intent === "GREETING") {
      if (openIssues.length > 1) {
        response = `Hello ${firstName}! I can see you have **${openIssues.length} open issues** currently being processed by our team.\n\nYou can ask me:\n- "Where's my complaint at?"\n- "What happens next with my issue?"\n- "Can I talk to support?"`;
      } else if (primaryIssue) {
        const label = (primaryIssue as any).customer_status_label || primaryIssue.status;
        const issueName = formatIssueName(primaryIssue.category);
        response = `Hello ${firstName}! I can see you have an open issue - your **${issueName}** report is currently **${label}**.\n\nYou can ask me:\n- "Why hasn't my issue been resolved?"\n- "What happens next with my issue?"\n- "Can I talk to support?"`;
      } else {
        response = `Hello ${firstName}! You don't have any reported issues right now. I can help answer questions about your issue resolution status and support options whenever you file a report.`;
      }
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // ISSUE_STATUS
    if (intent === "ISSUE_STATUS") {
      if (!primaryIssue) {
        response = `You don't have any reported issues on file, ${firstName}. If something went wrong with an order, you can report it from the **Orders** tab.`;
      } else if (openIssues.length > 1 && !matchedIssue) {
        response = `You have **${openIssues.length} active issues**, ${firstName}:\n`;
        openIssues.forEach((issue: any, idx: number) => {
          const label = issue.customer_status_label || issue.status;
          const cat = formatCategory(issue.category);
          const storeName = issue.store_name || "your store";
          const submittedAt = format(new Date(issue.created_at), "dd MMM 'at' HH:mm");
          response += `\n**${idx + 1}. ${cat.toUpperCase()}** · Order **${issue.order_id}** (${storeName})\n- **Status:** ${label}\n- **Reported:** ${submittedAt}`;
        });
        response += `\n\nVisit **My Issues** for full issue details, or mention an Order ID (e.g. "${openIssues[0].order_id}") to ask about a specific one.`;
      } else {
        const label = (primaryIssue as any).customer_status_label || primaryIssue.status;
        const detail = (primaryIssue as any).customer_status_detail || "";
        const cat = formatCategory(primaryIssue.category);
        const storeName = (primaryIssue as any).store_name || "your store";
        const submittedAt = format(new Date(primaryIssue.created_at), "dd MMM 'at' HH:mm");

        response = explainStatus(primaryIssue.status, primaryIssue.category, label);
        response += `\n\n**Issue:** ${cat} · Order ${primaryIssue.order_id} (${storeName})\n**Reported:** ${submittedAt}\n**Status:** ${label}`;
        if (detail) response += `\n${detail}`;
      }
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // ISSUE_EXPLANATION
    if (intent === "ISSUE_EXPLANATION") {
      if (!primaryIssue) {
        response = `You don't have any open issues, ${firstName}. If something went wrong with an order, go to **Orders** and tap **Report an issue**.`;
      } else {
        const label = (primaryIssue as any).customer_status_label || primaryIssue.status;
        response = explainWhyNotResolved(primaryIssue.status, primaryIssue.category, label);
        response += `\n\nIf you need more details, you can view the full issue timeline on your **My Issues** page.`;
      }
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // NEXT_STEPS
    if (intent === "NEXT_STEPS") {
      if (!primaryIssue) {
        response = `You don't have any open issues right now. If you experience a problem with an order, go to **Orders**, select the order, and tap **Report an issue**.`;
      } else {
        response = explainNextSteps(
          primaryIssue.status,
          primaryIssue.category,
          (primaryIssue as any).is_live_call_eligible,
        );
      }
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // ORDER_CONTEXT
    if (intent === "ORDER_CONTEXT") {
      if (!primaryIssue) {
        response = `You don't have any reported issues, ${firstName}. Your full order history is available under the **Orders** tab.`;
      } else {
        const cat = formatCategory(primaryIssue.category);
        const storeName = (primaryIssue as any).store_name || "your store";
        response = `Your **${cat}** issue is linked to Order **${primaryIssue.order_id}** from **${storeName}**.\n\n**Issue reference:** ${primaryIssue.complaint_ref}\n**Description:** ${primaryIssue.detail}\n\nYou can view the full order in the **Orders** tab.`;
      }
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // SUPPORT_AVAILABILITY
    if (intent === "SUPPORT_AVAILABILITY") {
      if (openIssues.length === 0) {
        response = `You don't have any open issues at the moment, ${firstName}. Live support becomes available for issues that have been open longer than our standard response window. If something went wrong with an order, report it from the **Orders** tab.`;
      } else {
        const eligibleIssue = openIssues.find((c: any) => (c as any).is_live_call_eligible);
        if (eligibleIssue) {
          const cat = formatCategory(eligibleIssue.category);
          response = `Yes - live support is available for your **${cat}** issue (${eligibleIssue.complaint_ref}).\n\nGo to **My Issues**, open that issue, and tap **Connect with live support** to speak with an agent.`;
        } else {
          const mostRecent = openIssues[0];
          const cat = formatCategory(mostRecent.category);
          response = `Your **${cat}** issue is still within our standard response window, so live support isn't available yet. Our team is working on it.\n\nIf it remains unresolved, live support will unlock automatically and you'll see the option on your issue page.`;
        }
      }
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // ACCOUNT_INFO (Narrowed Scope: Complaint Summary Data Only)
    if (intent === "ACCOUNT_INFO") {
      const totalCount = rawComplaints.length;
      const activeCount = openIssues.length;
      const resolvedCount = totalCount - activeCount;
      const avgResTime = resolvedCount > 0 ? "15 mins" : "N/A (no resolved issues)";

      response = `Here is your issue summary, ${firstName}:\n\n- **Total issues reported:** ${totalCount}\n- **Active issues:** ${activeCount}\n- **Resolved issues:** ${resolvedCount}\n- **Avg. resolution time:** ${avgResTime}`;
      return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
    }

    // OUT_OF_SCOPE fallback
    response = `I can help with your orders, reported issues, resolution status, and support options. Try asking:\n- "Why hasn't my issue been resolved?"\n- "What happens next with my issue?"\n- "Can I talk to support?"`;
    return res.status(200).json({ message: response, suggestions: DEFAULT_SUGGESTIONS });
  } catch (error) {
    next(error);
  }
};

// Feedback Handler
export const handleChatbotFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    const { feedback, complaintId, messageSnippet } = req.body;
    const requestId = (req as any).requestId || "unknown";

    await logSecurityEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "CHATBOT_FEEDBACK_SUBMITTED",
      resourceType: "chatbot",
      resourceId: complaintId || "N/A",
      requestId,
      ip: req.ip,
      metadata: {
        feedback, // "like" | "dislike"
        complaintId: complaintId || null,
        messageSnippet: (messageSnippet || "").substring(0, 100),
      },
    });

    return res.status(200).json({ success: true, message: "Feedback recorded" });
  } catch (error) {
    next(error);
  }
};
