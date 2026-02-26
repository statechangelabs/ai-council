import React from "react";
import { AlertTriangle, Folder } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../lib/utils";
import { BackendIcon } from "./BackendIcon";
import { CounsellorAvatar } from "./CounsellorAvatar";
import type { CounsellorSummary } from "../council-api";

interface CounsellorCardProps {
  counsellor: CounsellorSummary;
  issues: string[];
  onClick: () => void;
}

/** Shorten an absolute path by replacing the home directory with ~ */
function shortenPath(p: string): string {
  const home = typeof process !== "undefined" ? process.env.HOME : undefined;
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

export function CounsellorCard({ counsellor, issues, onClick }: CounsellorCardProps) {
  const hasIssues = issues.length > 0;

  const openInFinder = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.councilAPI.openInFinder(counsellor.dirPath);
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors",
        hasIssues
          ? "border-destructive/40 hover:border-destructive/60 hover:bg-destructive/5"
          : "hover:border-primary/50 hover:bg-accent/30",
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <button
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 font-mono truncate hover:text-muted-foreground transition-colors text-left"
          title={`${counsellor.dirPath}\nClick to reveal in Finder`}
          onClick={openInFinder}
        >
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate">{shortenPath(counsellor.dirPath)}</span>
        </button>
        <div className="flex items-start justify-between gap-2 mt-1">
          <div className="flex items-center gap-2">
            <CounsellorAvatar name={counsellor.name} avatarUrl={counsellor.avatarUrl} size={48} />
            <CardTitle className={cn(hasIssues && "text-destructive")}>{counsellor.name}</CardTitle>
            {counsellor.source && (
              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                {counsellor.source}
              </Badge>
            )}
          </div>
          {hasIssues && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
        </div>
        <CardDescription>{counsellor.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasIssues && (
          <div className="mb-3 space-y-1">
            {issues.map((issue, i) => (
              <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-destructive shrink-0" />
                {issue}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {counsellor.interests.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[11px] font-normal">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
          <BackendIcon backend={counsellor.backend} size={14} />
          {counsellor.backend}
          {counsellor.model ? ` · ${counsellor.model}` : ""}
          {counsellor.temperature != null ? ` · t=${counsellor.temperature}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
