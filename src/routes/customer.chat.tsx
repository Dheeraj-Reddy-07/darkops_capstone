import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Bot,
  ArrowUp,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreHorizontal,
  Share2,
  Sparkles,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer/chat")({
  head: () => ({
    meta: [
      { title: "AI Assistant - DarkOps Care" },
      {
        name: "description",
        content: "Get instant help with your orders and complaints using our AI assistant.",
      },
    ],
  }),
  component: Chatbot,
});

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function renderFormattedText(text: string, isTyping?: boolean) {
  let cleanText = text;
  if (isTyping) {
    cleanText = cleanText.replace(/\*{1,3}$/, "");
  }

  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = cleanText.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
      return (
        <strong key={i} className="font-semibold italic text-foreground">
          {part.slice(3, -3)}
        </strong>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic text-foreground/90 font-medium">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    let displayPart = part;
    if (isTyping) {
      displayPart = displayPart.replace(/\*\*/g, "").replace(/\*/g, "");
    }

    return <span key={i}>{displayPart}</span>;
  });
}

function FormattedChatMessage({ content, isTyping }: { content: string; isTyping?: boolean }) {
  const lines = content.split("\n");

  return (
    <div className="text-sm leading-relaxed space-y-2 text-foreground font-normal">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
          const bulletText = trimmed.replace(/^([-*]|\d+\.)\s+/, "");
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1 my-1">
              <span className="size-1.5 rounded-full bg-primary/70 mt-2 shrink-0" />
              <span className="flex-1">{renderFormattedText(bulletText, isTyping)}</span>
            </div>
          );
        }
        if (!trimmed) {
          return <div key={lineIdx} className="h-1" />;
        }
        return <p key={lineIdx}>{renderFormattedText(line, isTyping)}</p>;
      })}
      {isTyping && (
        <span className="inline-block size-2 rounded-full bg-primary animate-ping ml-1 align-middle" />
      )}
    </div>
  );
}

