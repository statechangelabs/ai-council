import Anthropic from "@anthropic-ai/sdk";
import type { BackendProvider, BackendConfig, ChatRequest, ChatResponse, ChatStreamChunk } from "./types.js";

export function createAnthropicBackend(config: BackendConfig): BackendProvider {
  const client = new Anthropic({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  return {
    name: "anthropic",
    defaultModel: "claude-sonnet-4-5-20250929",

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await client.messages.create({
        model: request.model,
        max_tokens: 4096,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      });

      const textBlock = response.content.find((b) => b.type === "text");
      return {
        content: textBlock?.text ?? "",
        tokenUsage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    },

    async *chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
      const stream = client.messages.stream({
        model: request.model,
        max_tokens: 4096,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { delta: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        delta: "",
        tokenUsage: {
          input: finalMessage.usage.input_tokens,
          output: finalMessage.usage.output_tokens,
        },
      };
    },
  };
}
