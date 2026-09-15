import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import {
  Loader2,
  Send,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  RefreshCw,
  Activity,
  AlertOctagon,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Store,
  Clock,
  Zap,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Sliders,
  MapPin,
  HelpCircle,
  Compass,
  Radio,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

interface AssistantResponse {
  intent: string;
  answer: string;
  summary: string;
  metrics: Array<{ label: string; value: string; tone?: "ok" | "warn" | "crit" | "neutral" }>;
  evidence: Array<{ label: string; value: string }>;
  suggestedQuestions: string[];
  drillDown?: { label: string; route: string; params?: Record<string, string> };
  context?: any;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  response?: AssistantResponse;
  context?: any;
  isError?: boolean;
  failedQuestion?: string;
}

interface ExecutiveAssistantProps {
  dashboardContext?: {
    timeFilter?: string;
  };
}

const toneColors: Record<string, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  neutral: "text-foreground",
};

const toneBorderColors: Record<string, string> = {
  ok: "border-ok/30 bg-ok/5",
  warn: "border-warn/30 bg-warn/5",
  crit: "border-crit/30 bg-crit/5",
  neutral: "border-border/40 bg-surface-3/40",
};

const intentConfig: Record<string, { label: string; icon: any; badgeClass: string }> = {
  NETWORK_SUMMARY: {
    label: "Network Intelligence",
    icon: Activity,
    badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  PULSE_OVERVIEW: {
    label: "Fleet Pulse Health",
    icon: Zap,
    badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  CRITICAL_BOTTLENECKS: {
    label: "Critical Bottlenecks",
    icon: AlertOctagon,
    badgeClass: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  EXECUTIVE_METRICS: {
    label: "Executive Snapshot",
    icon: BarChart3,
    badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  COMPLAINT_TRENDS: {
    label: "Complaint Trends",
    icon: TrendingUp,
    badgeClass: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  COMPLAINT_CATEGORIES: {
    label: "Complaint Drivers",
    icon: Sliders,
    badgeClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  STORE_PERFORMANCE: {
    label: "Store Rankings",
    icon: Store,
    badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  STORE_DETAIL: {
    label: "Dark Store Profile",
    icon: Store,
    badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  STORE_ROOT_CAUSE: {
    label: "Root Cause Diagnosis",
    icon: AlertCircle,
    badgeClass: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  STORE_COMPARISON: {
    label: "Period Comparison",
    icon: TrendingUp,
    badgeClass: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  STORE_RECOMMENDATION: {
    label: "Actionable Store Plan",
    icon: CheckCircle2,
    badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  CITY_PERFORMANCE: {
    label: "Regional Operations",
    icon: MapPin,
    badgeClass: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  CITY_COMPARISON: {
    label: "City-to-City Comparison",
    icon: MapPin,
    badgeClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  SLA_PERFORMANCE: {
    label: "SLA Tracking & Compliance",
    icon: Clock,
    badgeClass: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  AUTOMATION_PERFORMANCE: {
    label: "Automation & Resolution",
    icon: Sparkles,
    badgeClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  RISK_SUMMARY: {
    label: "Fraud & Risk Exposure",
    icon: ShieldAlert,
    badgeClass: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  ANOMALIES_ALERTS: {
    label: "Hardware Red Alerts",
    icon: AlertOctagon,
    badgeClass: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  PERIOD_COMPARISON: {
    label: "Comparative Performance",
    icon: TrendingUp,
    badgeClass: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  GENERAL_DARKOPS_KNOWLEDGE: {
    label: "Platform Architecture",
    icon: Sparkles,
    badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  HELP: {
    label: "Executive Copilot Capabilities",
    icon: HelpCircle,
    badgeClass: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  UNSUPPORTED: {
    label: "DarkOps Guidance",
    icon: Compass,
    badgeClass: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  },
};

const defaultSuggested = [
  "What is happening across the network?",
  "What is our pulse score?",
  "What is going wrong?",
  "Which stores have the most complaints?",
  "Where are SLA breaches happening?",
  "How effective is automation?",
];

/**
 * Parses bold **text** and backticks `code` into formatted React elements
 */
function parseInline(text: string) {
  const parts: (string | React.ReactNode)[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px] text-primary"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Rich executive message formatter
 */
function FormattedMessageContent({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <div className="space-y-2 text-xs sm:text-sm">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }

        // 1. Heading (### Title or lines ending with :)
        if (line.startsWith("### ")) {
          return (
            <div
              key={idx}
              className="pt-1 pb-0.5 font-semibold text-foreground text-sm tracking-tight border-b border-border/30 mb-1.5"
            >
              {line.replace(/^###\s*/, "")}
            </div>
          );
        }

        // 2. Executive Synthesis / Takeaway Callout Card
        if (
          line.startsWith("> **Executive Synthesis:**") ||
          line.startsWith("**Executive Synthesis:**") ||
          line.startsWith("**Executive Takeaway:**") ||
          line.startsWith("**Root Cause:**")
        ) {
          const cleanText = line
            .replace(/^>\s*/, "")
            .replace(/^\*\*Executive (Synthesis|Takeaway):\*\*\s*/, "")
            .replace(/^\*\*Root Cause:\*\*\s*/, "");
          return (
            <div
              key={idx}
              className="my-2 rounded-md border border-primary/25 bg-primary/5 p-2.5 sm:p-3 text-foreground"
            >
              <div className="flex items-center gap-1.5 font-medium text-primary text-[11px] uppercase tracking-wider mb-1">
                <Lightbulb className="size-3.5 shrink-0" />
                Executive Synthesis
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                {parseInline(cleanText)}
              </p>
            </div>
          );
        }

        // 3. Recommended Action Callout Card
        if (
          line.startsWith("**Recommended Action:**") ||
          line.startsWith("**Recommended Actions:**") ||
          line.startsWith("**Next Steps:**") ||
          line.startsWith("**Immediate Recommendation:**")
        ) {
          const cleanText = line
            .replace(/^\*\*Recommended Actions?:\*\*\s*/, "")
            .replace(/^\*\*Next Steps:\*\*\s*/, "")
            .replace(/^\*\*Immediate Recommendation:\*\*\s*/, "");
          return (
            <div
              key={idx}
              className="my-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2.5 sm:p-3 text-foreground"
            >
              <div className="flex items-center gap-1.5 font-medium text-emerald-400 text-[11px] uppercase tracking-wider mb-1">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Recommended Operational Action
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                {parseInline(cleanText)}
              </p>
            </div>
          );
        }

        // 4. Numbered Action / Exception Items (e.g. "1. Item", "2. Item")
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) {
          const num = numberedMatch[1];
          const text = numberedMatch[2];
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-md border border-border/40 bg-surface-3/30 p-2 my-1"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                {num}
              </span>
              <div className="flex-1 text-xs sm:text-sm leading-relaxed text-foreground/90">
                {parseInline(text)}
              </div>
            </div>
          );
        }

        // 5. Bullet list items (e.g. "• Item" or "- Item")
        if (line.startsWith("• ") || line.startsWith("- ")) {
          const text = line.slice(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="size-1.5 rounded-full bg-primary/70 mt-1.5 shrink-0" />
              <div className="flex-1 leading-relaxed text-foreground/90">{parseInline(text)}</div>
            </div>
          );
        }

        // 6. Section header lines ending with a colon
        if (line.endsWith(":") && line.length < 80 && !line.includes("•")) {
          return (
            <div key={idx} className="pt-1 font-semibold text-foreground tracking-tight">
              {parseInline(line)}
            </div>
          );
        }

        // 7. Standard narrative paragraph
        return (
          <p key={idx} className="leading-relaxed text-foreground/90">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}

export function ExecutiveAssistant({ dashboardContext }: ExecutiveAssistantProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const mutation = useMutation({
    mutationFn: async ({
      question,
      context,
      dashboardContext: localDashboardContext,
    }: {
      question: string;
      context?: any;
      dashboardContext?: { timeFilter?: string };
    }) => {
      const response = await fetchApi("/executive/assistant/query", {
        method: "POST",
        body: JSON.stringify({
          question,
          context,
          dashboardContext: localDashboardContext || dashboardContext,
        }),
      });
      return response as AssistantResponse;
    },
    onSuccess: (response, variables) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
          response,
          context: response.context || variables.context,
        },
      ]);
      setIsLoading(false);
    },
    onError: (_err, variables) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I couldn't retrieve the operational data right now. Please try again.",
          response: undefined,
          isError: true,
          failedQuestion: variables.question,
        },
      ]);
      setIsLoading(false);
    },
  });

  const getLatestContext = () => {
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
    return lastAssistantMessage?.response?.context || lastAssistantMessage?.context || undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    const context = getLatestContext();
    mutation.mutate({ question: userMessage, context, dashboardContext });
  };

  const handleSuggestedQuestion = (question: string) => {
    const userMessage = question.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    const context = getLatestContext();
    mutation.mutate({ question: userMessage, context, dashboardContext });
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="w-[92vw] sm:w-[420px] h-[560px] max-h-[82vh] rounded-xl border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 bg-surface-1/90 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                    Executive Copilot
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 shrink-0">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Telemetry
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  Operational intelligence & decision triage
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title="Clear conversation"
                  onClick={() => setMessages([])}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Close Copilot"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-4">
                <div className="relative mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-inner">
                  <Sparkles className="size-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight">
                  Ask Executive Copilot
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Query live ticket queues, SLA compliance, PulseScores, and operational
                  bottlenecks.
                </p>

                <div className="mt-4 flex flex-col gap-1.5 w-full">
                  {defaultSuggested.map((question) => (
                    <button
                      key={question}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="flex items-center justify-between rounded-md border border-border/80 bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary text-left"
                    >
                      <span className="truncate">{question}</span>
                      <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col transition-all",
                      message.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    {message.role === "user" ? (
                      <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-xs sm:text-sm text-primary-foreground shadow-sm">
                        <p className="leading-relaxed">{message.content}</p>
                      </div>
                    ) : (
                      <div className="w-full max-w-[98%] rounded-xl border border-border/80 bg-surface-2/90 p-3 shadow-sm space-y-3">
                        {/* Intent Header Badge */}
                        {message.response &&
                          ![
                            "GREETING",
                            "HOW_ARE_YOU",
                            "THANKS",
                            "ACKNOWLEDGEMENT",
                            "GOODBYE",
                          ].includes(message.response.intent) && (
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              {(() => {
                                const config =
                                  intentConfig[message.response.intent] || intentConfig.UNSUPPORTED;
                                const IconComponent = config.icon;
                                return (
                                  <div
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                      config.badgeClass,
                                    )}
                                  >
                                    <IconComponent className="size-3 shrink-0" />
                                    <span>{config.label}</span>
                                  </div>
                                );
                              })()}

                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Radio className="size-2.5 text-emerald-400" />
                                Live Telemetry
                              </span>
                            </div>
                          )}

                        {/* Main Formatted Answer Content */}
                        <FormattedMessageContent content={message.content} />

                        {message.response && (
                          <>
                            {/* KPI Metrics Ribbon */}
                            {message.response.metrics.length > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {message.response.metrics.map((metric, idx) => (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "rounded-md border p-1.5 flex flex-col justify-between transition-all",
                                      toneBorderColors[metric.tone || "neutral"],
                                    )}
                                  >
                                    <span className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider truncate">
                                      {metric.label}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-xs sm:text-sm font-bold font-mono mt-0.5",
                                        toneColors[metric.tone || "neutral"],
                                      )}
                                    >
                                      {metric.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Data Evidence Pills */}
                            {message.response.evidence.length > 0 && (
                              <div className="rounded-md border border-border/40 bg-surface-3/30 p-2 text-xs">
                                <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  <span>Audit Provenance:</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {message.response.evidence.map((evidence, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded px-1.5 py-0.5 bg-surface-1 border border-border/50 text-[10px] text-muted-foreground"
                                    >
                                      <span className="text-foreground/80 font-medium">
                                        {evidence.label}:
                                      </span>{" "}
                                      <span className="font-mono text-foreground">
                                        {evidence.value}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actionable Follow-up Question Chips */}
                            {message.response.suggestedQuestions.length > 0 && (
                              <div className="pt-1">
                                <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1 uppercase tracking-wider">
                                  <Sparkles className="size-2.5 text-primary" />
                                  Suggested Inquiries:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {message.response.suggestedQuestions.map((question, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleSuggestedQuestion(question)}
                                      className="group flex items-center gap-1 rounded-md border border-border/70 bg-surface-1 px-2 py-0.5 text-[11px] text-foreground/90 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                    >
                                      <span className="truncate">{question}</span>
                                      <ArrowRight className="size-2.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Primary Drill Down Navigation */}
                            {message.response.drillDown && (
                              <div className="pt-1.5 border-t border-border/40">
                                {message.response.drillDown.params ? (
                                  <Link
                                    to={message.response.drillDown.route}
                                    params={message.response.drillDown.params}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/20 shadow-xs"
                                  >
                                    <span>{message.response.drillDown.label}</span>
                                    <ExternalLink className="size-3" />
                                  </Link>
                                ) : (
                                  <Link
                                    to={message.response.drillDown.route}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/20 shadow-xs"
                                  >
                                    <span>{message.response.drillDown.label}</span>
                                    <ExternalLink className="size-3" />
                                  </Link>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {message.isError && message.failedQuestion && (
                          <div className="pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSuggestedQuestion(message.failedQuestion!)}
                              className="h-6 gap-1 text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10 px-2"
                            >
                              <RefreshCw className="size-2.5" />
                              Retry query
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface-2 p-3 max-w-xs">
                    <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Analyzing live database telemetry...
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border/80 bg-surface-1/90 p-2.5 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Executive Copilot..."
                className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className="h-8 gap-1 px-3 text-xs font-medium shadow-xs"
              >
                {isLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
                <span>Ask</span>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-xl transition-all duration-200 active:scale-95",
          isOpen
            ? "border-primary/40 bg-primary text-primary-foreground shadow-primary/20"
            : "border-border/80 bg-surface-1/95 text-foreground hover:border-primary/40 hover:bg-surface-2 hover:text-primary backdrop-blur-md",
        )}
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="size-4" />
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span>Executive Copilot</span>
        {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      </button>
    </div>
  );
}
