import React, { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneCall, PhoneOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CallState = "idle" | "ringing" | "connecting" | "connected" | "ended" | "declined" | "missed";

interface LiveSupportCallOverlayProps {
  complaintRef: string;
  orderId: string;
  onClose: (status: string) => void;
}

export function LiveSupportCallOverlay({ complaintRef, orderId, onClose }: LiveSupportCallOverlayProps) {
  const [callState, setCallState] = useState<CallState>("ringing");
  const [timer, setTimer] = useState(0);
  const [agentMessage, setAgentMessage] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const ringIntervalRef = useRef<any>(null);

  // Play a simple ringing tone using Web Audio API
  const playRingtone = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1); // slightly higher
      osc.connect(gainNode);
      osc.start();
      oscillatorRef.current = osc;

      // Ring pattern: 2 seconds on, 2 seconds off
      let isRinging = true;
      const triggerRing = () => {
        if (isRinging) {
          gainNode.gain.setTargetAtTime(0.1, ctx.currentTime, 0.05);
        } else {
          gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        }
        isRinging = !isRinging;
      };
      
      triggerRing();
      ringIntervalRef.current = setInterval(triggerRing, 2000);
    } catch (err) {
      console.warn("Failed to play ringtone (browser autoplay blocked):", err);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
    }
    if (oscillatorRef.current) {
      setTimeout(() => {
        try {
          oscillatorRef.current?.stop();
          oscillatorRef.current?.disconnect();
          audioCtxRef.current?.close();
        } catch (e) {}
      }, 200);
    }
  }, []);

  // Handle ringing state timeout (missed call)
  useEffect(() => {
    if (callState === "ringing") {
      playRingtone();
      const timeout = setTimeout(() => {
        if (callState === "ringing") {
          stopRingtone();
          setCallState("missed");
          setTimeout(() => onClose("missed"), 3000);
        }
      }, 15000); // 15 seconds to answer
      return () => {
        clearTimeout(timeout);
        stopRingtone();
      };
    }
  }, [callState, playRingtone, stopRingtone, onClose]);

  // Handle call timer and agent script
  useEffect(() => {
    if (callState === "connected") {
      const interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);

      // Rotating mock agent script
      const script = [
        `"Hello! I am reviewing your complaint (${complaintRef}) for order ${orderId}."`,
        `"I have the order details and your case history in front of me."`,
        `"I am checking the next resolution step for you now."`,
        `"I'll have this sorted out for you right away."`
      ];

      setAgentMessage(script[0]);
      const s1 = setTimeout(() => setAgentMessage(script[1]), 5000);
      const s2 = setTimeout(() => setAgentMessage(script[2]), 12000);
      const s3 = setTimeout(() => setAgentMessage(script[3]), 20000);

      return () => {
        clearInterval(interval);
        clearTimeout(s1);
        clearTimeout(s2);
        clearTimeout(s3);
      };
    }
  }, [callState, complaintRef, orderId]);

  const handleAccept = () => {
    stopRingtone();
    setCallState("connecting");
    setTimeout(() => {
      setCallState("connected");
    }, 1500); // 1.5s simulated connection delay
  };

  const handleDecline = () => {
    stopRingtone();
    setCallState("declined");
    setTimeout(() => onClose("declined"), 2000);
  };

  const handleEndCall = () => {
    setCallState("ended");
    setTimeout(() => onClose("ended"), 3000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed left-0 right-0 top-4 z-50 mx-auto w-[90%] max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="p-4 sm:p-5">
          {callState === "ringing" && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-emerald-500 mb-2">
                  <PhoneCall className="size-4 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider">DarkOps Support</span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Incoming support call</h3>
                <p className="text-sm text-muted-foreground">Senior Support Agent</p>
              </div>

              <div className="flex items-center justify-center gap-8 w-full px-4">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    onClick={handleDecline}
                    size="icon"
                    className="size-14 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 transition-transform active:scale-95"
                    aria-label="Decline call"
                  >
                    <PhoneOff className="size-6" />
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">Decline</span>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                  <Button
                    onClick={handleAccept}
                    size="icon"
                    className="size-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 animate-bounce"
                    aria-label="Accept call"
                  >
                    <Phone className="size-6" />
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">Accept</span>
                </div>
              </div>
            </div>
          )}

          {callState === "connecting" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="relative flex size-12 items-center justify-center rounded-full bg-surface-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-30"></span>
                <User className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Connecting to Senior Support Agent...</p>
                <p className="text-xs text-muted-foreground mt-1">Establishing secure connection</p>
              </div>
            </div>
          )}

          {callState === "connected" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                    <Phone className="size-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Senior Support Agent</h3>
                    <p className="text-xs text-emerald-500 font-medium">Connected • DarkOps Support</p>
                  </div>
                </div>
                <div className="num text-sm font-mono tabular-nums text-foreground/80 bg-surface-2 px-2 py-1 rounded-md">
                  {formatTimer(timer)}
                </div>
              </div>

              <div className="rounded-lg bg-surface-2 p-3 border border-border/50">
                <p className="text-sm italic text-foreground/90 transition-opacity duration-300">
                  {agentMessage}
                </p>
              </div>

              <Button 
                onClick={handleEndCall} 
                variant="destructive" 
                className="w-full h-11 rounded-xl shadow-sm"
              >
                <PhoneOff className="mr-2 size-4" /> End Call
              </Button>
            </div>
          )}

          {callState === "ended" && (
            <div className="flex flex-col items-center text-center space-y-2 py-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 mb-2">
                <PhoneOff className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Call ended</h3>
              <p className="text-sm text-muted-foreground">Duration {formatTimer(timer)}</p>
            </div>
          )}

          {callState === "declined" && (
            <div className="flex flex-col items-center text-center space-y-2 py-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                <PhoneOff className="size-5 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-destructive">Call declined</h3>
            </div>
          )}

          {callState === "missed" && (
            <div className="flex flex-col items-center text-center space-y-2 py-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 mb-2">
                <PhoneOff className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Support call missed</h3>
              <p className="text-sm text-muted-foreground">We'll try to reach you again later.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
