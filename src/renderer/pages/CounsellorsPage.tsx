import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, FolderPlus, AlertTriangle, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CounsellorCard } from "../components/CounsellorCard";
import { CounsellorForm } from "../components/CounsellorForm";
import { AddCounsellorDialog } from "../components/AddCounsellorDialog";
import { getCounsellorIssues } from "../lib/counsellor-issues";
import type { CounsellorSummary } from "../council-api";
import type { CouncilConfig } from "../../types";

export function CounsellorsPage() {
  const [counsellors, setCounsellors] = useState<CounsellorSummary[]>([]);
  const [config, setConfig] = useState<CouncilConfig>({ backends: {} });
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ dirPath: string | null; isNew: boolean } | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [councilDir, setCouncilDir] = useState<string>("./council");

  const reload = useCallback(async () => {
    const dir = await window.councilAPI.getCouncilDir();
    setCouncilDir(dir);
    const [list, configResult] = await Promise.all([
      window.councilAPI.listCounsellors(dir),
      window.councilAPI.getConfig(),
    ]);
    setCounsellors(list);
    setConfig(configResult.config);
    setEnvStatus(configResult.envStatus);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = async (dirPath: string | null, id: string, aboutMd: string) => {
    if (editing?.isNew) {
      await window.councilAPI.createCounsellor(councilDir, id, aboutMd);
    } else if (dirPath) {
      await window.councilAPI.saveCounsellor(dirPath, aboutMd);
    }
    setEditing(null);
    reload();
  };

  const handleDelete = async (dirPath: string) => {
    // Check if this is a registered counsellor — unregister instead of deleting
    const c = counsellors.find((x) => x.dirPath === dirPath);
    if (c?.source) {
      await window.councilAPI.registryRemove(c.id, c.source === "git");
    } else {
      await window.councilAPI.deleteCounsellor(dirPath);
    }
    setEditing(null);
    reload();
  };

  // Detail view — full page
  if (editing) {
    return (
      <CounsellorForm
        dirPath={editing.dirPath}
        isNew={editing.isNew}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setEditing(null)}
      />
    );
  }

  // List view
  const issueCount = counsellors.reduce(
    (sum, c) => sum + getCounsellorIssues(c, config, envStatus).length, 0,
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return counsellors;
    const q = search.toLowerCase();
    return counsellors.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [counsellors, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-6 pb-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Counsellors</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your council members</p>
          </div>
          <div className="flex items-center gap-3">
            {issueCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{issueCount} {issueCount === 1 ? "issue" : "issues"}</span>
              </div>
            )}
            <Button variant="outline" onClick={() => setShowAddDialog(true)} className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Add Counsellor
            </Button>
            <Button onClick={() => setEditing({ dirPath: null, isNew: true })} className="gap-2">
              <Plus className="h-4 w-4" />
              New Counsellor
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, id, or description..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {counsellors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 gap-2">
            <p className="text-sm">No counsellors found in {councilDir}/</p>
            <Button variant="outline" size="sm" onClick={() => setEditing({ dirPath: null, isNew: true })}>
              Create your first counsellor
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 gap-2">
            <Search className="h-8 w-8" />
            <p className="text-sm">No counsellors match "{search}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
            {filtered.map((c) => (
              <CounsellorCard
                key={c.id}
                counsellor={c}
                issues={getCounsellorIssues(c, config, envStatus)}
                onClick={() => setEditing({ dirPath: c.dirPath, isNew: false })}
              />
            ))}
          </div>
        )}
      </div>

      {showAddDialog && (
        <AddCounsellorDialog
          onClose={() => setShowAddDialog(false)}
          onAdded={() => { reload(); }}
        />
      )}
    </div>
  );
}
