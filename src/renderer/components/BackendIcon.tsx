import React from "react";
import Anthropic from "@lobehub/icons/es/Anthropic";
import OpenAI from "@lobehub/icons/es/OpenAI";
import Google from "@lobehub/icons/es/Google";
import Ollama from "@lobehub/icons/es/Ollama";

const iconMap: Record<string, React.ComponentType<{ size?: string | number }>> = {
  anthropic: Anthropic,
  openai: OpenAI,
  google: Google,
  ollama: Ollama,
};

interface BackendIconProps {
  backend: string;
  size?: string | number;
  className?: string;
}

export function BackendIcon({ backend, size = "1em", className }: BackendIconProps) {
  const Icon = iconMap[backend.toLowerCase()];
  if (!Icon) return null;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center" }}>
      <Icon size={size} />
    </span>
  );
}
