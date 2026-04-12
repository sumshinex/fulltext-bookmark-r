import { createSlice } from "@reduxjs/toolkit"
import type { IGPTAnswer } from "~lib/interface"

export type EndpointCapability = "chat" | "embedding"

export interface EndpointModelOverrides {
  chat?: string
  embedding?: string
}

export interface ApiEndpoint {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  enabled: boolean
  capabilities: EndpointCapability[]
  modelOverrides?: EndpointModelOverrides
  notes?: string
}

export interface ModelDefaults {
  chat: string
  embedding: string
}

export interface EndpointBindings {
  chat: string[]
  embedding: string[]
}

export type WebdavAutoBackupMode = "daily_time" | "interval"

export interface WebdavConfig {
  baseUrl: string
  username: string
  password: string
  fileName: string
  autoBackupEnabled: boolean
  autoBackupMode: WebdavAutoBackupMode
  autoBackupTime: string
  autoBackupIntervalHours: number
  retentionCount: number
}

export type WebdavOperationStatus = "idle" | "success" | "error"

export interface WebdavStatus {
  lastBackupAt: number | null
  lastBackupFileName: string
  nextBackupAt: number | null
  lastOperationStatus: WebdavOperationStatus
  lastOperationMessage: string
}

export interface AppStat {
  searchEngineAdaption: boolean
  storeEveryPage: boolean
  bookmarkAdaption: boolean
  remoteStore: boolean
  remoteStoreURL: string
  remoteStoreKey: string
  showOnlyBookmarkedResults: boolean
  remoteStoreEveryPage: boolean
  tempPageExpireTime: number
  maxResults: number
  forbiddenURLs: string[]
  weiboSupport: boolean
  customSearchEngines: string
  gptEndpoints: ApiEndpoint[]
  gptBindings: EndpointBindings
  gptDefaultModels: ModelDefaults
  gptPromptTemplate: string
  gptAvailableModelsByEndpoint: Record<string, string[]>
  webdavConfig: WebdavConfig
  webdavStatus: WebdavStatus
  GPTQuery: string
  GPTAnswer: IGPTAnswer
  GPTLoading: boolean
  showAskGPT: boolean
  firstOpenPopup: number
  GPTSearchMaxNumber: number
}

export interface SettingsBackupData {
  searchEngineAdaption: boolean
  storeEveryPage: boolean
  bookmarkAdaption: boolean
  remoteStore: boolean
  remoteStoreURL: string
  showOnlyBookmarkedResults: boolean
  remoteStoreEveryPage: boolean
  tempPageExpireTime: number
  maxResults: number
  forbiddenURLs: string[]
  weiboSupport: boolean
  customSearchEngines: string
  gptEndpoints: ApiEndpoint[]
  gptBindings: EndpointBindings
  gptDefaultModels: ModelDefaults
  gptPromptTemplate: string
  webdavConfig: WebdavConfig
  showAskGPT: boolean
}

export interface SettingsBackupPayload {
  schemaVersion: number
  exportedAt: string
  source: string
  data: SettingsBackupData
}

export const SETTINGS_BACKUP_SCHEMA_VERSION = 1

const defaultPromptTemplate =
  "Given the following extracted parts of a long document and a question, create a final helpful answer with references('SOURCES'). If you don't know the answer, just say that you don't know. Don't try to make up an answer.ALWAYS return a 'SOURCES' part in your answer.Reply example: \n{your answer}\n===\nSOURCES:{sources}"

const defaultCustomSearchEngines = JSON.stringify(
  [
    {
      name: "DuckDuckGo",
      urlPattern: "^https://duckduckgo\\.com/.*[?&]q=.*",
      containerSelector: "#react-layout",
      queryParam: "q",
      insertPosition: "beforebegin"
    },
    {
      name: "Yandex",
      urlPattern: "^https://yandex\\.(com|ru)/search/.*",
      containerSelector: "#search-result",
      queryParam: "text",
      insertPosition: "prepend"
    }
  ],
  null,
  2
)

