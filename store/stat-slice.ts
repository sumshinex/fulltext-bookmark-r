import { createSlice } from "@reduxjs/toolkit"
import type { IGPTAnswer } from "~lib/interface"

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
  GPTURL: string
  GPTKey: string
  GPTChatModel: string
  GPTEmbeddingModel: string
  GPTPromptTemplate: string
  GPTAvailableModels: string[]
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
    GPTURL: "",
    GPTKey: "",
    GPTChatModel: "gpt-3.5-turbo",
    GPTEmbeddingModel: "text-embedding-3-small",
    GPTPromptTemplate: defaultPromptTemplate,
    GPTAvailableModels: [],
    GPTQuery: "",
    GPTAnswer: null,
    GPTLoading: false,
    showAskGPT: true,
    firstOpenPopup: 0
  },
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
    setGPTURL: (state, action) => {
      state.GPTURL = action.payload
    },
    setGPTKey: (state, action) => {
      state.GPTKey = action.payload
    },
    setGPTChatModel: (state, action) => {
      state.GPTChatModel = action.payload
    },
    setGPTEmbeddingModel: (state, action) => {
      state.GPTEmbeddingModel = action.payload
    },
    setGPTPromptTemplate: (state, action) => {
      state.GPTPromptTemplate = action.payload
    },
    setGPTAvailableModels: (state, action) => {
      state.GPTAvailableModels = action.payload
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
  setGPTKey,
  setGPTURL,
  setGPTChatModel,
  setGPTEmbeddingModel,
  setGPTPromptTemplate,
  setGPTAvailableModels,
  setGPTQuery,
  setGPTAnswer,
  setGPTLoading,
  toggleShowAskGPT,
  setFirstOpenPopup
} = statSlice.actions

export default statSlice.reducer
