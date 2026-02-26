import React, { useState } from "react";
import { Copy, Check, ChevronRight, FileText } from "lucide-react";

interface AttachmentCardProps {
  name: string;
  content: string;
}

function formatSize(content: string): string {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentCard({ name, content }: AttachmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-md border bg-background">
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{formatSize(content)}</span>
        <span className="ml-auto shrink-0" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
