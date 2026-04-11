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

const defaultPromptTemplate =
  "Given the following extracted parts of a long document and a question, create a final helpful answer with references('SOURCES'). If you don't know the answer, just say that you don't know. Don't try to make up an answer.ALWAYS return a 'SOURCES' part in your answer.Reply example: \n{your answer}\n===\nSOURCES:{sources}"

const defaultCustomSearchEngines = JSON.stringify(
  [
    {
      name: "DuckDuckGo",
      urlPattern: "^https://duckduckgo\\.com/.*",
      containerSelector: "#links",
      queryParam: "q",
      insertPosition: "prepend"
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
  updateGptEndpoint,
  removeGptEndpoint,
  toggleGptEndpointEnabled,
  setGptBindings,
  setGptDefaultModels,
  setGptPromptTemplate,
  setAvailableModelsForEndpoint,
  setWebdavConfig,
  setWebdavStatus,
  setGPTQuery,
  setGPTAnswer,
  setGPTLoading,
  toggleShowAskGPT,
  setFirstOpenPopup
} = statSlice.actions

export default statSlice.reducer
