import React, { useEffect, useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Clock, ArrowLeft, Trash2, Users, RotateCcw, FileText, Share2, MessageSquare, Copy, Check, Eye, EyeOff, Image, Loader2 } from "lucide-react";
import { BackendIcon } from "../components/BackendIcon";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { DiscussionFeed } from "../components/DiscussionFeed";
import { ExcalidrawDiagram } from "../components/ExcalidrawDiagram";
import { AttachmentCard } from "../components/AttachmentCard";
import { parseTopic } from "../lib/parse-attachments";
import type { HistoryEntry } from "../council-api";
import type { ConversationResult, CouncilConfig } from "../../types";

function formatShareMarkdown(detail: ConversationResult): string {
  const title = detail.title ?? detail.topic;
  const counsellorNames = detail.counsellors.map((c) => c.name).join(", ");
  const date = new Date(detail.startedAt).toLocaleString();

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`**Prompt:** ${detail.topic}`);
  lines.push(`**Counsellors:** ${counsellorNames}`);
  lines.push(`**Date:** ${date}`);
  lines.push("");
  lines.push("---");

  let currentRound = 0;
  for (const turn of detail.turns) {
    if (turn.round !== currentRound) {
      currentRound = turn.round;
      lines.push("");
      lines.push(`## Round ${currentRound}`);
    }
    lines.push("");
    lines.push(`### ${turn.counsellorName}`);
    lines.push(turn.content);
  }

  if (detail.summary) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Summary");
    lines.push(detail.summary);
  }

  return lines.join("\n");
}

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationResult | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [showRaw, setShowRaw] = useState(false);
  const [infographicLoading, setInfographicLoading] = useState<string | null>(null); // backend name or null
  const [infographicError, setInfographicError] = useState<string | null>(null);
  const [config, setConfig] = useState<CouncilConfig>({ backends: {} });
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.councilAPI.getConfig().then((result) => {
      setConfig(result.config);
      setEnvStatus(result.envStatus);
    });
  }, []);

  const hasGoogleKey = !!(config.backends.google?.apiKey || envStatus.GOOGLE_API_KEY);
  const hasOpenaiKey = !!(config.backends.openai?.apiKey || envStatus.OPENAI_API_KEY);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.councilAPI.listHistory();
      setEntries(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSelect = async (id: string) => {
    try {
      const [result, counsellors] = await Promise.all([
        window.councilAPI.getHistoryEntry(id),
        window.councilAPI.listCounsellors("./council"),
      ]);
      setAvatarMap(Object.fromEntries(counsellors.map(c => [c.name, c.avatarUrl])));
      setDetail(result);
      setSelectedId(id);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await window.councilAPI.deleteHistoryEntry(id);
      setDeleteConfirm(null);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      reload();
    } catch {
      /* ignore */
    }
  };

  const handleShare = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(formatShareMarkdown(detail));
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  const parsed = useMemo(() => detail ? parseTopic(detail.topic) : null, [detail]);

  const handleCopyPrompt = async () => {
    if (!detail || !parsed) return;
    const text = showRaw ? detail.topic : parsed.prompt;
    await navigator.clipboard.writeText(text);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 1500);
  };

  // Detail view
  if (selectedId && detail) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b shrink-0">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{detail.title ?? detail.topic}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(detail.startedAt).toLocaleString()} — {detail.counsellors.map(c => c.name).join(", ")}
            </p>
          </div>
          {/* TODO: Share button should also offer "Post to URL" for shareable links. Deferred. */}
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleShare}>
            {shareCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Share2 className="h-3.5 w-3.5" />}
            {shareCopied ? "Copied!" : "Share"}
          </Button>
          <Badge variant="secondary">
            {detail.rounds} round{detail.rounds > 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Prompt section */}
          <div className="group px-4 pt-4 pb-2">
            <div className="relative rounded-lg border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Prompt</span>
                {parsed && parsed.attachments.length > 0 && (
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showRaw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showRaw ? "Show attachments" : "Show raw"}
                  </button>
                )}
              </div>
              {showRaw ? (
                <div className="text-sm leading-relaxed pr-8 prose-council">
                  <ReactMarkdown>{detail.topic.replace(/(?<!\n)\n(?!\n)/g, "\n\n")}</ReactMarkdown>
                </div>
              ) : (
                <>
                  <div className="text-sm leading-relaxed pr-8 prose-council">
                    <ReactMarkdown>{(parsed?.prompt ?? detail.topic).replace(/(?<!\n)\n(?!\n)/g, "\n\n")}</ReactMarkdown>
                  </div>
                  {parsed && parsed.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {parsed.attachments.map((att, i) => (
                        <AttachmentCard key={i} name={att.name} content={att.content} />
                      ))}
                    </div>
                  )}
                </>
              )}
              <button
                onClick={handleCopyPrompt}
                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground"
                title="Copy prompt"
              >
                {promptCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <DiscussionFeed
            turns={detail.turns.map(t => ({
              ...t,
              avatarUrl: avatarMap[t.counsellorName] ?? t.avatarUrl,
            }))}
            mode={detail.mode}
            roundSummaries={detail.roundSummaries}
          />

          {/* Secretary Summary */}
          {detail.summary && (
            <div className="px-4 py-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary">Secretary's Summary</h3>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed prose-council">
                <ReactMarkdown>{detail.summary}</ReactMarkdown>
              </div>

              {/* Excalidraw Diagram */}
              {detail.diagram && detail.diagram.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Position Diagram</h4>
                  <ExcalidrawDiagram elements={detail.diagram} />
                </div>
              )}
            </div>
          )}

          {/* Infographics */}
          {(hasGoogleKey || hasOpenaiKey || (detail.infographics?.length ?? 0) > 0) && (
            <div className="px-4 py-4 border-t">
              {detail.infographics && detail.infographics.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Image className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-primary">
                      Infographic{detail.infographics.length > 1 ? "s" : ""}
                    </h3>
                  </div>
                  <div className="space-y-4 mb-4">
                    {detail.infographics.map((data, i) => (
                      <div key={i} className="group relative">
                        <img
                          src={`data:image/png;base64,${data}`}
                          alt={`Infographic ${i + 1}`}
                          className="rounded-lg border max-w-full"
                        />
                        <button
                          onClick={async () => {
                            if (!selectedId) return;
                            try {
                              await window.councilAPI.deleteInfographic(selectedId, i);
                              setDetail((prev) => {
                                if (!prev?.infographics) return prev;
                                const updated = [...prev.infographics!];
                                updated.splice(i, 1);
                                return { ...prev, infographics: updated };
                              });
                            } catch { /* ignore */ }
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive/10 border border-border/50 text-muted-foreground hover:text-destructive"
                          title="Delete infographic"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(hasGoogleKey || hasOpenaiKey) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {hasGoogleKey && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!!infographicLoading}
                      onClick={async () => {
                        if (!selectedId) return;
                        setInfographicLoading("google");
                        setInfographicError(null);
                        try {
                          const result = await window.councilAPI.generateInfographic(selectedId, "google");
                          setDetail((prev) => {
                            if (!prev) return prev;
                            return { ...prev, infographics: [...(prev.infographics ?? []), result.infographic] };
                          });
                        } catch (err) {
                          setInfographicError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setInfographicLoading(null);
                        }
                      }}
                    >
                      {infographicLoading === "google" ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                      ) : (
                        <><BackendIcon backend="google" size={14} /> Nano Banana Pro</>
                      )}
                    </Button>
                  )}
                  {hasOpenaiKey && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!!infographicLoading}
                      onClick={async () => {
                        if (!selectedId) return;
                        setInfographicLoading("openai");
                        setInfographicError(null);
                        try {
                          const result = await window.councilAPI.generateInfographic(selectedId, "openai");
                          setDetail((prev) => {
                            if (!prev) return prev;
                            return { ...prev, infographics: [...(prev.infographics ?? []), result.infographic] };
                          });
                        } catch (err) {
                          setInfographicError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setInfographicLoading(null);
                        }
                      }}
                    >
                      {infographicLoading === "openai" ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                      ) : (
                        <><BackendIcon backend="openai" size={14} /> GPT Image</>
                      )}
                    </Button>
                  )}
                </div>
              )}
              {infographicError && (
                <p className="mt-2 text-xs text-destructive">{infographicError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground mt-1">Past council discussions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground/50 gap-2">
          <RotateCcw className="h-4 w-4 animate-spin" />
          <p className="text-sm">Loading history...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 gap-3">
          <Clock className="h-10 w-10" />
          <p className="text-sm">No discussions yet. Start one from the Discussion page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSelect(entry.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-sm">
                    {entry.title ?? parseTopic(entry.topic).prompt}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (deleteConfirm === entry.id) {
                        handleDelete(entry.id);
                      } else {
                        setDeleteConfirm(entry.id);
                        setTimeout(() => setDeleteConfirm(null), 3000);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.startedAt).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {entry.counsellors.join(", ")}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {entry.rounds} round{entry.rounds > 1 ? "s" : ""}
                  </Badge>
                </div>
                {deleteConfirm === entry.id && (
                  <p className="text-xs text-destructive mt-2">Click delete again to confirm</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
