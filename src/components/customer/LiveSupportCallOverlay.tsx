import React, { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneCall, PhoneOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallState = "calling" | "connecting" | "connected" | "ended";

interface LiveSupportCallOverlayProps {
  complaintRef: string;
  orderId: string;
  onClose: (status: string) => void;
}

export function LiveSupportCallOverlay({ complaintRef, orderId, onClose }: LiveSupportCallOverlayProps) {
  const [callState, setCallState] = useState<CallState>("calling");
  const [timer, setTimer] = useState(0);
  const [agentMessage, setAgentMessage] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const ringIntervalRef = useRef<any>(null);

  // Play outgoing ringing tone using Web Audio API
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
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);
      osc.connect(gainNode);
      osc.start();
      oscillatorRef.current = osc;

      let isRinging = true;
      const triggerRing = () => {
        if (isRinging) {
          gainNode.gain.setTargetAtTime(0.08, ctx.currentTime, 0.05);
        } else {
          gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        }
        isRinging = !isRinging;
      };

      triggerRing();
      ringIntervalRef.current = setInterval(triggerRing, 1800);
    } catch (err) {
      console.warn("Failed to play ringtone:", err);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
    }
    if (oscillatorRef.current) {
      setTimeout(() => {
        try {
          oscillatorRef.current?.stop();
          oscillatorRef.current?.disconnect();
          audioCtxRef.current?.close();
        } catch (e) {}
      }, 150);
    }
  }, []);

  // Handle calling state: CALLING (3.5s)
  useEffect(() => {
    if (callState !== "calling") return;

    playRingtone();
    const callingTimer = setTimeout(() => {
      stopRingtone();
      setCallState("connecting");
    }, 3500);

    return () => {
      clearTimeout(callingTimer);
      stopRingtone();
    };
  }, [callState, playRingtone, stopRingtone]);

  // Handle connecting state: CONNECTING (1.5s)
  useEffect(() => {
    if (callState !== "connecting") return;

    const connectingTimer = setTimeout(() => {
      setCallState("connected");
    }, 1500);

    return () => {
      clearTimeout(connectingTimer);
    };
  }, [callState]);

  // Handle call timer and agent script only after CONNECTED
  useEffect(() => {
    if (callState !== "connected") return;

    setTimer(0);
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    const msg1 = `"Hello! I am reviewing your issue (${complaintRef}) for order ${orderId}."`;
    const msg2 = `"I have your order details and reported issues right here."`;
    const msg3 = `"Checking the resolution details and authorizing your support update."`;
    const msg4 = `"All set! I've updated your issue record with immediate priority."`;

    setAgentMessage(msg1);
    const s1 = setTimeout(() => setAgentMessage(msg2), 4000);
    const s2 = setTimeout(() => setAgentMessage(msg3), 9000);
    const s3 = setTimeout(() => setAgentMessage(msg4), 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(s1);
      clearTimeout(s2);
      clearTimeout(s3);
    };
  }, [callState, complaintRef, orderId]);

  const handleCancelCall = () => {
    stopRingtone();
    setCallState("ended");
    setTimeout(() => onClose("ended"), 2000);
  };

  const handleEndCall = () => {
    setCallState("ended");
    setTimeout(() => onClose("ended"), 2500);
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
          {callState === "calling" && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-primary mb-2">
                  <PhoneCall className="size-4 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider">DarkOps Care</span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Calling Live Support...</h3>
                <p className="text-xs text-muted-foreground">Connecting issue {complaintRef}</p>
              </div>

              <div className="flex justify-center w-full">
                <Button
                  onClick={handleCancelCall}
                  size="icon"
                  className="size-12 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-md transition-transform active:scale-95"
                  aria-label="Cancel call"
                >
                  <PhoneOff className="size-5" />
                </Button>
              </div>
            </div>
          )}

          {callState === "connecting" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="relative flex size-12 items-center justify-center rounded-full bg-primary/10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-30"></span>
                <User className="size-6 text-primary" />
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
                    <p className="text-xs text-emerald-500 font-medium">Connected • DarkOps Care</p>
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
                className="w-full h-10 rounded-xl shadow-sm"
              >
                <PhoneOff className="mr-2 size-4" /> End Call
              </Button>
            </div>
          )}

          {callState === "ended" && (
            <div className="flex flex-col items-center text-center space-y-2 py-5">
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-2 mb-1">
                <PhoneOff className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium">Call ended</h3>
              {timer > 0 && <p className="text-xs text-muted-foreground">Duration {formatTimer(timer)}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
