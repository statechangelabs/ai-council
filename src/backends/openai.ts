import OpenAI from "openai";
import type { BackendProvider, BackendConfig, ChatRequest, ChatResponse, ChatStreamChunk } from "./types.js";

export function createOpenAIBackend(config: BackendConfig): BackendProvider {
  const client = new OpenAI({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  return {
    name: "openai",
    defaultModel: "gpt-4o",

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await client.chat.completions.create({
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          ...request.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      });

      const choice = response.choices[0];
      return {
        content: choice?.message?.content ?? "",
        tokenUsage: response.usage
          ? { input: response.usage.prompt_tokens, output: response.usage.completion_tokens }
          : undefined,
      };
    },

    async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
      const stream = await client.chat.completions.create({
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          ...request.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { delta };
        }
        if (chunk.usage) {
          yield {
            delta: "",
            tokenUsage: {
              input: chunk.usage.prompt_tokens,
              output: chunk.usage.completion_tokens,
            },
          };
        }
      }
    },
  };
}
