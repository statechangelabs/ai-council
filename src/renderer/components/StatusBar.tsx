import React from "react";
import { cn } from "../lib/utils";

interface StatusBarProps {
  round?: number;
  totalRounds?: number;
  speaker?: string;
  tokenUsage?: { input: number; output: number };
  isRunning: boolean;
}

export function StatusBar({ round, totalRounds, speaker, tokenUsage, isRunning }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t bg-card text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", isRunning ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30")} />
      {isRunning ? (
        <>
          {round != null && totalRounds != null && (
            <span>Round {round}/{totalRounds}</span>
          )}
          {speaker && (
            <span className="text-foreground font-medium">{speaker}</span>
          )}
        </>
      ) : (
        <span>Ready</span>
      )}
      {tokenUsage && (tokenUsage.input > 0 || tokenUsage.output > 0) && (
        <span className="ml-auto font-mono">
          {tokenUsage.input.toLocaleString()} in / {tokenUsage.output.toLocaleString()} out
        </span>
      )}
    </div>
  );
}
