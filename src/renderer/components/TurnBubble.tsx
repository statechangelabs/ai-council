import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { CounsellorAvatar } from "./CounsellorAvatar";
import type { ConversationTurn } from "../../types";

const textPalette = [
  "text-blue-400",
  "text-orange-400",
  "text-green-400",
  "text-purple-400",
  "text-yellow-400",
  "text-cyan-400",
];
const colorMap: Record<string, number> = {};
let colorIdx = 0;

function nameColor(name: string): string {
  if (colorMap[name] === undefined) {
    colorMap[name] = colorIdx % textPalette.length;
    colorIdx++;
  }
  return textPalette[colorMap[name]];
}

interface TurnBubbleProps {
  turn: ConversationTurn;
  streaming?: boolean;
}

export function TurnBubble({ turn, streaming }: TurnBubbleProps) {
  const isUser = turn.counsellorId === "__user__";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(turn.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group py-3">
      <div className="flex items-center gap-2 mb-1">
        {!isUser && (
          <CounsellorAvatar name={turn.counsellorName} avatarUrl={turn.avatarUrl} size={48} />
        )}
        <span className={cn("text-sm font-semibold", isUser ? "text-muted-foreground" : nameColor(turn.counsellorName))}>
          {turn.counsellorName}
        </span>
        {!isUser && (
          <span className="text-[11px] text-muted-foreground/60">
            {turn.round > 0 && <>Round {turn.round} &middot; </>}{turn.model}
          </span>
        )}
      </div>
      <div
        className={cn(
          "relative rounded-lg border px-4 py-3 text-sm leading-relaxed prose-council",
          isUser ? "bg-accent/50 border-border" : "bg-card border-border",
        )}
      >
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <ReactMarkdown>{turn.content}</ReactMarkdown>
        {streaming && <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />}
      </div>
    </div>
  );
}