const defaultModelDefaults: ModelDefaults = {
  chat: "gpt-3.5-turbo",
  embedding: "text-embedding-3-small"
}

const defaultBindings: EndpointBindings = {
  chat: [],
  embedding: []
}

const defaultWebdavConfig: WebdavConfig = {
  baseUrl: "",
  username: "",
  password: "",
  fileName: "fulltext-bookmark-backup.json",
  autoBackupEnabled: false,
  autoBackupMode: "daily_time",
  autoBackupTime: "03:00",
  autoBackupIntervalHours: 24,
  retentionCount: 10
}

const defaultWebdavStatus: WebdavStatus = {
  lastBackupAt: null,
  lastBackupFileName: "",
  nextBackupAt: null,
  lastOperationStatus: "idle",
  lastOperationMessage: ""
}

export function getDefaultSettingsBackupData(): SettingsBackupData {
  return {
    searchEngineAdaption: true,
    storeEveryPage: true,
    bookmarkAdaption: true,
    remoteStore: false,
    remoteStoreURL: "",
    showOnlyBookmarkedResults: false,
    remoteStoreEveryPage: false,
    tempPageExpireTime: 60 * 60 * 24 * 60 * 1000,
    maxResults: 20,
    forbiddenURLs: [
      "https://www.google.com/*",
      "https://www.bing.com/*",
      "https://cn.bing.com/*",
      "https://www.baidu.com/*",
      "https://.*.something.com/*"
    ],
    weiboSupport: true,
    customSearchEngines: defaultCustomSearchEngines,
    gptEndpoints: [],
    gptBindings: defaultBindings,
    gptDefaultModels: defaultModelDefaults,
    gptPromptTemplate: defaultPromptTemplate,
    webdavConfig: defaultWebdavConfig,
    showAskGPT: true,
  }
}

export function buildSettingsBackupData(state: AppStat): SettingsBackupData {
  return {
    searchEngineAdaption: state.searchEngineAdaption,
    storeEveryPage: state.storeEveryPage,
    bookmarkAdaption: state.bookmarkAdaption,
    remoteStore: state.remoteStore,
    remoteStoreURL: state.remoteStoreURL,
    showOnlyBookmarkedResults: state.showOnlyBookmarkedResults,
    remoteStoreEveryPage: state.remoteStoreEveryPage,
    tempPageExpireTime: state.tempPageExpireTime,
    maxResults: state.maxResults,
    forbiddenURLs: [...state.forbiddenURLs],
    weiboSupport: state.weiboSupport,
    customSearchEngines: state.customSearchEngines,
    gptEndpoints: state.gptEndpoints.map((endpoint) => ({
      ...endpoint,
      capabilities: [...endpoint.capabilities],
      modelOverrides: endpoint.modelOverrides
        ? { ...endpoint.modelOverrides }
        : undefined,
    })),
    gptBindings: {
      chat: [...state.gptBindings.chat],
      embedding: [...state.gptBindings.embedding],
    },
    gptDefaultModels: { ...state.gptDefaultModels },
    gptPromptTemplate: state.gptPromptTemplate,
    webdavConfig: { ...state.webdavConfig },
    showAskGPT: state.showAskGPT,
  }
}

export function buildSettingsBackupPayload(state: AppStat): SettingsBackupPayload {
  return {
    schemaVersion: SETTINGS_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: "fulltext-bookmark-main",
    data: buildSettingsBackupData(state),
  }
}

