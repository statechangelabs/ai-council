import React, { useState, useEffect, useCallback } from "react";
import {
  Check, ShieldCheck, ShieldAlert, RefreshCw, Wifi, WifiOff, Loader2, FileText,
  Package, CheckCircle2, XCircle, Image,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import { cn } from "../lib/utils";
import { BackendIcon } from "../components/BackendIcon";
import type { CouncilConfig } from "../../types";

const backendNames = ["anthropic", "openai", "google", "ollama"] as const;
const envVarNames: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

const backendDisplayNames: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  ollama: "Ollama",
};

const backendDescriptions: Record<string, string> = {
  anthropic: "Claude models from Anthropic",
  openai: "GPT and O-series models from OpenAI",
  google: "Gemini models from Google",
  ollama: "Local models via Ollama",
};

interface BackendProbe {
  loading: boolean;
  connected: boolean | null;
  models: string[];
  error?: string;
}

export function SettingsPage() {
  const [config, setConfig] = useState<CouncilConfig>({ backends: {} });
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  const [defaultUrls, setDefaultUrls] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [probes, setProbes] = useState<Record<string, BackendProbe>>({});
  const [envKeySuffix, setEnvKeySuffix] = useState<Record<string, string | undefined>>({});
  const [backendPickerOpen, setBackendPickerOpen] = useState(false);
  const [markitdown, setMarkitdown] = useState<{ installed: boolean; version?: string } | null>(null);
  const [isInstallingMarkitdown, setIsInstallingMarkitdown] = useState(false);

  useEffect(() => {
    window.councilAPI.getConfig().then((result) => {
      setConfig(result.config);
      setEnvStatus(result.envStatus);
      setEnvKeySuffix(result.envKeySuffix);
      setDefaultUrls(result.defaultUrls);
    });
    window.councilAPI.checkMarkitdown().then(setMarkitdown);
  }, []);

  // Auto-probe all backends on mount
  useEffect(() => {
    if (Object.keys(defaultUrls).length === 0) return;
    for (const name of backendNames) {
      probeOne(name);
    }
  }, [defaultUrls]);

  const probeOne = useCallback(async (name: string) => {
    setProbes((prev) => ({ ...prev, [name]: { loading: true, connected: null, models: [] } }));
    const bc = config.backends[name] || {};
    const result = await window.councilAPI.probeBackend(name, {
      apiKey: bc.apiKey,
      baseUrl: bc.baseUrl,
    });
    setProbes((prev) => ({
      ...prev,
      [name]: { loading: false, connected: result.connected, models: result.models, error: result.error },
    }));
  }, [config]);

  const updateBackend = (name: string, field: "apiKey" | "baseUrl", value: string) => {
    setConfig((prev) => ({
      ...prev,
      backends: {
        ...prev.backends,
        [name]: { ...prev.backends[name], [field]: value || undefined },
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    await window.councilAPI.saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Re-probe after saving
    for (const name of backendNames) {
      probeOne(name);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure API keys and backend connections</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
        {backendNames.map((name) => {
          const bc = config.backends[name] || {};
          const envVar = envVarNames[name];
          const hasEnv = envVar ? envStatus[envVar] : false;
          const probe = probes[name];
          const defaultUrl = defaultUrls[name] || "";

          return (
            <Card key={name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BackendIcon backend={name} size={20} />
                    <CardTitle className="capitalize">{name}</CardTitle>
                    {/* Connection status indicator */}
                    {probe && (
                      probe.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : probe.connected ? (
                        <div className="flex items-center gap-1 text-xs text-green-500">
                          <Wifi className="h-3.5 w-3.5" />
                          <span>Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                          <WifiOff className="h-3.5 w-3.5" />
                          <span>Offline</span>
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {envVar && (
                      <div className="flex items-center gap-1 text-xs">
                        {hasEnv ? (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-green-500 font-mono">{envVar}</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground/40" />
                            <span className="text-muted-foreground/40 font-mono">{envVar}</span>
                          </>
                        )}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => probeOne(name)}
                      disabled={probe?.loading}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", probe?.loading && "animate-spin")} />
                    </Button>
                  </div>
                </div>
                <CardDescription>{backendDescriptions[name]}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {name !== "ollama" && (() => {
                  const configSuffix = bc.apiKey ? "..." + bc.apiKey.slice(-4) : null;
                  const eSuffix = envVar ? envKeySuffix[envVar] : null;
                  return (
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        type="password"
                        value={bc.apiKey || ""}
                        onChange={(e) => updateBackend(name, "apiKey", e.target.value)}
                        placeholder={hasEnv ? "(using environment variable)" : "Enter API key..."}
                        className="font-mono text-xs"
                      />
                      {(configSuffix || eSuffix) && (
                        <div className="flex gap-3 text-[11px] text-muted-foreground font-mono">
                          {configSuffix && <span>config: <span className="text-foreground/70">{configSuffix}</span></span>}
                          {eSuffix && <span>env: <span className="text-foreground/70">{eSuffix}</span></span>}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  <Label className="text-xs">Base URL</Label>
                  <Input
                    value={bc.baseUrl || ""}
                    onChange={(e) => updateBackend(name, "baseUrl", e.target.value)}
                    placeholder={defaultUrl}
                    className="font-mono text-xs"
                  />
                </div>

                {/* Connection error */}
                {probe && !probe.loading && probe.error && (
                  <div className="px-2.5 py-1.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    {probe.error}
                  </div>
                )}

                {/* Available models */}
                {probe && !probe.loading && probe.models.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {probe.connected ? "Available models" : "Known models"}
                      <span className="ml-1 text-muted-foreground/50">({probe.models.length})</span>
                    </Label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {probe.models.map((model) => (
                        <Badge
                          key={model}
                          variant="secondary"
                          className="text-[11px] font-mono font-normal"
                        >
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      {/* Secretary Configuration */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Secretary</h2>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Discussion Summarizer</CardTitle>
            </div>
            <CardDescription>
              An LLM that summarizes discussions after they complete, identifying agreements, disagreements, and key takeaways.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Backend</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBackendPickerOpen((o) => !o)}
                  className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {config.secretary?.backend ? (
                    <>
                      <BackendIcon backend={config.secretary.backend} size={16} />
                      <span>{backendDisplayNames[config.secretary.backend] || config.secretary.backend}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Disabled</span>
                  )}
                  <svg className="ml-auto h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {backendPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBackendPickerOpen(false)} />
                    <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                      <li>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                            !config.secretary?.backend && "bg-accent",
                          )}
                          onClick={() => {
                            setConfig((prev) => ({ ...prev, secretary: undefined }));
                            setSaved(false);
                            setBackendPickerOpen(false);
                          }}
                        >
                          <span className="text-muted-foreground">Disabled</span>
                        </button>
                      </li>
                      {backendNames.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                              config.secretary?.backend === name && "bg-accent",
                            )}
                            onClick={() => {
                              setConfig((prev) => ({
                                ...prev,
                                secretary: { ...prev.secretary, backend: name, model: undefined },
                              }));
                              setSaved(false);
                              setBackendPickerOpen(false);
                            }}
                          >
                            <BackendIcon backend={name} size={16} />
                            <span>{backendDisplayNames[name]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {config.secretary?.backend && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model (optional)</Label>
                  {(() => {
                    const secBackend = config.secretary!.backend!;
                    const probe = probes[secBackend];
                    const models = probe?.models || [];
                    const isLoading = probe?.loading;
                    return (
                      <select
                        value={config.secretary?.model || ""}
                        onChange={(e) => {
                          setConfig((prev) => ({
                            ...prev,
                            secretary: { ...prev.secretary!, model: e.target.value || undefined },
                          }));
                          setSaved(false);
                        }}
                        disabled={isLoading || models.length === 0}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs disabled:opacity-50"
                      >
                        <option value="">
                          {isLoading ? "Loading models..." : models.length === 0 ? "No models available" : "Backend default"}
                        </option>
                        {models.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">System Prompt (optional)</Label>
                  <Textarea
                    value={config.secretary?.systemPrompt || ""}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev,
                        secretary: { ...prev.secretary!, systemPrompt: e.target.value || undefined },
                      }));
                      setSaved(false);
                    }}
                    placeholder="Using default prompt (Individual Positions, Convergence, Divergence, Synthesis)"
                    className="font-mono text-xs min-h-[80px]"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Infographic */}
      {(() => {
        const hasImageKey = !!(
          config.backends.openai?.apiKey || envStatus.OPENAI_API_KEY ||
          config.backends.google?.apiKey || envStatus.GOOGLE_API_KEY
        );
        if (!hasImageKey) return null;
        return (
          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-3">Infographic</h2>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Image className="h-5 w-5 text-primary" />
                  <CardTitle>Image Generation</CardTitle>
                </div>
                <CardDescription>
                  Generate visual infographic summaries of discussions using AI image models.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Preferred Backend</Label>
                  <select
                    value={config.infographic?.backend || ""}
                    onChange={(e) => {
                      const value = e.target.value as "openai" | "google" | "";
                      setConfig((prev) => ({
                        ...prev,
                        infographic: value ? { backend: value } : undefined,
                      }));
                      setSaved(false);
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Auto (prefer Google, then OpenAI)</option>
                    <option value="google">Google (Gemini)</option>
                    <option value="openai">OpenAI (gpt-image-1)</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <Separator />

      {/* Tools */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Tools</h2>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Document Conversion</CardTitle>
            </div>
            <CardDescription>
              markitdown — converts PDFs, Word, Excel, PowerPoint to text
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {markitdown === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : markitdown.installed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-500 font-medium">Installed</span>
                    {markitdown.version && (
                      <span className="text-muted-foreground font-mono text-xs">({markitdown.version})</span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground/60" />
                    <span className="text-muted-foreground">Not installed</span>
                  </>
                )}
              </div>
              {markitdown && !markitdown.installed && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isInstallingMarkitdown}
                  onClick={async () => {
                    setIsInstallingMarkitdown(true);
                    const result = await window.councilAPI.installMarkitdown();
                    setIsInstallingMarkitdown(false);
                    if (result.success) {
                      const check = await window.councilAPI.checkMarkitdown();
                      setMarkitdown(check);
                    }
                  }}
                  className="gap-1.5"
                >
                  {isInstallingMarkitdown ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing...</>
                  ) : (
                    "Install"
                  )}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[".pdf", ".docx", ".pptx", ".xlsx", ".epub", ".rtf"].map((ext) => (
                <Badge key={ext} variant="secondary" className="text-[11px] font-mono font-normal">
                  {ext}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Button onClick={handleSave} className="gap-2">
        {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save Configuration"}
      </Button>
    </div>
  );
}
