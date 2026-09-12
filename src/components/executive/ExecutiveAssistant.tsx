import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { Loader2, Send, Sparkles, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
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

const suggestedQuestions = [
  "What is happening across the network?",
  "Which stores have the most complaints?",
  "Are complaints increasing?",
  "How effective is automation?",
  "Where are SLA breaches happening?",
  "Are there any fraud risks?",
];

export function ExecutiveAssistant({ dashboardContext }: ExecutiveAssistantProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
    <Panel className="overflow-hidden">
      <PanelHeader
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Ask DarkOps
          </div>
        }
        subtitle="Executive Operational Copilot - Ask about your network operations"
      />
      
      <div className="flex h-[500px] flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Sparkles className="mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Ask about your network operations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                I can analyze complaints, stores, SLA performance, automation, trends, and risk signals
              </p>
              
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestedQuestions.slice(0, 3).map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-3"
                  >
                    {question}
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
                    "rounded-md p-3",
                    message.role === "user"
                      ? "ml-12 bg-primary/10 border border-primary/20"
                      : "mr-12 bg-surface-2 border border-border",
                  )}
                >
                  {message.role === "user" ? (
                    <p className="text-sm text-foreground">{message.content}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="whitespace-pre-line text-sm text-foreground">
                        {message.content}
                      </div>
                      
                      {message.response && (
                        <>
                          {/* Metrics */}
                          {message.response.metrics.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                              {message.response.metrics.map((metric, idx) => (
                                <div key={idx} className="text-xs">
                                  <p className="text-muted-foreground">{metric.label}</p>
                                  <p className={cn("num font-semibold", toneColors[metric.tone || "neutral"])}>
                                    {metric.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Evidence */}
                          {message.response.evidence.length > 0 && (
                            <div className="rounded-sm bg-surface-3/50 p-2 border border-border/50">
                              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                Based on
                              </p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {message.response.evidence.map((evidence, idx) => (
                                  <div key={idx}>
                                    <span className="text-muted-foreground">{evidence.label}:</span>{" "}
                                    <span className="num text-foreground">{evidence.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Suggested Questions */}
                          {message.response.suggestedQuestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {message.response.suggestedQuestions.slice(0, 3).map((question, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSuggestedQuestion(question)}
                                  className="flex items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                                >
                                  {question}
                                  <ChevronRight className="size-3" />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Drill Down */}
                          {message.response.drillDown && (
                            <div className="pt-2">
                              {message.response.drillDown.params ? (
                                <Link
                                  to={message.response.drillDown.route}
                                  params={message.response.drillDown.params}
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                >
                                  {message.response.drillDown.label}
                                  <ChevronRight className="size-3" />
                                </Link>
                              ) : (
                                <Link
                                  to={message.response.drillDown.route}
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                >
                                  {message.response.drillDown.label}
                                  <ChevronRight className="size-3" />
                                </Link>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {message.isError && message.failedQuestion && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuggestedQuestion(message.failedQuestion!)}
                            className="h-7 gap-1.5 text-xs"
                          >
                            <RefreshCw className="size-3" />
                            Retry query
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="mr-12 flex items-center gap-2 rounded-md bg-surface-2 border border-border p-3">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Analyzing network data...</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your network operations..."
              className="flex-1 rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Ask
            </Button>
          </form>
          
          {messages.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="rounded-sm border border-border/50 bg-surface-1 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-surface-2 hover:text-foreground"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