export function normalizeSettingsBackupData(
  input:
    | (Omit<Partial<SettingsBackupData>, "gptBindings" | "gptDefaultModels" | "webdavConfig"> & {
        gptBindings?: Partial<EndpointBindings>
        gptDefaultModels?: Partial<ModelDefaults>
        webdavConfig?: Partial<WebdavConfig>
      })
    | undefined
): SettingsBackupData {
  const defaults = getDefaultSettingsBackupData()
  const gptEndpoints = Array.isArray(input?.gptEndpoints)
    ? input.gptEndpoints
        .filter((endpoint): endpoint is ApiEndpoint => Boolean(endpoint?.id))
        .map((endpoint) => ({
          ...endpoint,
          name: (endpoint.name || endpoint.id).trim(),
          baseUrl: (endpoint.baseUrl || "").trim(),
          apiKey: endpoint.apiKey || "",
          enabled: endpoint.enabled !== false,
          capabilities: Array.isArray(endpoint.capabilities)
            ? endpoint.capabilities.filter(
                (capability): capability is EndpointCapability =>
                  capability === "chat" || capability === "embedding"
              )
            : [],
          modelOverrides: endpoint.modelOverrides
            ? {
                ...(endpoint.modelOverrides.chat?.trim()
                  ? { chat: endpoint.modelOverrides.chat.trim() }
                  : {}),
                ...(endpoint.modelOverrides.embedding?.trim()
                  ? { embedding: endpoint.modelOverrides.embedding.trim() }
                  : {}),
              }
            : undefined,
        }))
        .filter((endpoint) => endpoint.capabilities.length > 0)
    : defaults.gptEndpoints

  const validEndpointIds = new Set(gptEndpoints.map((endpoint) => endpoint.id))
  const normalizeBindingIds = (ids: unknown) =>
    Array.isArray(ids)
      ? ids.filter(
          (id): id is string => typeof id === "string" && validEndpointIds.has(id)
        )
      : []

  return {
    searchEngineAdaption: input?.searchEngineAdaption ?? defaults.searchEngineAdaption,
    storeEveryPage: input?.storeEveryPage ?? defaults.storeEveryPage,
    bookmarkAdaption: input?.bookmarkAdaption ?? defaults.bookmarkAdaption,
    remoteStore: input?.remoteStore ?? defaults.remoteStore,
    remoteStoreURL: (input?.remoteStoreURL || defaults.remoteStoreURL).trim(),
    showOnlyBookmarkedResults:
      input?.showOnlyBookmarkedResults ?? defaults.showOnlyBookmarkedResults,
    remoteStoreEveryPage: input?.remoteStoreEveryPage ?? defaults.remoteStoreEveryPage,
    tempPageExpireTime:
      typeof input?.tempPageExpireTime === "number" && input.tempPageExpireTime >= 0
        ? input.tempPageExpireTime
        : defaults.tempPageExpireTime,
    maxResults:
      typeof input?.maxResults === "number" && input.maxResults > 0
        ? input.maxResults
        : defaults.maxResults,
    forbiddenURLs: Array.isArray(input?.forbiddenURLs)
      ? input.forbiddenURLs.filter(
          (url): url is string => typeof url === "string" && url.trim().length > 0
        )
      : defaults.forbiddenURLs,
    weiboSupport: input?.weiboSupport ?? defaults.weiboSupport,
    customSearchEngines: input?.customSearchEngines || defaults.customSearchEngines,
    gptEndpoints,
    gptBindings: {
      chat: normalizeBindingIds(input?.gptBindings?.chat),
      embedding: normalizeBindingIds(input?.gptBindings?.embedding),
    },
    gptDefaultModels: {
      chat: input?.gptDefaultModels?.chat?.trim() || defaults.gptDefaultModels.chat,
      embedding:
        input?.gptDefaultModels?.embedding?.trim() ||
        defaults.gptDefaultModels.embedding,
    },
    gptPromptTemplate: input?.gptPromptTemplate || defaults.gptPromptTemplate,
    webdavConfig: {
      ...defaults.webdavConfig,
      ...input?.webdavConfig,
      baseUrl: (input?.webdavConfig?.baseUrl || defaults.webdavConfig.baseUrl).trim(),
      username: (input?.webdavConfig?.username || defaults.webdavConfig.username).trim(),
      password: input?.webdavConfig?.password || defaults.webdavConfig.password,
      fileName:
        (input?.webdavConfig?.fileName || defaults.webdavConfig.fileName).trim() ||
        defaults.webdavConfig.fileName,
      autoBackupEnabled:
        input?.webdavConfig?.autoBackupEnabled ?? defaults.webdavConfig.autoBackupEnabled,
      autoBackupMode:
        input?.webdavConfig?.autoBackupMode === "interval" ? "interval" : "daily_time",
      autoBackupTime:
        (input?.webdavConfig?.autoBackupTime || defaults.webdavConfig.autoBackupTime).trim() ||
        defaults.webdavConfig.autoBackupTime,
      autoBackupIntervalHours: Math.max(
        1,
        input?.webdavConfig?.autoBackupIntervalHours ||
          defaults.webdavConfig.autoBackupIntervalHours
      ),
      retentionCount: Math.max(
        1,
        input?.webdavConfig?.retentionCount || defaults.webdavConfig.retentionCount
      ),
    },
    showAskGPT: input?.showAskGPT ?? defaults.showAskGPT,
  }
}

