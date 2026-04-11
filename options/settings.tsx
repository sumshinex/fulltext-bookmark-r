import { useCallback, useEffect, useMemo, useState } from "react"
import { useDispatch } from "react-redux"
import { Feature } from "./Feature"
import { Donate } from "./Donate"
import { SettingsSidebar } from "./components/SettingsSidebar"
import { GeneralSettings } from "./components/GeneralSettings"
import { StorageSettings } from "./components/StorageSettings"
import { DataManagement } from "./components/DataManagement"
import { RemoteAPISettings } from "./components/RemoteAPISettings"
import { GPTSettings } from "./components/GPTSettings"
import { useSettingsState } from "./hooks/useSettingsState"
import { showEstimatedQuota } from "./utils/storageUtils"

export const SettingView = () => {
  const dispatch = useDispatch()
  const {
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
    applyCustomSearchEngines,
    handleMaxResultsChange,
    handleMaxResultsSubmit,
    handlePageExpireTimeChange,
    handlePageExpireTimeSubmit,
    handleForbiddenURLsChange,
    handleBlurForbiddenURLs,
    handleCustomSearchEnginesChange,
    handleBlurCustomSearchEngines,
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
  } = useSettingsState()

  const [storeSize, setStoreSize] = useState({ quota: "0", usage: "0" })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 1024)

  useEffect(() => {
    const fetchStoreSize = async () => {
      const size = await showEstimatedQuota()
      setStoreSize(size)
    }
    fetchStoreSize()
  }, [])

  const handleSidebarCollapse = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
  }, [])

  const handleToggleSearchEngineAdaption = useCallback(() => {
    dispatch(toggleSearchEngineAdaption())
  }, [dispatch, toggleSearchEngineAdaption])

  const handleToggleWeiboSupport = useCallback(() => {
    dispatch(toggleWeiboSupport())
  }, [dispatch, toggleWeiboSupport])

  const handleToggleShowOnlyBookmarkedResults = useCallback(() => {
    dispatch(toggleShowOnlyBookmarkedResults())
  }, [dispatch, toggleShowOnlyBookmarkedResults])

  const handleToggleStoreEveryPage = useCallback(() => {
    dispatch(toggleStoreEveryPage())
  }, [dispatch, toggleStoreEveryPage])

  const handleToggleBookmarkAdaption = useCallback(() => {
    dispatch(toggleBookmarkAdaption())
  }, [dispatch, toggleBookmarkAdaption])

  const handleToggleRemoteStore = useCallback(() => {
    dispatch(toggleRemoteStore())
  }, [dispatch, toggleRemoteStore])

  const handleToggleRemoteStoreEveryPage = useCallback(() => {
    dispatch(toggleRemoteStoreEveryPage())
  }, [dispatch, toggleRemoteStoreEveryPage])

  const handleToggleShowAskGPT = useCallback(() => {
    dispatch(toggleShowAskGPT())
  }, [dispatch, toggleShowAskGPT])

  const generalSettingsProps = useMemo(
    () => ({
      searchEngineAdaption,
      weiboSupport,
      showOnlyBookmarkedResults,
      tempMaxResults,
      tempCustomSearchEngines,
      customSearchEnginesError,
      handleMaxResultsChange,
      handleMaxResultsSubmit,
      handleCustomSearchEnginesChange,
      handleBlurCustomSearchEngines,
      applyCustomSearchEngines,
      onToggleSearchEngineAdaption: handleToggleSearchEngineAdaption,
      onToggleWeiboSupport: handleToggleWeiboSupport,
      onToggleShowOnlyBookmarkedResults: handleToggleShowOnlyBookmarkedResults,
    }),
    [
      searchEngineAdaption,
      weiboSupport,
      showOnlyBookmarkedResults,
      tempMaxResults,
      tempCustomSearchEngines,
      customSearchEnginesError,
      gptDefaultModels.chat,
      handleMaxResultsChange,
      handleMaxResultsSubmit,
      handleCustomSearchEnginesChange,
      handleBlurCustomSearchEngines,
      applyCustomSearchEngines,
      handleToggleSearchEngineAdaption,
      handleToggleWeiboSupport,
      handleToggleShowOnlyBookmarkedResults,
    ]
  )

  const storageSettingsProps = useMemo(
    () => ({
      storeEveryPage,
      bookmarkAdaption,
      tempPageExpireTimeInDays,
      tempForbiddenURLs,
      storeSize,
      setStoreSize,
      handlePageExpireTimeChange,
      handlePageExpireTimeSubmit,
      handleForbiddenURLsChange,
      handleBlurForbiddenURLs,
      onToggleStoreEveryPage: handleToggleStoreEveryPage,
      onToggleBookmarkAdaption: handleToggleBookmarkAdaption,
    }),
    [
      storeEveryPage,
      bookmarkAdaption,
      tempPageExpireTimeInDays,
      tempForbiddenURLs,
      storeSize,
      handlePageExpireTimeChange,
      handlePageExpireTimeSubmit,
      handleForbiddenURLsChange,
      handleBlurForbiddenURLs,
      handleToggleStoreEveryPage,
      handleToggleBookmarkAdaption,
    ]
  )

  const remoteApiSettingsProps = useMemo(
    () => ({
      remoteStore,
      remoteStoreEveryPage,
      remoteStoreURL,
      tempRemoteStoreURL,
      handleRemoteStoreURLChange,
      handleBlurRemoteStoreURL,
      onToggleRemoteStore: handleToggleRemoteStore,
      onToggleRemoteStoreEveryPage: handleToggleRemoteStoreEveryPage,
    }),
    [
      remoteStore,
      remoteStoreEveryPage,
      remoteStoreURL,
      tempRemoteStoreURL,
      handleRemoteStoreURLChange,
      handleBlurRemoteStoreURL,
      handleToggleRemoteStore,
      handleToggleRemoteStoreEveryPage,
    ]
  )

  const gptSettingsProps = useMemo(
    () => ({
      showAskGPT,
      gptEndpoints,
      gptBindings,
      gptDefaultModels,
      gptPromptTemplate,
      gptAvailableModelsByEndpoint,
      handleAddGptEndpoint,
      handleUpdateGptEndpoint,
      handleRemoveGptEndpoint,
      handleToggleGptEndpointEnabled,
      handleSetGptBindings,
      handleSetGptDefaultModels,
      handleSetGptPromptTemplate,
      handleSetAvailableModelsForEndpoint,
      onToggleShowAskGPT: handleToggleShowAskGPT,
    }),
    [
      showAskGPT,
      gptEndpoints,
      gptBindings,
      gptDefaultModels,
      gptPromptTemplate,
      gptAvailableModelsByEndpoint,
      handleAddGptEndpoint,
      handleUpdateGptEndpoint,
      handleRemoveGptEndpoint,
      handleToggleGptEndpointEnabled,
      handleSetGptBindings,
      handleSetGptDefaultModels,
      handleSetGptPromptTemplate,
      handleSetAvailableModelsForEndpoint,
      handleToggleShowAskGPT,
    ]
  )

  return (
    <div className="flex">
      <SettingsSidebar onNavChange={setNavPage} onCollapse={handleSidebarCollapse} />

      <div
        className={`transition-all duration-300 ease-in-out max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-10 ${
          sidebarCollapsed ? "lg:pl-8" : "lg:pl-10"
        }`}>
        {navPage === 0 && (
          <>
            <GeneralSettings {...generalSettingsProps} />
            <StorageSettings {...storageSettingsProps} />
          </>
        )}

        {navPage === 1 && <RemoteAPISettings {...remoteApiSettingsProps} />}

        {navPage === 2 && <GPTSettings {...gptSettingsProps} />}

        {navPage === 3 && <Feature />}

        {navPage === 4 && <Donate />}

        {navPage === 5 && (
          <DataManagement
            setStoreSize={setStoreSize}
            webdavConfig={webdavConfig}
            webdavStatus={webdavStatus}
            tempWebdavBaseUrl={tempWebdavBaseUrl}
            tempWebdavUsername={tempWebdavUsername}
            tempWebdavPassword={tempWebdavPassword}
            tempWebdavFileName={tempWebdavFileName}
            tempWebdavAutoBackupEnabled={tempWebdavAutoBackupEnabled}
            tempWebdavAutoBackupMode={tempWebdavAutoBackupMode}
            tempWebdavAutoBackupTime={tempWebdavAutoBackupTime}
            tempWebdavAutoBackupIntervalHours={tempWebdavAutoBackupIntervalHours}
            tempWebdavRetentionCount={tempWebdavRetentionCount}
            handleWebdavBaseUrlChange={handleWebdavBaseUrlChange}
            handleWebdavUsernameChange={handleWebdavUsernameChange}
            handleWebdavPasswordChange={handleWebdavPasswordChange}
            handleWebdavFileNameChange={handleWebdavFileNameChange}
            handleWebdavAutoBackupEnabledChange={handleWebdavAutoBackupEnabledChange}
            handleWebdavAutoBackupModeChange={handleWebdavAutoBackupModeChange}
            handleWebdavAutoBackupTimeChange={handleWebdavAutoBackupTimeChange}
            handleWebdavAutoBackupIntervalHoursChange={handleWebdavAutoBackupIntervalHoursChange}
            handleWebdavRetentionCountChange={handleWebdavRetentionCountChange}
            handleBlurWebdavConfig={handleBlurWebdavConfig}
            handleSetWebdavStatus={handleSetWebdavStatus}
          />
        )}
      </div>
    </div>
  )
}
