import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  addGptEndpoint,
  AppStat,
  removeGptEndpoint,
  setAvailableModelsForEndpoint,
  setCustomSearchEngines,
  setForbiddenURLs,
  setGptBindings,
  setGptDefaultModels,
  setGptPromptTemplate,
  setMaxResults,
  setRemoteStoreURL,
  setTempPageExpireTime,
  toggleBookmarkAdaption,
  toggleGptEndpointEnabled,
  toggleRemoteStore,
  toggleRemoteStoreEveryPage,
  toggleSearchEngineAdaption,
  toggleShowAskGPT,
  toggleShowOnlyBookmarkedResults,
  toggleStoreEveryPage,
  toggleWeiboSupport,
  updateGptEndpoint,
  type ApiEndpoint,
  type EndpointBindings,
  type ModelDefaults,
} from "~store/stat-slice"
import { validateCustomSearchEngines } from "~lib/utils"

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
  const customSearchEngines = useSelector(
    (state: AppStat) => state.customSearchEngines
  )
  const maxResults = useSelector((state: AppStat) => state.maxResults)
  const weiboSupport = useSelector((state: AppStat) => state.weiboSupport)
  const showAskGPT = useSelector((state: AppStat) => state.showAskGPT)
  const gptEndpoints = useSelector((state: AppStat) => state.gptEndpoints)
  const gptBindings = useSelector((state: AppStat) => state.gptBindings)
  const gptDefaultModels = useSelector((state: AppStat) => state.gptDefaultModels)
  const gptPromptTemplate = useSelector((state: AppStat) => state.gptPromptTemplate)
  const gptAvailableModelsByEndpoint = useSelector(
    (state: AppStat) => state.gptAvailableModelsByEndpoint
  )

  const [navPage, setNavPage] = useState(0)
  const [tempPageExpireTimeInDays, setTempPageExpireTimeInDays] = useState(
    tempPageExpireTime / 1000 / 60 / 60 / 24
  )
  const [tempMaxResults, setTempMaxResults] = useState(maxResults)
  const [tempForbiddenURLs, setTempForbiddenURLs] = useState(
    forbiddenURLs.join("\n")
  )
  const [tempCustomSearchEngines, setTempCustomSearchEngines] = useState(
    customSearchEngines
  )
  const [customSearchEnginesError, setCustomSearchEnginesError] = useState(
    validateCustomSearchEngines(customSearchEngines)
  )
  const [tempRemoteStoreURL, setTempRemoteStoreURL] = useState(remoteStoreURL)

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

  const handleAddGptEndpoint = (endpoint: ApiEndpoint) => {
    dispatch(addGptEndpoint(endpoint))
  }

  const handleUpdateGptEndpoint = (endpoint: ApiEndpoint) => {
    dispatch(updateGptEndpoint(endpoint))
  }

  const handleRemoveGptEndpoint = (endpointId: string) => {
    dispatch(removeGptEndpoint(endpointId))
  }

  const handleToggleGptEndpointEnabled = (endpointId: string) => {
    dispatch(toggleGptEndpointEnabled(endpointId))
  }

  const handleSetGptBindings = (bindings: EndpointBindings) => {
    dispatch(setGptBindings(bindings))
  }

  const handleSetGptDefaultModels = (models: ModelDefaults) => {
    dispatch(setGptDefaultModels(models))
  }

  const handleSetGptPromptTemplate = (template: string) => {
    dispatch(setGptPromptTemplate(template))
  }

  const handleSetAvailableModelsForEndpoint = (
    endpointId: string,
    models: string[]
  ) => {
    dispatch(setAvailableModelsForEndpoint({ endpointId, models }))
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
    gptEndpoints,
    gptBindings,
    gptDefaultModels,
    gptPromptTemplate,
    gptAvailableModelsByEndpoint,
    tempMaxResults,
    tempPageExpireTimeInDays,
    tempForbiddenURLs,
    tempCustomSearchEngines,
    customSearchEnginesError,
    tempRemoteStoreURL,
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
    handleAddGptEndpoint,
    handleUpdateGptEndpoint,
    handleRemoveGptEndpoint,
    handleToggleGptEndpointEnabled,
    handleSetGptBindings,
    handleSetGptDefaultModels,
    handleSetGptPromptTemplate,
    handleSetAvailableModelsForEndpoint,
    setNavPage,
    toggleSearchEngineAdaption,
    toggleWeiboSupport,
    toggleShowOnlyBookmarkedResults,
    toggleStoreEveryPage,
    toggleBookmarkAdaption,
    toggleShowAskGPT,
    toggleRemoteStore,
    toggleRemoteStoreEveryPage,
  }
}
