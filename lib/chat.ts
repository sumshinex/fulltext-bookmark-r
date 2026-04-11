import Api2d from "api2d"
import type {
  ApiEndpoint,
  EndpointBindings,
  EndpointCapability,
  ModelDefaults,
} from "~store/stat-slice"

export type ApiEndpointConfig = ApiEndpoint

export interface BindingResolutionInput {
  capability: EndpointCapability
  endpoints: ApiEndpointConfig[]
  bindings: EndpointBindings
  defaultModels: ModelDefaults
}

export interface ResolvedEndpoint {
  endpoint: ApiEndpointConfig
  model: string
}

export interface BindingResolutionResult {
  availableEndpoints: ResolvedEndpoint[]
  configurationErrors: string[]
}

export interface BindingFailureSummaryItem {
  endpointName: string
  reason: string
}

export async function executeWithEndpointFallback<T>(
  input: BindingResolutionInput,
  executor: (resolved: ResolvedEndpoint) => Promise<T>
) {
  const { availableEndpoints, configurationErrors } = resolveEndpointBinding(input)

  if (availableEndpoints.length === 0) {
    throw new Error(
      configurationErrors[0] ||
        `${input.capability} binding has no available endpoints`
    )
  }

  const failures: BindingFailureSummaryItem[] = []

  for (const resolved of availableEndpoints) {
    try {
      return await executor(resolved)
    } catch (error) {
      failures.push({
        endpointName: resolved.endpoint.name,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw new Error(summarizeBindingFailures(input.capability, failures))
}

let api
let apiKey = ""
let apiBaseUrl = ""
let chatModel = "gpt-3.5-turbo"
let embeddingModel = "text-embedding-3-small"
let promptTemplate =
  "Given the following extracted parts of a long document and a question, create a final helpful answer with references('SOURCES'). If you don't know the answer, just say that you don't know. Don't try to make up an answer.ALWAYS return a 'SOURCES' part in your answer.Reply example: \n{your answer}\n===\nSOURCES:{sources}"

export function normalizeApiBaseUrl(url: string) {
  if (!url) {
    return ""
  }

  return url
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(chat\/completions|embeddings|models)$/, "")
}

export function buildModelsUrl(url: string) {
  const baseUrl = normalizeApiBaseUrl(url)
  return baseUrl ? `${baseUrl}/models` : ""
}

export function buildChatCompletionUrl(url: string) {
  const baseUrl = normalizeApiBaseUrl(url)
  return baseUrl ? `${baseUrl}/chat/completions` : ""
}

export function buildEmbeddingsUrl(url: string) {
  const baseUrl = normalizeApiBaseUrl(url)
  return baseUrl ? `${baseUrl}/embeddings` : ""
}

export function resolveModelForEndpoint(
  endpoint: ApiEndpointConfig,
  capability: EndpointCapability,
  defaultModels: ModelDefaults
) {
  const override = endpoint.modelOverrides?.[capability]
  return override || defaultModels[capability]
}

export function resolveEndpointBinding(
  input: BindingResolutionInput
): BindingResolutionResult {
  const bindingIds = input.bindings[input.capability] || []
  const configurationErrors: string[] = []
  const availableEndpoints: ResolvedEndpoint[] = []

  bindingIds.forEach((endpointId) => {
    const endpoint = input.endpoints.find((item) => item.id === endpointId)

    if (!endpoint) {
      configurationErrors.push(
        `${input.capability} endpoint \"${endpointId}\" does not exist`
      )
      return
    }

    if (!endpoint.enabled) {
      configurationErrors.push(
        `${input.capability} endpoint \"${endpoint.name}\" is disabled`
      )
      return
    }

    if (!endpoint.capabilities.includes(input.capability)) {
      configurationErrors.push(
        `${input.capability} endpoint \"${endpoint.name}\" does not support ${input.capability}`
      )
      return
    }

    if (!endpoint.baseUrl?.trim()) {
      configurationErrors.push(
        `${input.capability} endpoint \"${endpoint.name}\" is missing base URL`
      )
      return
    }

    if (!endpoint.apiKey?.trim()) {
      configurationErrors.push(
        `${input.capability} endpoint \"${endpoint.name}\" is missing API key`
      )
      return
    }

    const model = resolveModelForEndpoint(
      endpoint,
      input.capability,
      input.defaultModels
    )

    if (!model?.trim()) {
      configurationErrors.push(
        `${input.capability} endpoint \"${endpoint.name}\" has no resolved model`
      )
      return
    }

    availableEndpoints.push({ endpoint, model })
  })

  return {
    availableEndpoints,
    configurationErrors,
  }
}

export function summarizeBindingFailures(
  capability: EndpointCapability,
  failures: BindingFailureSummaryItem[]
) {
  const capabilityName = capability === "chat" ? "Chat" : "Embedding"
  const lines = failures.map(
    (failure, index) => `${index + 1}. ${failure.endpointName} - ${failure.reason}`
  )

  return `${capabilityName} request failed: tried ${failures.length} endpoints${
    lines.length ? `\n${lines.join("\n")}` : ""
  }`
}

export function initApi(
  key,
  url,
  config?: {
    chatModel?: string
    embeddingModel?: string
    promptTemplate?: string
  }
) {
  const baseUrl = normalizeApiBaseUrl(url)
  apiKey = key
  apiBaseUrl = baseUrl
  api = new Api2d(key, baseUrl)
  api.setTimeout(1000 * 30)
  chatModel = config?.chatModel || chatModel
  embeddingModel = config?.embeddingModel || embeddingModel
  promptTemplate = config?.promptTemplate || promptTemplate
}

export async function fetchAvailableModels(key: string, url: string) {
  try {
    const response = await fetch(buildModelsUrl(url), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || response.statusText || "Request failed")
    }
    return Array.isArray(data?.data)
      ? data.data.map((item) => item.id).filter(Boolean)
      : Array.isArray(data?.models)
        ? data.models.map((item) => item.id || item).filter(Boolean)
        : []
  } catch (error) {
    throw new Error("list models api error: " + error.message)
  }
}

export async function genEmbedding(message: string) {
  try {
    const response = await fetch(buildEmbeddingsUrl(apiBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: message,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || response.statusText || "Request failed")
    }

    const embedding = data?.data?.[0]?.embedding
    if (!Array.isArray(embedding)) {
      throw new Error("response missing embedding vector")
    }

    return embedding
  } catch (error) {
    throw new Error("embedding api error: " + error.message)
  }
}

export async function chat(message: string) {
  try {
    const response = await fetch(buildChatCompletionUrl(apiBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chatModel,
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
        stream: false,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || response.statusText || "Request failed")
    }

    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.message?.content ??
      data?.response

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("response missing chat content")
    }

    return content
  } catch (error) {
    throw new Error("chat api error: " + error.message)
  }
}

export async function chatWithRefs(message: string, sources) {
  let temp = promptTemplate + "\n===\nQUESTION: " + message
  sources.forEach((a) => {
    temp = temp + "\n===\nContent: " + a.content + "\nSource: " + a.source
  })
  return chat(temp)
}
