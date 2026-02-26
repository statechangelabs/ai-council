import { useState, useEffect, useCallback, useRef } from "react";
import type { ConversationTurn, ConversationResult } from "../../types";
import type { DiscussionEvent } from "../council-api";

export interface DiscussionState {
  isRunning: boolean;
  turns: ConversationTurn[];
  streamingContent: Record<string, string>;
  currentRound: number;
  currentSpeaker: string;
  totalRounds: number;
  tokenUsage: { input: number; output: number };
  title: string | null;
  error: string | null;
  result: ConversationResult | null;
  summaryStatus: "idle" | "running" | "complete";
  summaryContent: string;
  diagram: unknown[] | null;
  infographicStatus: "idle" | "running" | "complete" | "error";
  infographics: string[];
  infographicError: string | null;
  roundSummaries: Record<number, string>;
  activeRoundSummary: { round: number; content: string } | null;
}

export function useDiscussion() {
  const [state, setState] = useState<DiscussionState>({
    isRunning: false,
    turns: [],
    streamingContent: {},
    currentRound: 0,
    currentSpeaker: "",
    totalRounds: 0,
    tokenUsage: { input: 0, output: 0 },
    title: null,
    error: null,
    result: null,
    summaryStatus: "idle",
    summaryContent: "",
    diagram: null,
    infographicStatus: "idle",
    infographics: [],
    infographicError: null,
    roundSummaries: {},
    activeRoundSummary: null,
  });

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const start = useCallback((params: {
    topic: string;
    topicSource: "inline" | "file";
    councilDir: string;
    counsellorIds?: string[];
    rounds: number;
    infographicBackends?: ("openai" | "google")[];
    mode?: "freeform" | "debate";
  }) => {
    setState({
      isRunning: true,
      turns: [],
      streamingContent: {},
      currentRound: 0,
      currentSpeaker: "",
      totalRounds: params.rounds,
      tokenUsage: { input: 0, output: 0 },
      title: null,
      error: null,
      result: null,
      summaryStatus: "idle",
      summaryContent: "",
      diagram: null,
      infographicStatus: "idle",
      infographics: [],
      infographicError: null,
      roundSummaries: {},
      activeRoundSummary: null,
    });

    unsubRef.current?.();
    unsubRef.current = window.councilAPI.onDiscussionEvent((event: DiscussionEvent) => {
      setState((prev) => {
        switch (event.type) {
          case "turn_start": {
            const sc = { ...prev.streamingContent };
            sc[event.counsellorName] = "";
            return {
              ...prev,
              currentRound: event.round,
              currentSpeaker: event.counsellorName,
              streamingContent: sc,
            };
          }
          case "turn_chunk": {
            const sc = { ...prev.streamingContent };
            sc[event.counsellorName] = (sc[event.counsellorName] ?? "") + event.delta;
            return { ...prev, streamingContent: sc };
          }
          case "turn_complete": {
            const newTurns = [...prev.turns, event.turn];
            const usage = event.turn.tokenUsage;
            const sc = { ...prev.streamingContent };
            delete sc[event.turn.counsellorName];
            return {
              ...prev,
              turns: newTurns,
              streamingContent: sc,
              tokenUsage: usage
                ? { input: prev.tokenUsage.input + usage.input, output: prev.tokenUsage.output + usage.output }
                : prev.tokenUsage,
            };
          }
          case "round_complete":
            return { ...prev, currentRound: event.round };
          case "title_generated":
            return { ...prev, title: (event as any).title };
          case "error":
            return { ...prev, error: event.error };
          case "summary_start":
            return { ...prev, summaryStatus: "running", summaryContent: "" };
          case "summary_chunk":
            return { ...prev, summaryContent: prev.summaryContent + (event as any).delta };
          case "summary_complete": {
            const evt = event as any;
            return { ...prev, summaryStatus: "complete", summaryContent: evt.summary, diagram: evt.diagram ?? null };
          }
          case "round_summary_start":
            return { ...prev, activeRoundSummary: { round: (event as any).round, content: "" } };
          case "round_summary_chunk": {
            const evt = event as any;
            if (!prev.activeRoundSummary || prev.activeRoundSummary.round !== evt.round) return prev;
            return { ...prev, activeRoundSummary: { round: evt.round, content: prev.activeRoundSummary.content + evt.delta } };
          }
          case "round_summary_complete": {
            const evt = event as any;
            return {
              ...prev,
              roundSummaries: { ...prev.roundSummaries, [evt.round]: evt.summary },
              activeRoundSummary: null,
            };
          }
          case "infographic_start":
            return { ...prev, infographicStatus: "running" };
          case "infographic_complete":
            return { ...prev, infographicStatus: "complete", infographics: [...prev.infographics, (event as any).infographic] };
          case "infographic_error":
            return { ...prev, infographicStatus: "error", infographicError: (event as any).error };
          case "complete":
            return { ...prev, isRunning: false, result: event.result, currentSpeaker: "" };
          default:
            return prev;
        }
      });
    });

    window.councilAPI.startDiscussion(params);
  }, []);

  const stop = useCallback(() => {
    window.councilAPI.stopDiscussion();
    setState((prev) => ({ ...prev, isRunning: false, currentSpeaker: "", streamingContent: {} }));
  }, []);

  const inject = useCallback((content: string) => {
    window.councilAPI.injectMessage(content);
  }, []);

  return { ...state, start, stop, inject };
}
