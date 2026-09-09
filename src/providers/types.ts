export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  apiKey: string;
  model: string;
  system: string;
  maxTokens: number;
  signal: AbortSignal;
}

/** Every provider adapter reduces to this. Adding one is adding one file. */
export type Adapter = (
  messages: ChatMessage[],
  options: StreamOptions,
) => AsyncGenerator<string, void, unknown>;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