const removeEndpointFromBindings = (
  bindings: EndpointBindings,
  endpointId: string
): EndpointBindings => ({
  chat: bindings.chat.filter((id) => id !== endpointId),
  embedding: bindings.embedding.filter((id) => id !== endpointId)
})

const statSlice = createSlice({
  name: "stat",
  initialState: {
    GPTSearchMaxNumber: 10,
    searchEngineAdaption: true,
    storeEveryPage: true,
    bookmarkAdaption: true,
    remoteStore: false,
    showOnlyBookmarkedResults: false,
    remoteStoreEveryPage: false,
    remoteStoreURL: "",
    remoteStoreKey: "123",
    maxResults: 20,
    forbiddenURLs: [
      "https://www.google.com/*",
      "https://www.bing.com/*",
      "https://cn.bing.com/*",
      "https://www.baidu.com/*",
      "https://.*.something.com/*"
    ],
    weiboSupport: true,
    customSearchEngines: defaultCustomSearchEngines,
    tempPageExpireTime: 60 * 60 * 24 * 60 * 1000,
    gptEndpoints: [],
    gptBindings: defaultBindings,
    gptDefaultModels: defaultModelDefaults,
    gptPromptTemplate: defaultPromptTemplate,
    gptAvailableModelsByEndpoint: {},
    webdavConfig: defaultWebdavConfig,
    webdavStatus: defaultWebdavStatus,
    GPTQuery: "",
    GPTAnswer: null,
    GPTLoading: false,
    showAskGPT: true,
    firstOpenPopup: 0
  } as AppStat,
  reducers: {
    setFirstOpenPopup: (state) => {
      state.firstOpenPopup = state.firstOpenPopup + 1
    },
    toggleShowAskGPT: (state) => {
      state.showAskGPT = !state.showAskGPT
    },
    setGPTLoading: (state, action) => {
      state.GPTLoading = action.payload
    },
    setGPTQuery: (state, action) => {
      state.GPTQuery = action.payload
    },
    setGPTAnswer: (state, action) => {
      state.GPTAnswer = action.payload
    },
    addGptEndpoint: (state, action) => {
      state.gptEndpoints.push(action.payload)
    },
    replaceGptEndpoints: (state, action) => {
      state.gptEndpoints = action.payload
    },
    updateGptEndpoint: (state, action) => {
      const nextEndpoint = action.payload
      state.gptEndpoints = state.gptEndpoints.map((endpoint) =>
        endpoint.id === nextEndpoint.id ? nextEndpoint : endpoint
      )
    },
    removeGptEndpoint: (state, action) => {
      const endpointId = action.payload
      state.gptEndpoints = state.gptEndpoints.filter(
        (endpoint) => endpoint.id !== endpointId
      )
      state.gptBindings = removeEndpointFromBindings(state.gptBindings, endpointId)
      delete state.gptAvailableModelsByEndpoint[endpointId]
    },
    replaceAvailableModelsByEndpoint: (state, action) => {
      state.gptAvailableModelsByEndpoint = action.payload
    },
    clearAvailableModelsForAllEndpoints: (state) => {
      state.gptAvailableModelsByEndpoint = {}
    },
    toggleGptEndpointEnabled: (state, action) => {
      const endpointId = action.payload
      const endpoint = state.gptEndpoints.find((item) => item.id === endpointId)
      if (endpoint) {
        endpoint.enabled = !endpoint.enabled
      }
    },
    setGptBindings: (state, action) => {
      state.gptBindings = action.payload
    },
    setGptDefaultModels: (state, action) => {
      state.gptDefaultModels = action.payload
    },
    setGptPromptTemplate: (state, action) => {
      state.gptPromptTemplate = action.payload
    },
    setAvailableModelsForEndpoint: (state, action) => {
      state.gptAvailableModelsByEndpoint[action.payload.endpointId] = action.payload.models
    },
    setWebdavConfig: (state, action) => {
      state.webdavConfig = {
        ...state.webdavConfig,
        ...action.payload,
      }
    },
    setWebdavStatus: (state, action) => {
      state.webdavStatus = {
        ...state.webdavStatus,
        ...action.payload,
      }
    },
    toggleSearchEngineAdaption: (state) => {
      state.searchEngineAdaption = !state.searchEngineAdaption
    },
    toggleStoreEveryPage: (state) => {
      state.storeEveryPage = !state.storeEveryPage
    },
    toggleBookmarkAdaption: (state) => {
      state.bookmarkAdaption = !state.bookmarkAdaption
    },
    toggleRemoteStore: (state) => {
      state.remoteStore = !state.remoteStore
    },
    toggleShowOnlyBookmarkedResults: (state) => {
      state.showOnlyBookmarkedResults = !state.showOnlyBookmarkedResults
    },
    toggleRemoteStoreEveryPage: (state) => {
      state.remoteStoreEveryPage = !state.remoteStoreEveryPage
    },
    setRemoteStoreURL: (state, action) => {
      state.remoteStoreURL = action.payload
    },
    setRemoteStoreKey: (state, action) => {
      state.remoteStoreKey = action.payload
    },
    setTempPageExpireTime: (state, action) => {
      state.tempPageExpireTime = action.payload
    },
    setForbiddenURLs: (state, action) => {
      state.forbiddenURLs = action.payload
    },
    setCustomSearchEngines: (state, action) => {
      state.customSearchEngines = action.payload
    },
    setMaxResults: (state, action) => {
      state.maxResults = action.payload
    },
    toggleWeiboSupport: (state) => {
      state.weiboSupport = !state.weiboSupport
    }
  }
})

export const {
  toggleBookmarkAdaption,
  toggleSearchEngineAdaption,
  toggleStoreEveryPage,
  toggleRemoteStore,
  toggleShowOnlyBookmarkedResults,
  toggleRemoteStoreEveryPage,
  setRemoteStoreURL,
  setRemoteStoreKey,
  setTempPageExpireTime,
  setForbiddenURLs,
  setCustomSearchEngines,
  setMaxResults,
  toggleWeiboSupport,
  addGptEndpoint,
  replaceGptEndpoints,
  updateGptEndpoint,
  removeGptEndpoint,
  toggleGptEndpointEnabled,
  setGptBindings,
  setGptDefaultModels,
  setGptPromptTemplate,
  setAvailableModelsForEndpoint,
  replaceAvailableModelsByEndpoint,
  clearAvailableModelsForAllEndpoints,
  setWebdavConfig,
  setWebdavStatus,
  setGPTQuery,
  setGPTAnswer,
  setGPTLoading,
  toggleShowAskGPT,
  setFirstOpenPopup
} = statSlice.actions

export default statSlice.reducer
