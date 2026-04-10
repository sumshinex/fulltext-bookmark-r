import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  AppStat,
  setCustomSearchEngines,
  setForbiddenURLs,
  setGPTAvailableModels,
  setGPTChatModel,
  setGPTEmbeddingModel,
  setGPTKey,
  setGPTPromptTemplate,
  setGPTURL,
  setMaxResults,
  setRemoteStoreURL,
  setTempPageExpireTime,
  toggleBookmarkAdaption,
  toggleRemoteStore,
  toggleRemoteStoreEveryPage,
  toggleSearchEngineAdaption,
  toggleShowAskGPT,
  toggleShowOnlyBookmarkedResults,
  toggleStoreEveryPage,
  toggleWeiboSupport
} from '~store/stat-slice'
import { validateCustomSearchEngines } from '~lib/utils'

export const useSettingsState = () => {
  const dispatch = useDispatch()

  const searchEngineAdaption = useSelector(
    (state: AppStat) => state.searchEngineAdaption
  )
  const bookmarkAdaption = useSelector(
    (state: AppStat) => state.bookmarkAdaption
  )
  const storeEveryPage = useSelector((state: AppStat) => state.storeEveryPage)
  const showOnlyBookmarkedResults = useSelector(
    (state: AppStat) => state.showOnlyBookmarkedResults
  )
  const remoteStore = useSelector((state: AppStat) => state.remoteStore)
  const remoteStoreURL = useSelector((state: AppStat) => state.remoteStoreURL)
  const tempPageExpireTime = useSelector(
    (state: AppStat) => state.tempPageExpireTime
  )
  const remoteStoreEveryPage = useSelector(
    (state: AppStat) => state.remoteStoreEveryPage
  )
  const forbiddenURLs = useSelector((state: AppStat) => state.forbiddenURLs)
  const customSearchEngines = useSelector((state: AppStat) => state.customSearchEngines)
  const maxResults = useSelector((state: AppStat) => state.maxResults)
  const weiboSupport = useSelector((state: AppStat) => state.weiboSupport)
  const GPTKey = useSelector((state: AppStat) => state.GPTKey)
  const GPTURL = useSelector((state: AppStat) => state.GPTURL)
  const GPTChatModel = useSelector((state: AppStat) => state.GPTChatModel)
  const GPTEmbeddingModel = useSelector((state: AppStat) => state.GPTEmbeddingModel)
  const GPTPromptTemplate = useSelector((state: AppStat) => state.GPTPromptTemplate)
  const GPTAvailableModels = useSelector((state: AppStat) => state.GPTAvailableModels)
  const showAskGPT = useSelector((state: AppStat) => state.showAskGPT)

  const [navPage, setNavPage] = useState(0)
  const [tempGPTURL, setTempGPTURL] = useState(GPTURL)
  const [tempGPTKey, setTempGPTKey] = useState(GPTKey)
  const [tempGPTChatModel, setTempGPTChatModel] = useState(GPTChatModel)
  const [tempGPTEmbeddingModel, setTempGPTEmbeddingModel] = useState(GPTEmbeddingModel)
  const [tempGPTPromptTemplate, setTempGPTPromptTemplate] = useState(GPTPromptTemplate)
  const [tempPageExpireTimeInDays, setTempPageExpireTimeInDays] = useState(
    tempPageExpireTime / 1000 / 60 / 60 / 24
  )
  const [tempMaxResults, setTempMaxResults] = useState(maxResults)
  const [tempForbiddenURLs, setTempForbiddenURLs] = useState(
    forbiddenURLs.join("\n")
  )
  const [tempCustomSearchEngines, setTempCustomSearchEngines] = useState(customSearchEngines)
  const [customSearchEnginesError, setCustomSearchEnginesError] = useState(
    validateCustomSearchEngines(customSearchEngines)
  )
  const [tempRemoteStoreURL, setTempRemoteStoreURL] = useState(remoteStoreURL)

  const handleGPTURLChange = (e) => {
    setTempGPTURL(e.target.value)
  }

  const handleBlurGPTURL = () => {
    dispatch(setGPTURL(tempGPTURL))
  }

  const handleGPTKeyChange = (e) => {
    setTempGPTKey(e.target.value)
  }

  const handleBlurGPTKey = () => {
    dispatch(setGPTKey(tempGPTKey))
  }

  const handleGPTChatModelChange = (e) => {
    setTempGPTChatModel(e.target.value)
  }

  const handleBlurGPTChatModel = () => {
    dispatch(setGPTChatModel(tempGPTChatModel))
  }

  const handleGPTEmbeddingModelChange = (e) => {
    setTempGPTEmbeddingModel(e.target.value)
  }

  const handleBlurGPTEmbeddingModel = () => {
    dispatch(setGPTEmbeddingModel(tempGPTEmbeddingModel))
  }

  const handleGPTPromptTemplateChange = (e) => {
    setTempGPTPromptTemplate(e.target.value)
  }

  const handleBlurGPTPromptTemplate = () => {
    dispatch(setGPTPromptTemplate(tempGPTPromptTemplate))
  }

  const handleGPTAvailableModelsChange = (models: string[]) => {
    dispatch(setGPTAvailableModels(models))
  }

  const handlePageExpireTimeChange = (e) => {
    if (e.target.value === "") {
      // @ts-ignore
      setTempPageExpireTimeInDays("")
      return
    }

    const value = parseInt(e.target.value)
    setTempPageExpireTimeInDays(value)
  }

  const handlePageExpireTimeSubmit = () => {
    if (
      !tempPageExpireTimeInDays ||
      typeof tempPageExpireTimeInDays !== "number" ||
      tempPageExpireTimeInDays < 0 ||
      tempPageExpireTimeInDays > 365 * 100
    ) {
      setTempPageExpireTimeInDays(60)
      dispatch(setTempPageExpireTime(60 * 1000 * 60 * 60 * 24))
      return
    }

    dispatch(
      setTempPageExpireTime(tempPageExpireTimeInDays * 1000 * 60 * 60 * 24)
    )
  }

  const handleMaxResultsChange = (e) => {
    if (e.target.value === "") {
      // @ts-ignore
      setTempMaxResults("")
      return
    }

    const value = parseInt(e.target.value)
    setTempMaxResults(value)
  }

  const handleMaxResultsSubmit = () => {
    if (
      !tempMaxResults ||
      typeof tempMaxResults !== "number" ||
      tempMaxResults < 0 ||
      tempMaxResults > 100
    ) {
      setTempMaxResults(20)
      dispatch(setMaxResults(20))
      return
    }

    dispatch(setMaxResults(tempMaxResults))
  }

  const handleForbiddenURLsChange = (e) => {
    setTempForbiddenURLs(e.target.value)
  }

  const handleBlurForbiddenURLs = () => {
    dispatch(setForbiddenURLs(tempForbiddenURLs.split("\n").filter((x) => x)))
  }

  const handleCustomSearchEnginesChange = (e) => {
    const nextValue = e.target.value
    setTempCustomSearchEngines(nextValue)
    setCustomSearchEnginesError(validateCustomSearchEngines(nextValue))
  }

  const handleBlurCustomSearchEngines = () => {
    const validationError = validateCustomSearchEngines(tempCustomSearchEngines)
    setCustomSearchEnginesError(validationError)
    if (validationError) {
      return
    }
    dispatch(setCustomSearchEngines(tempCustomSearchEngines))
  }

  const applyCustomSearchEngines = (nextValue: string) => {
    const validationError = validateCustomSearchEngines(nextValue)
    setTempCustomSearchEngines(nextValue)
    setCustomSearchEnginesError(validationError)
    if (validationError) {
      return false
    }
    dispatch(setCustomSearchEngines(nextValue))
    return true
  }

  const handleRemoteStoreURLChange = (e) => {
    setTempRemoteStoreURL(e.target.value)
  }

  const handleBlurRemoteStoreURL = () => {
    dispatch(setRemoteStoreURL(tempRemoteStoreURL))
  }

  return {
    searchEngineAdaption,
    weiboSupport,
    showOnlyBookmarkedResults,
    storeEveryPage,
    bookmarkAdaption,
    remoteStore,
    remoteStoreURL,
    remoteStoreEveryPage,
    showAskGPT,
    GPTKey,
    GPTUrl: GPTURL,
    GPTChatModel,
    GPTEmbeddingModel,
    GPTPromptTemplate,
    GPTAvailableModels,
    tempMaxResults,
    tempPageExpireTimeInDays,
    tempForbiddenURLs,
    tempCustomSearchEngines,
    customSearchEnginesError,
    tempRemoteStoreURL,
    tempGPTKey,
    tempGPTUrl: tempGPTURL,
    tempGPTChatModel,
    tempGPTEmbeddingModel,
    tempGPTPromptTemplate,
    navPage,
    handleMaxResultsChange,
    handleMaxResultsSubmit,
    handlePageExpireTimeChange,
    handlePageExpireTimeSubmit,
    handleForbiddenURLsChange,
    handleBlurForbiddenURLs,
    handleCustomSearchEnginesChange,
    handleBlurCustomSearchEngines,
    applyCustomSearchEngines,
    handleRemoteStoreURLChange,
    handleBlurRemoteStoreURL,
    handleGPTKeyChange,
    handleGPTUrlChange: handleGPTURLChange,
    handleBlurGPTKey,
    handleBlurGPTUrl: handleBlurGPTURL,
    handleGPTChatModelChange,
    handleBlurGPTChatModel,
    handleGPTEmbeddingModelChange,
    handleBlurGPTEmbeddingModel,
    handleGPTPromptTemplateChange,
    handleBlurGPTPromptTemplate,
    handleGPTAvailableModelsChange,
    setNavPage,
    toggleSearchEngineAdaption,
    toggleWeiboSupport,
    toggleShowOnlyBookmarkedResults,
    toggleStoreEveryPage,
    toggleBookmarkAdaption,
    toggleShowAskGPT,
    toggleRemoteStore,
    toggleRemoteStoreEveryPage
  }
}
