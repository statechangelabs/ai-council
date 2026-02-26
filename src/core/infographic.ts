import { createRequire } from "node:module";
import type { ConversationResult, CouncilConfig } from "../types.js";

const require = createRequire(import.meta.url);

function buildPrompt(result: ConversationResult): string {
  const names = result.counsellors.map((c) => c.name).join(", ");
  const summary = result.summary ?? result.turns.map((t) => `${t.counsellorName}: ${t.content.slice(0, 200)}`).join("\n");

  return [
    "Create a professional infographic summarizing a panel discussion.",
    `Topic: ${result.topic.slice(0, 300)}`,
    `Key points: ${summary.slice(0, 1500)}`,
    `Panelists: ${names}`,
    "Use a clean, modern design with sections for convergence points, divergence points, and key takeaways.",
    "Include relevant icons and visual hierarchy. Use a horizontal landscape layout.",
  ].join(" ");
}

export type ImageBackend = "openai" | "google";

function detectBackend(config: CouncilConfig): ImageBackend | null {
  if (config.infographic?.backend) return config.infographic.backend;

  const hasGoogle = !!(config.backends.google?.apiKey || process.env.GOOGLE_API_KEY);
  const hasOpenai = !!(config.backends.openai?.apiKey || process.env.OPENAI_API_KEY);

  if (hasGoogle) return "google";
  if (hasOpenai) return "openai";
  return null;
}

async function generateViaOpenAI(prompt: string, config: CouncilConfig): Promise<string> {
  const OpenAI = require("openai").default;
  const client = new OpenAI({
    apiKey: config.backends.openai?.apiKey || process.env.OPENAI_API_KEY,
    ...(config.backends.openai?.baseUrl ? { baseURL: config.backends.openai.baseUrl } : {}),
  });

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    quality: "high",
    size: "1536x1024",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned from OpenAI");
  return b64;
}

async function generateViaGoogle(prompt: string, config: CouncilConfig): Promise<string> {
  const { GoogleGenAI } = require("@google/genai");
  const apiKey = config.backends.google?.apiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("No Google API key configured");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No response parts from Gemini");

  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }

  throw new Error("No image data in Gemini response");
}

export async function generateInfographic(
  result: ConversationResult,
  config: CouncilConfig,
  backendOverride?: ImageBackend,
): Promise<string> {
  const backend = backendOverride ?? detectBackend(config);
  if (!backend) throw new Error("No image-capable backend configured (need OpenAI or Google API key)");

  const prompt = buildPrompt(result);

  if (backend === "openai") {
    return generateViaOpenAI(prompt, config);
  } else {
    return generateViaGoogle(prompt, config);
  }
}

export function hasImageBackend(config: CouncilConfig): boolean {
  return detectBackend(config) !== null;
}
