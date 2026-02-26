import React, { useState, useCallback } from "react";
import { X, FileText, Paperclip, AlertTriangle, Loader2 } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { cn } from "../lib/utils";

export interface Attachment {
  id: string;
  name: string;
  content: string;
  type: "file" | "paste";
}

interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  markitdownMissing?: boolean;
  onInstallMarkitdown?: () => void;
  isInstallingMarkitdown?: boolean;
}

const LARGE_PASTE_THRESHOLD = 1000;

const RICH_DOC_EXTENSIONS = new Set([
  ".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".doc", ".ppt", ".epub", ".rtf",
]);

export function TopicInput({
  value,
  onChange,
  disabled,
  attachments,
  onAttachmentsChange,
  markitdownMissing,
  onInstallMarkitdown,
  isInstallingMarkitdown,
}: TopicInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const addAttachment = useCallback(
    (att: Attachment) => {
      onAttachmentsChange([...attachments, att]);
    },
    [attachments, onAttachmentsChange],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      onAttachmentsChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onAttachmentsChange],
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        // In Electron, dropped files have a .path property
        const filePath = (file as File & { path?: string }).path;
        if (!filePath) continue;
        try {
          const result = await window.councilAPI.readFileAsText(filePath);
          addAttachment({
            id: crypto.randomUUID(),
            name: result.name,
            content: result.content,
            type: "file",
          });
        } catch {
          addAttachment({
            id: crypto.randomUUID(),
            name: file.name,
            content: `[Error reading file: ${file.name}]`,
            type: "file",
          });
        }
      }
    },
    [addAttachment],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;

      // Check for files in clipboard
      if (e.clipboardData.files.length > 0) {
        e.preventDefault();
        handleFiles(e.clipboardData.files);
        return;
      }

      // Check for large text paste
      const text = e.clipboardData.getData("text/plain");
      if (text.length > LARGE_PASTE_THRESHOLD) {
        e.preventDefault();
        const pasteCount = attachments.filter((a) => a.type === "paste").length;
        addAttachment({
          id: crypto.randomUUID(),
          name: pasteCount === 0 ? "Pasted text" : `Pasted text (${pasteCount + 1})`,
          content: text,
          type: "paste",
        });
      }
      // Short text: normal paste behavior (no preventDefault)
    },
    [disabled, attachments, addAttachment, handleFiles],
  );

  const formatSize = (content: string) => {
    const chars = content.length;
    if (chars < 1000) return `${chars} chars`;
    if (chars < 1_000_000) return `${(chars / 1000).toFixed(1)}k chars`;
    return `${(chars / 1_000_000).toFixed(1)}M chars`;
  };

  return (
    <div
      className={cn(
        "relative rounded-md transition-colors",
        isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        disabled={disabled}
        placeholder="What should the council discuss? Drop files or paste large text to attach."
        className="resize-none min-h-[160px]"
      />

      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 rounded-md border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <Paperclip className="h-5 w-5" />
            Drop files here
          </div>
        </div>
      )}

      {/* Attachment pills */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border text-xs font-medium text-muted-foreground"
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[200px]">{att.name}</span>
              <span className="text-muted-foreground/60">{formatSize(att.content)}</span>
              {!disabled && (
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Markitdown install banner */}
      {markitdownMissing &&
        attachments.some((a) => {
          const ext = a.name.includes(".") ? "." + a.name.split(".").pop()!.toLowerCase() : "";
          return RICH_DOC_EXTENSIONS.has(ext);
        }) && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {isInstallingMarkitdown ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Installing markitdown...
            </span>
          ) : (
            <span>
              markitdown is needed to read PDFs and Office docs.{" "}
              <button
                onClick={onInstallMarkitdown}
                className="font-semibold underline underline-offset-2 hover:text-yellow-700 dark:hover:text-yellow-300"
              >
                Install now
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
