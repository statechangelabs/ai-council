import React, { useState } from "react";
import { X, FolderOpen, Globe, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface AddCounsellorDialogProps {
  onClose: () => void;
  onAdded: () => void;
}

type Tab = "local" | "git";

export function AddCounsellorDialog({ onClose, onAdded }: AddCounsellorDialogProps) {
  const [tab, setTab] = useState<Tab>("local");
  const [localPath, setLocalPath] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleBrowse = async () => {
    const dir = await window.councilAPI.selectDirectory();
    if (dir) setLocalPath(dir);
  };

  const handleAdd = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (tab === "local") {
        if (!localPath) {
          setError("Please select a directory");
          setLoading(false);
          return;
        }
        const result = await window.councilAPI.registryAddLocal(localPath);
        setSuccess(`Registered: ${result.id} — ${result.name}`);
      } else {
        if (!gitUrl) {
          setError("Please enter a git URL");
          setLoading(false);
          return;
        }
        const results = await window.councilAPI.registryAddRemote(gitUrl);
        const names = results.map((r) => `${r.id} — ${r.name}`).join(", ");
        setSuccess(`Registered ${results.length}: ${names}`);
      }
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Counsellor</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <button
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === "local" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setTab("local"); setError(null); setSuccess(null); }}
            >
              <FolderOpen className="h-4 w-4" />
              Local Path
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === "git" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setTab("git"); setError(null); setSuccess(null); }}
            >
              <Globe className="h-4 w-4" />
              Git URL
            </button>
          </div>

          {/* Local path tab */}
          {tab === "local" && (
            <div className="space-y-2">
              <Label>Counsellor Directory</Label>
              <div className="flex gap-2">
                <Input
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/path/to/counsellor"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowse}>
                  Browse
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Directory must contain an ABOUT.md file
              </p>
            </div>
          )}

          {/* Git URL tab */}
          {tab === "git" && (
            <div className="space-y-2">
              <Label>Git Repository URL</Label>
              <Input
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://github.com/user/counsellor.git"
              />
              <p className="text-xs text-muted-foreground">
                Will be cloned to ~/.ai-council/counsellors/
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
