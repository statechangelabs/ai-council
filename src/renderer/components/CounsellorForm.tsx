import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Trash2, Loader2, Terminal, Code, Folder } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { BackendIcon } from "./BackendIcon";
import { CounsellorAvatar } from "./CounsellorAvatar";
import type { CounsellorDetail } from "../council-api";

interface CounsellorFormProps {
  dirPath: string | null;
  isNew: boolean;
  onSave: (dirPath: string | null, id: string, aboutMd: string) => void;
  onDelete: (dirPath: string) => void;
  onClose: () => void;
}

const backends = ["anthropic", "openai", "google", "ollama"];

/** Shorten an absolute path by replacing the home directory with ~ */
function shortenPath(p: string): string {
  const home = typeof process !== "undefined" ? process.env.HOME : undefined;
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

export function CounsellorForm({ dirPath, isNew, onSave, onDelete, onClose }: CounsellorFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [backend, setBackend] = useState("anthropic");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [interests, setInterests] = useState("");
  const [avatar, setAvatar] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [rawMd, setRawMd] = useState("");
  const [id, setId] = useState("");

  // Snapshot of the last-saved markdown, for dirty detection
  const savedMdRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  // Model detection per backend
  const [backendModels, setBackendModels] = useState<Record<string, string[]>>({});
  const [probing, setProbing] = useState<string | null>(null);

  const probeModels = useCallback(async (backendName: string) => {
    if (backendModels[backendName]) return; // already cached
    setProbing(backendName);
    try {
      const { config } = await window.councilAPI.getConfig();
      const bc = config.backends[backendName] || {};
      const result = await window.councilAPI.probeBackend(backendName, bc);
      setBackendModels((prev) => ({ ...prev, [backendName]: result.models }));
    } catch {
      setBackendModels((prev) => ({ ...prev, [backendName]: [] }));
    }
    setProbing(null);
  }, [backendModels]);

  // Probe the current backend on mount and when it changes
  useEffect(() => {
    probeModels(backend);
  }, [backend]);

  useEffect(() => {
    if (dirPath && !isNew) {
      window.councilAPI.getCounsellor(dirPath).then((detail: CounsellorDetail) => {
        const fm = detail.frontmatter;
        setName((fm.name as string) || "");
        setDescription((fm.description as string) || "");
        setBackend((fm.backend as string) || "anthropic");
        setModel((fm.model as string) || "");
        setTemperature((fm.temperature as number) ?? 0.7);
        setInterests(((fm.interests as string[]) || []).join(", "));
        setAvatar((fm.avatar as string) || "");
        setSystemPrompt(detail.body);
        setRawMd(detail.raw);
        savedMdRef.current = detail.raw;
        setLoaded(true);
      });
    }
  }, [dirPath, isNew]);

  const buildMarkdown = useCallback(() => {
    if (rawMode) return rawMd;
    const lines = [
      "---",
      `name: "${name}"`,
      `description: "${description}"`,
      `interests: [${interests.split(",").map((s) => `"${s.trim()}"`).filter((s) => s !== '""').join(", ")}]`,
      `backend: "${backend}"`,
    ];
    if (model) lines.push(`model: "${model}"`);
    lines.push(`temperature: ${temperature}`);
    if (avatar.trim()) lines.push(`avatar: "${avatar.trim()}"`);
    lines.push("---");
    lines.push(systemPrompt);
    return lines.join("\n");
  }, [rawMode, rawMd, name, description, interests, backend, model, temperature, avatar, systemPrompt]);

  const dirty = loaded && (isNew
    ? !!(id || name || description || systemPrompt)
    : savedMdRef.current !== null && buildMarkdown() !== savedMdRef.current);

  const handleSave = () => {
    const md = buildMarkdown();
    const effectiveId = isNew ? id.trim().toLowerCase().replace(/\s+/g, "-") : "";
    savedMdRef.current = md;
    onSave(dirPath, effectiveId, md);
  };

  const handleBack = () => {
    if (dirty) {
      const choice = confirm("You have unsaved changes. Discard them?");
      if (!choice) return;
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex border-b bg-card sticky top-0 z-10 px-6 py-3 gap-3">
        {/* Left: back button spanning both rows */}
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 -ml-2 self-center shrink-0">
          <ArrowLeft className="h-4 w-4" />
          Counsellors
        </Button>
        <Separator orientation="vertical" className="self-stretch" />
        {/* Middle: avatar + title row + path row */}
        <CounsellorAvatar
          name={name || "?"}
          avatarUrl={avatar.trim() || undefined}
          size={32}
          className="self-center shrink-0"
        />
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <h2 className="text-lg font-semibold leading-tight">{isNew ? "New Counsellor" : name || "Edit Counsellor"}</h2>
          {!isNew && dirPath && (
            <div className="flex items-center gap-1 min-w-0">
              <button
                className="flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground/60 font-mono hover:text-muted-foreground transition-colors"
                title="Open in Finder"
                onClick={() => window.councilAPI.openInFinder(dirPath)}
              >
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate">{shortenPath(dirPath)}</span>
              </button>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 gap-1 text-[11px] text-muted-foreground"
                  title="Open in Terminal"
                  onClick={() => window.councilAPI.openInTerminal(dirPath)}
                >
                  <Terminal className="h-3 w-3" />
                  Terminal
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 gap-1 text-[11px] text-muted-foreground"
                  title="Open in code editor"
                  onClick={() => window.councilAPI.openInEditor(dirPath)}
                >
                  <Code className="h-3 w-3" />
                  Editor
                </Button>
              </div>
            </div>
          )}
        </div>
        {/* Right: save/delete */}
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={handleSave} disabled={!dirty}>
            {isNew ? "Create" : "Save"}
          </Button>
          {!isNew && dirPath && (
            <Button variant="destructive" size="sm" onClick={() => { if (confirm("Delete this counsellor?")) onDelete(dirPath); }}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 px-6 pt-4">
        <Button
          variant={!rawMode ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setRawMode(false)}
        >
          Form
        </Button>
        <Button
          variant={rawMode ? "secondary" : "ghost"}
          size="sm"
          onClick={() => {
            if (!rawMode) setRawMd(buildMarkdown());
            setRawMode(!rawMode);
          }}
        >
          Raw ABOUT.md
        </Button>
      </div>

      {/* Body */}
      <div className="px-6 py-4 space-y-4 flex-1">
        {rawMode ? (
          <Textarea
            value={rawMd}
            onChange={(e) => setRawMd(e.target.value)}
            className="min-h-[400px] font-mono text-xs"
          />
        ) : (
          <div className="max-w-2xl space-y-4">
            {isNew && (
              <div className="space-y-1.5">
                <Label>ID (folder name)</Label>
                <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. researcher" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Avatar</Label>
              <div className="flex items-center gap-3">
                <CounsellorAvatar
                  name={name || "?"}
                  avatarUrl={avatar.trim() || undefined}
                  size={40}
                />
                <Input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="URL or relative file path (e.g. avatar.png)"
                  className="flex-1 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter a URL (https://...) or a file path relative to the counsellor folder. Leave empty for default initial.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Backend</Label>
                <div className="relative">
                  <BackendIcon
                    backend={backend}
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <select
                    value={backend}
                    onChange={(e) => setBackend(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {backends.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                {probing === backend ? (
                  <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Detecting…
                  </div>
                ) : (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">(backend default)</option>
                    {(backendModels[backend] || []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {model && !(backendModels[backend] || []).includes(model) && (
                      <option value={model}>{model} (current)</option>
                    )}
                  </select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Temperature: {temperature.toFixed(1)}</Label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interests (comma-separated)</Label>
              <Input value={interests} onChange={(e) => setInterests(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>System Prompt</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
