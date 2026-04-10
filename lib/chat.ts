import Api2d from "api2d"

let api
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

export function initApi(key, url, config?: {
  chatModel?: string
  embeddingModel?: string
  promptTemplate?: string
}) {
  const baseUrl = normalizeApiBaseUrl(url)
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
    const r = await api.embeddings({
      model: embeddingModel,
      input: message,
    })

    const a = r.data[0].embedding
    return a
  } catch (error) {
    throw new Error("embedding api error: " + error.message)
  }
}

export async function chat(message: string) {
  try {
    const res = await api.completion({
      model: chatModel,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      stream: false,
    })

    const a = res.choices[0].message.content
    return a
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
