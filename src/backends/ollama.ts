import { Ollama } from "ollama";
import type { BackendProvider, BackendConfig, ChatRequest, ChatResponse, ChatStreamChunk } from "./types.js";

export function createOllamaBackend(config: BackendConfig): BackendProvider {
  const client = new Ollama({
    host: config.baseUrl ?? "http://localhost:11434",
  });

  return {
    name: "ollama",
    defaultModel: "llama3.2",

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await client.chat({
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          ...request.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        options: {
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        },
      });

      return {
        content: response.message.content,
        tokenUsage:
          response.prompt_eval_count !== undefined
            ? {
                input: response.prompt_eval_count ?? 0,
                output: response.eval_count ?? 0,
              }
            : undefined,
      };
    },

    async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
      const response = await client.chat({
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          ...request.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        options: {
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        },
        stream: true,
      });

      let promptEvalCount: number | undefined;
      let evalCount: number | undefined;

      for await (const chunk of response) {
        if (chunk.message.content) {
          yield { delta: chunk.message.content };
        }
        if (chunk.done) {
          promptEvalCount = chunk.prompt_eval_count;
          evalCount = chunk.eval_count;
        }
      }

      yield {
        delta: "",
        tokenUsage:
          promptEvalCount !== undefined
            ? { input: promptEvalCount ?? 0, output: evalCount ?? 0 }
            : undefined,
      };
    },
  };
}
