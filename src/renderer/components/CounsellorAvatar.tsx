import React, { useState } from "react";
import { cn } from "../lib/utils";

const bgPalette = [
  "bg-blue-500",
  "bg-orange-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-yellow-500",
  "bg-cyan-500",
];

/** Strip a leading article ("The", "A", "An") to get a meaningful initial. */
function getInitial(name: string): string {
  const stripped = name.replace(/^(the|a|an)\s+/i, "");
  return (stripped[0] || name[0] || "?").toUpperCase();
}

/** Deterministic color index based on name. */
function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgPalette[Math.abs(hash) % bgPalette.length];
}

interface CounsellorAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}

export function CounsellorAvatar({ name, avatarUrl, size = 24, className }: CounsellorAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClass = size <= 16 ? "w-4 h-4 text-[9px]"
    : size <= 24 ? "w-6 h-6 text-xs"
    : size <= 32 ? "w-8 h-8 text-sm"
    : size <= 40 ? "w-10 h-10 text-base"
    : "w-12 h-12 text-lg";

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        onError={() => setImgError(true)}
        className={cn("rounded-full object-cover", sizeClass, className)}
        alt=""
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0",
        sizeClass,
        colorForName(name),
        className,
      )}
    >
      {getInitial(name)}
    </div>
  );
}
