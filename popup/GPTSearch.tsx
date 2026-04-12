import React, { useEffect, useMemo, useRef, useState } from "react"
import type { IGPTAnswer } from "~lib/interface"
import { truncateText } from "~lib/utils"
import { AppStat, setGPTAnswer, setGPTQuery, setGPTLoading } from "~store/stat-slice"
import { resolveEndpointBinding } from "~lib/chat"
import { useDispatch, useSelector } from "react-redux"
import "~style.css"

const getGPTSettingsUrl = () => {
  const optionsBaseUrl = chrome.runtime.getURL("options.html")
  return `${optionsBaseUrl}?page=2`
}

const openGPTSettings = async () => {
  const targetUrl = getGPTSettingsUrl()
  const tabs = await chrome.tabs.query({})
  const existingOptionsTab = tabs.find((tab) =>
    tab.url?.startsWith(chrome.runtime.getURL("options.html"))
  )

  if (existingOptionsTab?.id) {
    await chrome.tabs.update(existingOptionsTab.id, {
      active: true,
      url: targetUrl,
    })
    return
  }

  await chrome.tabs.create({ url: targetUrl, active: true })
}

const askButtonClassName =
  "absolute right-0 top-0 h-10 px-4 bg-blue-500 text-white rounded-r-lg disabled:bg-gray-400 disabled:cursor-not-allowed"

const settingsLinkClassName = "text-blue-500 hover:text-blue-700 text-sm font-medium"

const getAskButtonTitle = (searchTerm: string, configError: string) => {
  if (configError) {
    return configError
  }

  if (!searchTerm.trim()) {
    return chrome.i18n.getMessage("popupAskPlaceholder")
  }

  return ""
}

const getAskErrorText = (configError: string) =>
  configError
    ? `${configError}\n\n${chrome.i18n.getMessage("popupAskOpenSettingsHint")}`
    : ""

const shouldShowAskSettingsAction = (answer: string) =>
  answer.includes(chrome.i18n.getMessage("popupAskOpenSettingsHint"))

const getAskDisabled = (
  showAskGPT: boolean,
  isLoading: boolean,
  searchTerm: string,
  configError: string
) => !showAskGPT || isLoading || !searchTerm.trim() || Boolean(configError)

const renderSettingsAction = (answer: string, onOpenSettings: () => void) => {
  if (!shouldShowAskSettingsAction(answer)) {
    return null
  }

  return (
    <div className="mt-3 flex justify-end">
      <button className={settingsLinkClassName} onClick={onOpenSettings}>
        {chrome.i18n.getMessage("popupAskOpenSettings")}
      </button>
    </div>
  )
}

const renderConfigHint = (configError: string, onOpenSettings: () => void) => {
  if (!configError) {
    return null
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap text-sm text-red-500">
      <span className="whitespace-pre-wrap break-all">{configError}</span>
      <button className={settingsLinkClassName} onClick={onOpenSettings}>
        {chrome.i18n.getMessage("popupAskOpenSettings")}
      </button>
    </div>
  )
}

const createAskErrorResult = (configError: string) => ({
  answer: getAskErrorText(configError),
  sources: null,
})

const setAskErrorState = (
  dispatch: ReturnType<typeof useDispatch>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setSearchResult: React.Dispatch<React.SetStateAction<IGPTAnswer>>,
  configError: string
) => {
  const errorResult = createAskErrorResult(configError)
  dispatch(setGPTLoading(false))
  dispatch(setGPTQuery(""))
  dispatch(setGPTAnswer(errorResult))
  setIsLoading(false)
  setSearchResult(errorResult)
}

