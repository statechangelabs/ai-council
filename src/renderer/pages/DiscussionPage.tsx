import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Play, Square, Send, AlertTriangle, FileText, Image, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TopicInput, type Attachment } from "../components/TopicInput";
import { DiscussionFeed } from "../components/DiscussionFeed";
import { StatusBar } from "../components/StatusBar";
import { useDiscussion } from "../hooks/useDiscussion";
import { ExcalidrawDiagram } from "../components/ExcalidrawDiagram";
import { CounsellorAvatar } from "../components/CounsellorAvatar";
import { BackendIcon } from "../components/BackendIcon";
import { getCounsellorIssues } from "../lib/counsellor-issues";
import { cn } from "../lib/utils";
import type { CounsellorSummary } from "../council-api";
import type { CouncilConfig } from "../../types";

const DEFAULT_COUNCIL_DIR = "./council";

export function DiscussionPage() {
  const [topic, setTopic] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [rounds, setRounds] = useState(2);
  const [counsellors, setCounsellors] = useState<CounsellorSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [injectText, setInjectText] = useState("");
  const [config, setConfig] = useState<CouncilConfig>({ backends: {} });
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  const [issueMap, setIssueMap] = useState<Record<string, string[]>>({});
  const [markitdownInstalled, setMarkitdownInstalled] = useState<boolean | null>(null);
  const [isInstallingMarkitdown, setIsInstallingMarkitdown] = useState(false);
  const [selectedInfographics, setSelectedInfographics] = useState<Set<"openai" | "google">>(new Set());
  const [mode, setMode] = useState<"freeform" | "debate">("freeform");

  const discussion = useDiscussion();

  useEffect(() => {
    Promise.all([
      window.councilAPI.listCounsellors(DEFAULT_COUNCIL_DIR),
      window.councilAPI.getConfig(),
    ]).then(([list, configResult]) => {
      setCounsellors(list);
      setConfig(configResult.config);
      setEnvStatus(configResult.envStatus);

      // Compute issues
      const issues: Record<string, string[]> = {};
      for (const c of list) {
        issues[c.id] = getCounsellorIssues(c, configResult.config, configResult.envStatus);
      }
      setIssueMap(issues);

      // Restore saved counsellor selection or default to all healthy
      const savedIds = configResult.config.defaults?.counsellorIds;
      if (savedIds?.length) {
        // Only select saved IDs that still exist and are healthy
        const validSaved = new Set(savedIds.filter((id: string) => issues[id]?.length === 0));
        setSelectedIds(validSaved.size > 0 ? validSaved : new Set(list.filter(c => issues[c.id]?.length === 0).map(c => c.id)));
      } else {
        setSelectedIds(new Set(list.filter(c => issues[c.id]?.length === 0).map(c => c.id)));
      }

      // Restore saved infographic backends
      const savedBackends = configResult.config.defaults?.infographicBackends;
      if (savedBackends?.length) {
        setSelectedInfographics(new Set(savedBackends));
      }

      // Restore saved mode preference
      if (configResult.config.defaults?.mode) {
        setMode(configResult.config.defaults.mode);
      }
    });
    window.councilAPI.checkMarkitdown().then((result) => {
      setMarkitdownInstalled(result.installed);
    });
  }, []);

  const handleStart = () => {
    if (!topic.trim() && attachments.length === 0) return;
    let fullTopic = topic.trim();
    for (const att of attachments) {
      fullTopic += `\n\n---\nAttachment: ${att.name}\n${att.content}`;
    }

    // Save defaults for next time
    const updatedConfig = {
      ...config,
      defaults: {
        ...config.defaults,
        counsellorIds: Array.from(selectedIds),
        infographicBackends: Array.from(selectedInfographics) as ("openai" | "google")[],
        mode,
      },
    };
    window.councilAPI.saveConfig(updatedConfig);
    setConfig(updatedConfig);

    discussion.start({
      topic: fullTopic,
      topicSource: "inline",
      councilDir: DEFAULT_COUNCIL_DIR,
      counsellorIds: selectedIds.size === counsellors.length ? undefined : Array.from(selectedIds),
      rounds,
      infographicBackends: selectedInfographics.size > 0 ? Array.from(selectedInfographics) : undefined,
      mode,
    });
  };

  const handleInject = () => {
    if (!injectText.trim()) return;
    discussion.inject(injectText.trim());
    setInjectText("");
  };

  const handleInstallMarkitdown = async () => {
    setIsInstallingMarkitdown(true);
    const result = await window.councilAPI.installMarkitdown();
    setIsInstallingMarkitdown(false);
    if (result.success) {
      setMarkitdownInstalled(true);
      // Re-process any failed attachments
      const updated = await Promise.all(
        attachments.map(async (att) => {
          if (att.content.startsWith("[Cannot convert")) {
            try {
              // Re-read the file — we need the original path, but we only have the name.
              // The content contains the error message, so we can't recover the path here.
              // Instead, the user can re-drop the file. The banner disappearing signals success.
              return att;
            } catch {
              return att;
            }
          }
          return att;
        }),
      );
      setAttachments(updated);
    }
  };

  const toggleCounsellor = (id: string) => {
    // Don't allow toggling counsellors with issues
    if ((issueMap[id] || []).length > 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInfographic = (backend: "openai" | "google") => {
    setSelectedInfographics((prev) => {
      const next = new Set(prev);
      if (next.has(backend)) next.delete(backend);
      else next.add(backend);
      return next;
    });
  };

  const healthySelected = Array.from(selectedIds).filter((id) => (issueMap[id] || []).length === 0);
  const canStart = (topic.trim() || attachments.length > 0) && healthySelected.length > 0;
  const hasGoogleKey = !!(config.backends.google?.apiKey || envStatus.GOOGLE_API_KEY);
  const hasOpenaiKey = !!(config.backends.openai?.apiKey || envStatus.OPENAI_API_KEY);

  const infographicOptions: { backend: "google" | "openai"; label: string; available: boolean }[] = [
    { backend: "google", label: "Nano Banana Pro", available: hasGoogleKey },
    { backend: "openai", label: "GPT Image", available: hasOpenaiKey },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="shrink-0 p-4 pb-3 space-y-3 border-b">
        <TopicInput
          value={topic}
          onChange={setTopic}
          disabled={discussion.isRunning}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          markitdownMissing={markitdownInstalled === false}
          onInstallMarkitdown={handleInstallMarkitdown}
          isInstallingMarkitdown={isInstallingMarkitdown}
        />

        <div className="flex items-center gap-4 flex-wrap">
          {/* Counsellor chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {counsellors.map((c) => {
              const issues = issueMap[c.id] || [];
              const hasIssues = issues.length > 0;
              const selected = selectedIds.has(c.id);
              const disabled = discussion.isRunning || hasIssues;

              return (
                <div key={c.id} className="relative group">
                  <button
                    onClick={() => toggleCounsellor(c.id)}
                    disabled={disabled}
                    title={hasIssues ? issues[0] : undefined}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1",
                      hasIssues
                        ? "border-destructive/40 text-destructive/60 bg-destructive/5 cursor-not-allowed"
                        : selected
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50",
                      discussion.isRunning && !hasIssues && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {hasIssues && <AlertTriangle className="h-3 w-3" />}
                    {!hasIssues && (
                      <CounsellorAvatar name={c.name} avatarUrl={c.avatarUrl} size={16} />
                    )}
                    {c.name}
                  </button>
                  {/* Tooltip on hover for issues */}
                  {hasIssues && (
                    <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-20 w-64">
                      <div className="bg-card border rounded-md shadow-lg px-2.5 py-1.5 text-xs text-destructive">
                        {issues[0]}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Mode toggle chips */}
            {([
              { key: "freeform" as const, label: "Freeform", tip: "Open group chat \u2014 every counsellor sees the full conversation history on every turn" },
              { key: "debate" as const, label: "Debate", tip: "Structured argument \u2014 round 1 is constructive (each counsellor argues blind), then rebuttal rounds see only the constructives + previous round. Speaker order is shuffled each round with interim summaries." },
            ]).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                disabled={discussion.isRunning}
                title={m.tip}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  mode === m.key
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50",
                  discussion.isRunning && "opacity-50 cursor-not-allowed",
                )}
              >
                {m.label}
              </button>
            ))}

            {/* Infographic backend chips */}
            {infographicOptions.filter(o => o.available).map((opt) => {
              const selected = selectedInfographics.has(opt.backend);
              return (
                <button
                  key={opt.backend}
                  onClick={() => toggleInfographic(opt.backend)}
                  disabled={discussion.isRunning}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1",
                    selected
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50",
                    discussion.isRunning && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <BackendIcon backend={opt.backend} size={14} />
                  {opt.label}
                </button>
              );
            })}

            <label className="text-xs text-muted-foreground">Rounds</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value) || 1)}
              disabled={discussion.isRunning}
              className="w-16 h-8 text-center text-xs"
            />

            {!discussion.isRunning ? (
              <Button onClick={handleStart} disabled={!canStart} size="sm" className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Start
              </Button>
            ) : (
              <Button onClick={discussion.stop} variant="destructive" size="sm" className="gap-1.5">
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            )}
          </div>
        </div>

        {discussion.error && (
          <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            {discussion.error}
          </div>
        )}
      </div>

      {/* Generated title */}
      {discussion.title && (
        <div className="shrink-0 px-4 py-2 border-b bg-muted/30">
          <h2 className="text-sm font-semibold truncate">{discussion.title}</h2>
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <DiscussionFeed
          turns={discussion.turns}
          streamingContent={discussion.streamingContent}
          mode={mode}
          roundSummaries={discussion.roundSummaries}
          activeRoundSummary={discussion.activeRoundSummary}
        />

        {/* Secretary Summary */}
        {discussion.summaryStatus !== "idle" && (
          <div className="px-4 py-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary">Secretary's Summary</h3>
              {discussion.summaryStatus === "running" && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse rounded-sm" />
              )}
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed prose-council">
              <ReactMarkdown>{discussion.summaryContent}</ReactMarkdown>
            </div>

            {/* Excalidraw Diagram */}
            {discussion.diagram && discussion.diagram.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Position Diagram</h4>
                <ExcalidrawDiagram elements={discussion.diagram} />
              </div>
            )}
          </div>
        )}

        {/* Infographics */}
        {discussion.infographics.length > 0 && (
          <div className="px-4 py-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Image className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary">
                Infographic{discussion.infographics.length > 1 ? "s" : ""}
              </h3>
            </div>
            <div className="space-y-3">
              {discussion.infographics.map((data, i) => (
                <img
                  key={i}
                  src={`data:image/png;base64,${data}`}
                  alt={`Infographic ${i + 1}`}
                  className="rounded-lg border max-w-full"
                />
              ))}
            </div>
          </div>
        )}
        {discussion.infographicStatus === "running" && (
          <div className="px-4 py-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating infographic...
            </div>
          </div>
        )}
        {discussion.infographicStatus === "error" && discussion.infographicError && (
          <div className="px-4 py-4 border-t">
            <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              Infographic error: {discussion.infographicError}
            </div>
          </div>
        )}
      </div>

      {/* Chat injection */}
      {discussion.isRunning && (
        <div className="shrink-0 flex gap-2 p-3 border-t">
          <Input
            value={injectText}
            onChange={(e) => setInjectText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInject()}
            placeholder="Inject a message into the discussion..."
            className="h-9 text-sm"
          />
          <Button onClick={handleInject} variant="secondary" size="sm" className="shrink-0 gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      )}

      {/* Status */}
      <StatusBar
        isRunning={discussion.isRunning}
        round={discussion.currentRound}
        totalRounds={discussion.totalRounds}
        speaker={discussion.currentSpeaker}
        tokenUsage={discussion.tokenUsage}
      />
    </div>
  );
}