function AssistantMessageBlock({
  content,
  isTyping,
  onRegenerate,
}: {
  content: string;
  isTyping?: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedbackClick = async (type: "like" | "dislike") => {
    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback);
    if (newFeedback) {
      try {
        await fetchApi("/customers/me/chat/feedback", {
          method: "POST",
          body: JSON.stringify({
            feedback: newFeedback,
            messageSnippet: content.substring(0, 100),
          }),
        });
      } catch (err) {
        console.error("Failed to submit feedback:", err);
      }
    }
  };

  return (
    <div className="space-y-3 py-0.5">
      <FormattedChatMessage content={content} isTyping={isTyping} />
      {!isTyping && content && (
        <div className="flex items-center gap-1.5 pt-1 text-muted-foreground/60">
          <button
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-white/5 hover:text-foreground transition-colors"
            title="Copy message"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          </button>
          <button
            onClick={() => handleFeedbackClick("like")}
            className={cn(
              "p-1 rounded-md hover:bg-white/5 hover:text-foreground transition-colors",
              feedback === "like" && "text-emerald-400 bg-white/10",
            )}
            title="Helpful"
          >
            <ThumbsUp className="size-3.5" />
          </button>
          <button
            onClick={() => handleFeedbackClick("dislike")}
            className={cn(
              "p-1 rounded-md hover:bg-white/5 hover:text-foreground transition-colors",
              feedback === "dislike" && "text-rose-400 bg-white/10",
            )}
            title="Not helpful"
          >
            <ThumbsDown className="size-3.5" />
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded-md hover:bg-white/5 hover:text-foreground transition-colors"
              title="Refresh latest status"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi there! I'm your DarkOps Care Assistant. I can help answer questions about your reported issues, SLA timelines, complaint statuses, or resolution procedures. How can I assist with your order issue today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Why hasn't my issue been resolved?",
    "What happens next with my complaint?",
    "Can I talk to live support?",
  ]);
  const [userAskedQueries, setUserAskedQueries] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const typeOutMessage = (fullText: string, onComplete?: () => void) => {
    const newMsg: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMsg]);

    let currentIndex = 0;
    const chunkSize = 3;
    const intervalMs = 18;

    const timer = setInterval(() => {
      currentIndex += chunkSize;
      if (currentIndex >= fullText.length) {
        currentIndex = fullText.length;
        clearInterval(timer);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: fullText,
          };
          return updated;
        });
        onComplete?.();
      } else {
        const textChunk = fullText.slice(0, currentIndex);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: textChunk,
          };
          return updated;
        });
      }
    }, intervalMs);
  };

  const handleSend = async (messageOverride?: string) => {
    const messageContent = messageOverride ?? input.trim();
    if (!messageContent || isLoading || isTyping) return;

    const userMessage: Message = {
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setUserAskedQueries((prev) => [...prev, messageContent]);
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const [response] = await Promise.all([
        fetchApi("/customers/me/chat", {
          method: "POST",
          body: JSON.stringify({ messages: [...messages, userMessage] }),
        }),
        new Promise((res) => setTimeout(res, 900)),
      ]);

      setIsLoading(false);
      setIsTyping(true);

      typeOutMessage(response.message, () => {
        setIsTyping(false);
        if (response.suggestions) {
          setSuggestions(response.suggestions);
        }
      });
    } catch {
      setIsLoading(false);
      setIsTyping(false);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRegenerateLast = () => {
    if (messages.length < 2 || isLoading || isTyping) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      handleSend(lastUserMsg.content);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) => !userAskedQueries.some((asked) => asked.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-foreground overflow-hidden relative">
      {/* Minimal Top Header */}
      <div className="px-6 py-3 flex items-center justify-between shrink-0 bg-[#0d0d0d] text-xs text-muted-foreground border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-sm tracking-tight">DarkOps Assistant</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
            Online
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 py-8"
      >
        <div className="mx-auto max-w-[760px] w-full min-h-full flex flex-col justify-end space-y-6">
          {messages.map((message, index) => {
            const isLatestAssistant =
              isTyping && index === messages.length - 1 && message.role === "assistant";
            return (
              <div key={index} className="w-full">
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-[#2f2f2f] text-foreground text-sm px-4 py-2.5 rounded-3xl max-w-[70%] leading-relaxed shadow-sm">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 w-full max-w-[90%] sm:max-w-[85%]">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5">
                      <Bot className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <AssistantMessageBlock
                        content={message.content}
                        isTyping={isLatestAssistant}
                        onRegenerate={
                          index === messages.length - 1 ? handleRegenerateLast : undefined
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator dots with Assistant Bot Logo */}
          {isLoading && (
            <div className="flex items-start gap-3 py-1">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5">
                <Bot className="size-3.5" />
              </div>
              <div className="flex items-center gap-1.5 py-2">
                <span className="size-2 rounded-full bg-white/70 animate-bounce [animation-delay:-0.32s]" />
                <span className="size-2 rounded-full bg-white/70 animate-bounce [animation-delay:-0.16s]" />
                <span className="size-2 rounded-full bg-white/70 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      {!isLoading && !isTyping && filteredSuggestions.length > 0 && (
        <div className="px-4 py-2 shrink-0 bg-[#0d0d0d]">
          <div className="mx-auto max-w-[760px] w-full">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestion(suggestion)}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-white/10 bg-[#212121] hover:bg-[#2f2f2f] hover:border-white/20 px-3.5 py-1.5 text-xs text-foreground/90 transition-all cursor-pointer select-none active:scale-95 shadow-2xs"
                >
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clean Floating Pill Input Bar */}
      <div className="px-4 pb-5 pt-2 shrink-0 bg-[#0d0d0d]">
        <div className="mx-auto max-w-[760px] w-full space-y-2">
          <div className="relative flex items-center gap-2.5 rounded-full bg-[#212121] border border-white/10 px-4 py-2.5 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/20 transition-all shadow-md">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your reported issues, SLA status, or complaint resolution..."
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[24px] max-h-[120px] py-0.5 px-1 leading-relaxed custom-scrollbar"
              rows={1}
              disabled={isLoading || isTyping}
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading || isTyping}
              className={cn(
                "size-8 rounded-full flex items-center justify-center transition-all shrink-0",
                input.trim() && !isLoading && !isTyping
                  ? "bg-white text-black hover:opacity-90 cursor-pointer shadow-sm"
                  : "bg-white/10 text-white/30 cursor-not-allowed",
              )}
            >
              <ArrowUp className="size-4 stroke-[2.5]" />
            </button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/60 font-normal">
            DarkOps Assistant provides automated resolution guidance for customer issue tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
