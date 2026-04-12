import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { persistor } from "~store/store"
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
  setWebdavConfig,
  setWebdavStatus,
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
  const webdavConfig = useSelector((state: AppStat) => state.webdavConfig)
  const webdavStatus = useSelector((state: AppStat) => state.webdavStatus)

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
  const [tempWebdavBaseUrl, setTempWebdavBaseUrl] = useState(webdavConfig.baseUrl)
  const [tempWebdavUsername, setTempWebdavUsername] = useState(webdavConfig.username)
  const [tempWebdavPassword, setTempWebdavPassword] = useState(webdavConfig.password)
  const [tempWebdavFileName, setTempWebdavFileName] = useState(webdavConfig.fileName)
  const [tempWebdavAutoBackupEnabled, setTempWebdavAutoBackupEnabled] = useState(
    webdavConfig.autoBackupEnabled
  )
  const [tempWebdavAutoBackupMode, setTempWebdavAutoBackupMode] = useState(
    webdavConfig.autoBackupMode
  )
  const [tempWebdavAutoBackupTime, setTempWebdavAutoBackupTime] = useState(
    webdavConfig.autoBackupTime
  )
  const [tempWebdavAutoBackupIntervalHours, setTempWebdavAutoBackupIntervalHours] = useState(
    webdavConfig.autoBackupIntervalHours
  )
  const [tempWebdavRetentionCount, setTempWebdavRetentionCount] = useState(
    webdavConfig.retentionCount
  )

  const handlePageExpireTimeChange = (e) => {
    if (e.target.value === "") {
      // @ts-ignore
      setTempPageExpireTimeInDays("")
      return
    }

    const value = parseInt(e.target.value)
    setTempPageExpireTimeInDays(value)
  }

  const flushPersistedState = () => {
    void persistor.flush()
  }

  const dispatchAndFlush = (action) => {
    dispatch(action)
    flushPersistedState()
  }

  const handlePageExpireTimeSubmit = () => {
    if (
      !tempPageExpireTimeInDays ||
      typeof tempPageExpireTimeInDays !== "number" ||
      tempPageExpireTimeInDays < 0 ||
      tempPageExpireTimeInDays > 365 * 100
    ) {
      setTempPageExpireTimeInDays(60)
      dispatchAndFlush(setTempPageExpireTime(60 * 1000 * 60 * 60 * 24))
      return
    }

    dispatchAndFlush(
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
      dispatchAndFlush(setMaxResults(20))
      return
    }

    dispatchAndFlush(setMaxResults(tempMaxResults))
  }

  const handleForbiddenURLsChange = (e) => {
    setTempForbiddenURLs(e.target.value)
  }

  const handleBlurForbiddenURLs = () => {
    dispatchAndFlush(setForbiddenURLs(tempForbiddenURLs.split("\n").filter((x) => x)))
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
    dispatchAndFlush(setCustomSearchEngines(tempCustomSearchEngines))
  }

  const applyCustomSearchEngines = (nextValue: string) => {
    const validationError = validateCustomSearchEngines(nextValue)
    setTempCustomSearchEngines(nextValue)
    setCustomSearchEnginesError(validationError)
    if (validationError) {
      return false
    }
    dispatchAndFlush(setCustomSearchEngines(nextValue))
    return true
  }

  const handleRemoteStoreURLChange = (e) => {
    setTempRemoteStoreURL(e.target.value)
  }

  const handleBlurRemoteStoreURL = () => {
    dispatchAndFlush(setRemoteStoreURL(tempRemoteStoreURL))
  }

  const handleWebdavBaseUrlChange = (e) => {
    setTempWebdavBaseUrl(e.target.value)
  }

  const handleWebdavUsernameChange = (e) => {
    setTempWebdavUsername(e.target.value)
  }

  const handleWebdavPasswordChange = (e) => {
    setTempWebdavPassword(e.target.value)
  }

  const handleWebdavFileNameChange = (e) => {
    setTempWebdavFileName(e.target.value)
  }

  const handleWebdavAutoBackupEnabledChange = (e) => {
    setTempWebdavAutoBackupEnabled(e.target.checked)
  }

  const handleWebdavAutoBackupModeChange = (e) => {
    setTempWebdavAutoBackupMode(e.target.value)
  }

  const handleWebdavAutoBackupTimeChange = (e) => {
    setTempWebdavAutoBackupTime(e.target.value)
  }

  const handleWebdavAutoBackupIntervalHoursChange = (e) => {
    const value = parseInt(e.target.value, 10)
    setTempWebdavAutoBackupIntervalHours(Number.isNaN(value) ? 24 : value)
  }

  const handleWebdavRetentionCountChange = (e) => {
    const value = parseInt(e.target.value, 10)
    setTempWebdavRetentionCount(Number.isNaN(value) ? 10 : value)
  }

  const handleBlurWebdavConfig = () => {
    dispatchAndFlush(
      setWebdavConfig({
        baseUrl: tempWebdavBaseUrl.trim(),
        username: tempWebdavUsername.trim(),
        password: tempWebdavPassword,
        fileName: tempWebdavFileName.trim() || "fulltext-bookmark-backup.json",
        autoBackupEnabled: tempWebdavAutoBackupEnabled,
        autoBackupMode: tempWebdavAutoBackupMode,
        autoBackupTime: tempWebdavAutoBackupTime || "03:00",
        autoBackupIntervalHours: Math.max(1, tempWebdavAutoBackupIntervalHours || 24),
        retentionCount: Math.max(1, tempWebdavRetentionCount || 10),
      })
    )
  }

  const handleSetWebdavStatus = (status) => {
    dispatchAndFlush(setWebdavStatus(status))
  }

  const handleAddGptEndpoint = (endpoint: ApiEndpoint) => {
    dispatchAndFlush(addGptEndpoint(endpoint))
  }

  const handleUpdateGptEndpoint = (endpoint: ApiEndpoint) => {
    dispatchAndFlush(updateGptEndpoint(endpoint))
  }

  const handleRemoveGptEndpoint = (endpointId: string) => {
    dispatchAndFlush(removeGptEndpoint(endpointId))
  }

  const handleToggleGptEndpointEnabled = (endpointId: string) => {
    dispatchAndFlush(toggleGptEndpointEnabled(endpointId))
  }

  const handleSetGptBindings = (bindings: EndpointBindings) => {
    dispatchAndFlush(setGptBindings(bindings))
  }

  const handleSetGptDefaultModels = (models: ModelDefaults) => {
    dispatchAndFlush(setGptDefaultModels(models))
  }

  const handleSetGptPromptTemplate = (template: string) => {
    dispatchAndFlush(setGptPromptTemplate(template))
  }

  const handleSetAvailableModelsForEndpoint = (
    endpointId: string,
    models: string[]
  ) => {
    dispatchAndFlush(setAvailableModelsForEndpoint({ endpointId, models }))
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
    webdavConfig,
    webdavStatus,
    tempMaxResults,
    tempPageExpireTimeInDays,
    tempForbiddenURLs,
    tempCustomSearchEngines,
    customSearchEnginesError,
    tempRemoteStoreURL,
    tempWebdavBaseUrl,
    tempWebdavUsername,
    tempWebdavPassword,
    tempWebdavFileName,
    tempWebdavAutoBackupEnabled,
    tempWebdavAutoBackupMode,
    tempWebdavAutoBackupTime,
    tempWebdavAutoBackupIntervalHours,
    tempWebdavRetentionCount,
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
    handleWebdavBaseUrlChange,
    handleWebdavUsernameChange,
    handleWebdavPasswordChange,
    handleWebdavFileNameChange,
    handleWebdavAutoBackupEnabledChange,
    handleWebdavAutoBackupModeChange,
    handleWebdavAutoBackupTimeChange,
    handleWebdavAutoBackupIntervalHoursChange,
    handleWebdavRetentionCountChange,
    handleBlurWebdavConfig,
    handleSetWebdavStatus,
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
