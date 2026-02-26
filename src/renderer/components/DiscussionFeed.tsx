import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { TurnBubble } from "./TurnBubble";
import { MessageSquare, FileText } from "lucide-react";
import type { ConversationTurn } from "../../types";

interface DiscussionFeedProps {
  turns: ConversationTurn[];
  streamingContent?: Record<string, string>;
  mode?: "freeform" | "debate";
  roundSummaries?: Record<number, string>;
  activeRoundSummary?: { round: number; content: string } | null;
}

function RoundDivider({ round, totalRounds }: { round: number; totalRounds?: number }) {
  const label = round === 1 ? "Round 1 \u2014 Constructive" : `Round ${round} \u2014 Rebuttal`;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function RoundSummaryCard({ round, content, streaming }: { round: number; content: string; streaming?: boolean }) {
  return (
    <div className="my-3 mx-2 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">Round {round} Summary</span>
        {streaming && <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse rounded-sm" />}
      </div>
      <div className="text-sm leading-relaxed prose-council">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

export function DiscussionFeed({ turns, streamingContent = {}, mode, roundSummaries = {}, activeRoundSummary }: DiscussionFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingEntries = Object.entries(streamingContent);
  const isDebate = mode === "debate";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, streamingEntries.length, streamingEntries.map(([, v]) => v.length).join(), activeRoundSummary?.content.length]);

  if (turns.length === 0 && streamingEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-3">
        <MessageSquare className="h-10 w-10" />
        <p className="text-sm">Start a discussion to see the conversation here</p>
      </div>
    );
  }

  // Group turns by round for debate mode
  const roundNumbers = [...new Set(turns.map((t) => t.round))].sort((a, b) => a - b);

  return (
    <div className="px-4 divide-y divide-border/50">
      {isDebate ? (
        <>
          {roundNumbers.map((round) => {
            const roundTurns = turns.filter((t) => t.round === round);
            return (
              <React.Fragment key={`round-${round}`}>
                <RoundDivider round={round} />
                {roundTurns.map((turn, i) => (
                  <TurnBubble key={`${round}-${i}`} turn={turn} />
                ))}
                {roundSummaries[round] && (
                  <RoundSummaryCard round={round} content={roundSummaries[round]} />
                )}
                {activeRoundSummary && activeRoundSummary.round === round && (
                  <RoundSummaryCard round={round} content={activeRoundSummary.content} streaming />
                )}
              </React.Fragment>
            );
          })}
        </>
      ) : (
        turns.map((turn, i) => (
          <TurnBubble key={i} turn={turn} />
        ))
      )}
      {streamingEntries.map(([name, content]) => (
        <TurnBubble
          key={`streaming-${name}`}
          turn={{
            round: 0,
            counsellorId: name,
            counsellorName: name,
            content,
            timestamp: "",
            model: "",
            backend: "",
          }}
          streaming
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
