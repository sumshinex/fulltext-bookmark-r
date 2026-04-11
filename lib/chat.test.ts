import { describe, expect, it, vi } from "vitest"
import {
  buildEmbeddingsUrl,
  buildModelsUrl,
  chat,
  executeWithEndpointFallback,
  genEmbedding,
  initApi,
  normalizeApiBaseUrl,
  resolveEndpointBinding,
  resolveModelForEndpoint,
  summarizeBindingFailures,
  type ApiEndpointConfig,
  type BindingResolutionInput,
} from "./chat"

describe("chat orchestration helpers", () => {
  it("normalizes base urls and derived models url", () => {
    expect(normalizeApiBaseUrl(" https://api.openai.com/v1/chat/completions ")).toBe(
      "https://api.openai.com/v1"
    )
    expect(buildModelsUrl("https://api.openai.com/v1/models")).toBe(
      "https://api.openai.com/v1/models"
    )
    expect(buildEmbeddingsUrl("https://api.openai.com/v1/embeddings")).toBe(
      "https://api.openai.com/v1/embeddings"
    )
  })

  it("posts embeddings to the embeddings endpoint directly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    initApi("test-key", "https://embedding.example.com/v1", {
      embeddingModel: "custom-embedding-model",
    })

    await expect(genEmbedding("hello")).resolves.toEqual([0.1, 0.2, 0.3])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://embedding.example.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "custom-embedding-model",
      input: "hello",
    })
  })

  it("posts chat completions directly and reads standard content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello back" } }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    initApi("chat-key", "https://chat.example.com/v1", {
      chatModel: "custom-chat-model",
    })

    await expect(chat("Say hello")).resolves.toBe("Hello back")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://chat.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer chat-key",
        }),
      })
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "custom-chat-model",
      messages: [{ role: "user", content: "Say hello" }],
      stream: false,
    })
  })

  it("resolves available endpoints for a capability binding chain", () => {
    const endpoints: ApiEndpointConfig[] = [
      {
        id: "ep-chat",
        name: "Chat Primary",
        baseUrl: "https://chat.example.com/v1",
        apiKey: "chat-key",
        enabled: true,
        capabilities: ["chat"],
      },
      {
        id: "ep-disabled",
        name: "Disabled",
        baseUrl: "https://disabled.example.com/v1",
        apiKey: "disabled-key",
        enabled: false,
        capabilities: ["chat"],
      },
      {
        id: "ep-embedding",
        name: "Embedding Only",
        baseUrl: "https://embedding.example.com/v1",
        apiKey: "embedding-key",
        enabled: true,
        capabilities: ["embedding"],
      },
    ]

    const input: BindingResolutionInput = {
      capability: "chat",
      endpoints,
      bindings: { chat: ["ep-chat", "ep-disabled", "ep-missing"], embedding: [] },
      defaultModels: { chat: "gpt-4o-mini", embedding: "text-embedding-3-small" },
    }

    const resolved = resolveEndpointBinding(input)

    expect(resolved.availableEndpoints).toEqual([
      {
        endpoint: endpoints[0],
        model: "gpt-4o-mini",
      },
    ])
    expect(resolved.configurationErrors).toEqual([
      "chat endpoint \"Disabled\" is disabled",
      "chat endpoint \"ep-missing\" does not exist",
    ])
  })

  it("prefers endpoint model overrides over defaults", () => {
    const endpoint: ApiEndpointConfig = {
      id: "ep-chat",
      name: "Chat Primary",
      baseUrl: "https://chat.example.com/v1",
      apiKey: "chat-key",
      enabled: true,
      capabilities: ["chat", "embedding"],
      modelOverrides: {
        chat: "gpt-4.1-mini",
      },
    }

    expect(
      resolveModelForEndpoint(endpoint, "chat", {
        chat: "gpt-4o-mini",
        embedding: "text-embedding-3-small",
      })
    ).toBe("gpt-4.1-mini")
    expect(
      resolveModelForEndpoint(endpoint, "embedding", {
        chat: "gpt-4o-mini",
        embedding: "text-embedding-3-small",
      })
    ).toBe("text-embedding-3-small")
  })

  it("summarizes binding failures in human readable format", () => {
    const summary = summarizeBindingFailures("embedding", [
      { endpointName: "endpoint-a", reason: "401 Unauthorized" },
      { endpointName: "endpoint-b", reason: "timeout" },
    ])

    expect(summary).toBe(
      "Embedding request failed: tried 2 endpoints\n1. endpoint-a - 401 Unauthorized\n2. endpoint-b - timeout"
    )
  })

  it("fails over to the next endpoint after a request error", async () => {
    const endpoints: ApiEndpointConfig[] = [
      {
        id: "ep-1",
        name: "Primary",
        baseUrl: "https://primary.example.com/v1",
        apiKey: "key-1",
        enabled: true,
        capabilities: ["chat"],
      },
      {
        id: "ep-2",
        name: "Backup",
        baseUrl: "https://backup.example.com/v1",
        apiKey: "key-2",
        enabled: true,
        capabilities: ["chat"],
      },
    ]

    const executor = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("ok")

    const result = await executeWithEndpointFallback(
      {
        capability: "chat",
        endpoints,
        bindings: { chat: ["ep-1", "ep-2"], embedding: [] },
        defaultModels: { chat: "gpt-4o-mini", embedding: "text-embedding-3-small" },
      },
      executor
    )

    expect(result).toBe("ok")
    expect(executor).toHaveBeenCalledTimes(2)
    expect(executor.mock.calls[0][0].endpoint.name).toBe("Primary")
    expect(executor.mock.calls[1][0].endpoint.name).toBe("Backup")
  })

  it("throws the first configuration error when no endpoint is available", async () => {
    const endpoints: ApiEndpointConfig[] = [
      {
        id: "ep-1",
        name: "Disabled Chat",
        baseUrl: "https://disabled.example.com/v1",
        apiKey: "key-1",
        enabled: false,
        capabilities: ["chat"],
      },
    ]

    await expect(
      executeWithEndpointFallback(
        {
          capability: "chat",
          endpoints,
          bindings: { chat: ["ep-1"], embedding: [] },
          defaultModels: { chat: "gpt-4o-mini", embedding: "text-embedding-3-small" },
        },
        vi.fn()
      )
    ).rejects.toThrow('chat endpoint "Disabled Chat" is disabled')
  })

  it("throws summarized error after all endpoints fail", async () => {
    const endpoints: ApiEndpointConfig[] = [
      {
        id: "ep-1",
        name: "Primary",
        baseUrl: "https://primary.example.com/v1",
        apiKey: "key-1",
        enabled: true,
        capabilities: ["embedding"],
      },
      {
        id: "ep-2",
        name: "Backup",
        baseUrl: "https://backup.example.com/v1",
        apiKey: "key-2",
        enabled: true,
        capabilities: ["embedding"],
      },
    ]

    await expect(
      executeWithEndpointFallback(
        {
          capability: "embedding",
          endpoints,
          bindings: { chat: [], embedding: ["ep-1", "ep-2"] },
          defaultModels: { chat: "gpt-4o-mini", embedding: "text-embedding-3-small" },
        },
        vi
          .fn()
          .mockRejectedValueOnce(new Error("401 Unauthorized"))
          .mockRejectedValueOnce(new Error("model not found"))
      )
    ).rejects.toThrow(
      "Embedding request failed: tried 2 endpoints\n1. Primary - 401 Unauthorized\n2. Backup - model not found"
    )
  })
})