const GPTSearch = () => {
  const dispatch = useDispatch()
  const ExistedGPTAnswer = useSelector((state: AppStat) => state.GPTAnswer)
  const GPTQuery = useSelector((state: AppStat) => state.GPTQuery)
  const GPTLoading = useSelector((state: AppStat) => state.GPTLoading)
  const showAskGPT = useSelector((state: AppStat) => state.showAskGPT)
  const gptEndpoints = useSelector((state: AppStat) => state.gptEndpoints)
  const gptBindings = useSelector((state: AppStat) => state.gptBindings)
  const gptDefaultModels = useSelector((state: AppStat) => state.gptDefaultModels)
  const gptPromptTemplate = useSelector((state: AppStat) => state.gptPromptTemplate)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResult, setSearchResult] = useState<IGPTAnswer>(ExistedGPTAnswer)
  const [isLoading, setIsLoading] = useState(GPTLoading)

  const bindingStatus = useMemo(() => {
    const chatResolution = resolveEndpointBinding({
      capability: "chat",
      endpoints: gptEndpoints,
      bindings: gptBindings,
      defaultModels: gptDefaultModels,
    })
    const embeddingResolution = resolveEndpointBinding({
      capability: "embedding",
      endpoints: gptEndpoints,
      bindings: gptBindings,
      defaultModels: gptDefaultModels,
    })

    return {
      hasChat: chatResolution.availableEndpoints.length > 0,
      hasEmbedding: embeddingResolution.availableEndpoints.length > 0,
      chatError: chatResolution.configurationErrors[0] || "",
      embeddingError: embeddingResolution.configurationErrors[0] || "",
    }
  }, [gptBindings, gptDefaultModels, gptEndpoints])

  const askConfigErrorMessage = useMemo(() => {
    if (!gptPromptTemplate?.trim()) {
      return chrome.i18n.getMessage("gptMissingPromptTemplateConfig")
    }

    if (!bindingStatus.hasChat) {
      return (
        bindingStatus.chatError ||
        chrome.i18n.getMessage("gptBindingUnavailable", [
          chrome.i18n.getMessage("settingPageSettingGPTCapabilityChat"),
        ])
      )
    }

    if (!bindingStatus.hasEmbedding) {
      return (
        bindingStatus.embeddingError ||
        chrome.i18n.getMessage("gptBindingUnavailable", [
          chrome.i18n.getMessage("settingPageSettingGPTCapabilityEmbedding"),
        ])
      )
    }

    return ""
  }, [bindingStatus, gptPromptTemplate])

  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value)
  }

  const handleOpenSettings = async () => {
    try {
      await openGPTSettings()
    } catch (error: any) {
      const answer = error?.message || chrome.i18n.getMessage("popupAskRequestFailed")
      const errorResult = { answer, sources: null }
      setSearchResult(errorResult)
      dispatch(setGPTAnswer(errorResult))
    }
  }

  const handleSearch = async () => {
    if (!showAskGPT) {
      return
    }

    if (askConfigErrorMessage) {
      setAskErrorState(
        dispatch,
        setIsLoading,
        setSearchResult,
        askConfigErrorMessage
      )
      return
    }

    if (searchTerm.trim() === "") {
      return
    }

    setIsLoading(true)
    dispatch(setGPTLoading(true))
    dispatch(setGPTQuery(searchTerm))
    dispatch(setGPTAnswer(null))
    chrome.runtime
      .sendMessage({
        command: "gpt_search",
        search: searchTerm,
        endpoints: gptEndpoints,
        bindings: gptBindings,
        defaultModels: gptDefaultModels,
        promptTemplate: gptPromptTemplate,
      })
      .then((v) => {
        setSearchResult(v)
        dispatch(setGPTAnswer(v))
        setIsLoading(false)
        dispatch(setGPTLoading(false))
      })
      .catch((error) => {
        const answer = error?.message || chrome.i18n.getMessage("popupAskRequestFailed")
        const errorResult = { answer, sources: null }
        setSearchResult(errorResult)
        dispatch(setGPTAnswer(errorResult))
        setIsLoading(false)
        dispatch(setGPTLoading(false))
      })
  }

  const searchinputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    searchinputRef.current.focus()
  }, [])

  return (
    <div className="w-[32rem] p-4 gap-4 h-[40rem] flex flex-col overflow-hidden">
      <div className="relative">
        <input
          ref={searchinputRef}
          type="text"
          placeholder={chrome.i18n.getMessage("popupAskPlaceholder")}
          value={searchTerm}
          onChange={handleSearchInputChange}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleSearch()
            }
          }}
          className="w-full h-10 px-4 pr-14 rounded-lg shadow-md"
        />
        <button
          className={askButtonClassName}
          onClick={handleSearch}
          disabled={getAskDisabled(showAskGPT, isLoading, searchTerm, askConfigErrorMessage)}
          title={getAskButtonTitle(searchTerm, askConfigErrorMessage)}>
          Ask
        </button>
      </div>
      {renderConfigHint(askConfigErrorMessage, handleOpenSettings)}
      {GPTQuery ? (
        <div className="font-bold shadow-md p-4">
          {GPTQuery}
          <div>
            {isLoading ? (
              <div className="flex justify-center items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647zM12 20.735A7.962 7.962 0 0112 12v-4.735l-3 2.646v4.736a7.962 7.962 0 013 2.647zM17 12a5 5 0 11-10 0 5 5 0 0110 0z"></path>
                </svg>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {isLoading ? null : searchResult ? (
        <div className="flex flex-col gap-4 p-2 overflow-y-auto overflow-x-hidden">
          <div className="font-bold">{chrome.i18n.getMessage("popupAskAnswerFrom")}</div>
          <div className="shadow-md p-4 text-large whitespace-pre-line">
            <div className="mb-2 whitespace-pre-wrap break-all">{searchResult?.answer}</div>
            {renderSettingsAction(searchResult?.answer || "", handleOpenSettings)}

            <div className="flex justify-end">
              <span
                className="hover:text-blue-700 text-blue-500 font-bold py-1 px-2 rounded text-sm cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(searchResult?.answer)
                }}>
                {chrome.i18n.getMessage("popupAskAnswerCopy")}
              </span>
            </div>
          </div>
          {searchResult.sources ? (
            <div className="font-bold">{chrome.i18n.getMessage("popupAskAnswerSource")}</div>
          ) : null}

          {searchResult.sources
            ? searchResult.sources.map((v, index) => {
                return (
                  <div className="text-blue-500 rounded shadow-md p-4" key={index}>
                    <a
                      title={chrome.i18n.getMessage("popupLinkTitle")}
                      href={v.url}
                      onClick={() => {
                        chrome.tabs.create({ url: v.url, active: false })
                      }}>
                      {truncateText(v.title, 100)}
                    </a>
                    {v.isBookmarked && <i className="ml-2">⭐</i>}
                    <p className="text-md text-gray-300">{truncateText(v.url, 40)}</p>
                    <p className="text-sm text-gray-300">
                      {new Date(v.date).toLocaleDateString()}
                    </p>
                  </div>
                )
              })
            : null}
        </div>
      ) : (
        <div></div>
      )}
    </div>
  )
}

export default GPTSearch
