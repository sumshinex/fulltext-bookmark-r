import { useMemo, useState } from "react"
import { useDispatch, useSelector } from "react-redux"

import {
  getUrlVars,
  validateCustomSearchEngines,
  type SearchEnginePageContext,
  type SearchEngineRule
} from "~lib/utils"
import { setCustomSearchEngines, type AppStat } from "~store/stat-slice"

interface RuleTestResponse {
  ok: boolean
  urlMatched: boolean
  containerMatched: boolean
  queryMatched: boolean
  matchedContainer: string
  matchedQuery: string
  issues?: string[]
  suggestions?: string[]
}

interface SavedRulesReport {
  totalCount: number
  matchedResults: string[]
  unmatchedResults: string[]
}

const buttonClassName = "text-blue-500 disabled:text-gray-500"

const buildFallbackSearchEngineContext = async (
  tabId: number
): Promise<SearchEnginePageContext> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url || ""
  const title = tab?.title || ""
  const vars = getUrlVars(url)
  const query =
    Object.values(vars).find((value) => typeof value === "string" && value.trim()) || ""

  let pageTextHints: string[] = []
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selectors = [
          "main",
          "[role='main']",
          "#search",
          "#results",
          "#links",
          "#b_results",
          "#center_col",
          "#content_left"
        ]
        return selectors
          .map((selector) => document.querySelector(selector)?.textContent?.trim() || "")
          .filter(Boolean)
          .map((text) => text.slice(0, 160))
          .slice(0, 6)
      }
    })
    pageTextHints = Array.isArray(result) ? result : []
  } catch {
    pageTextHints = []
  }

  return {
    url,
    title,
    query: typeof query === "string" ? query : "",
    queryParamCandidates: Object.keys(vars).slice(0, 10),
    queryInputCandidates: [],
    containerIdCandidates: [],
    containerSelectorCandidates: [],
    pageTextHints
  }
}

const normalizeCollectedContext = (
  context: { url?: string } | undefined,
  fallback: SearchEnginePageContext
): SearchEnginePageContext => ({
  url: context?.url || fallback.url,
  title: (context as SearchEnginePageContext | undefined)?.title || fallback.title,
  query: (context as SearchEnginePageContext | undefined)?.query || fallback.query,
  queryParamCandidates:
    (context as SearchEnginePageContext | undefined)?.queryParamCandidates ||
    fallback.queryParamCandidates,
  queryInputCandidates:
    (context as SearchEnginePageContext | undefined)?.queryInputCandidates ||
    fallback.queryInputCandidates,
  containerIdCandidates:
    (context as SearchEnginePageContext | undefined)?.containerIdCandidates ||
    fallback.containerIdCandidates,
  containerSelectorCandidates:
    (context as SearchEnginePageContext | undefined)?.containerSelectorCandidates ||
    fallback.containerSelectorCandidates,
  pageTextHints:
    (context as SearchEnginePageContext | undefined)?.pageTextHints ||
    fallback.pageTextHints
})

const hasEnoughContext = (context: SearchEnginePageContext) =>
  Boolean(
    context.url &&
      (context.query ||
        context.queryParamCandidates.length ||
        context.queryInputCandidates.length ||
        context.containerIdCandidates.length ||
        context.containerSelectorCandidates.length ||
        context.pageTextHints.length)
  )

const getContextErrorMessage = (context: SearchEnginePageContext) => {
  if (!context.url) {
    return chrome.i18n.getMessage("settingPageSettingSearchGenerateContextError")
  }

  if (!context.query && !context.queryParamCandidates.length && !context.queryInputCandidates.length) {
    return chrome.i18n.getMessage("settingPageSettingSearchGenerateContextMissingQuery")
  }

  if (
    !context.containerIdCandidates.length &&
    !context.containerSelectorCandidates.length &&
    !context.pageTextHints.length
  ) {
    return chrome.i18n.getMessage("settingPageSettingSearchGenerateContextMissingContainer")
  }

  return chrome.i18n.getMessage("settingPageSettingSearchGenerateContextError")
}

const hasSufficientGeneratedRule = (rule: SearchEngineRule) =>
  Boolean(
    rule?.urlPattern &&
      (rule.queryParam || rule.queryInputSelector) &&
      (rule.containerId || rule.containerSelector)
  )

const enrichGeneratedRule = (
  rule: SearchEngineRule,
  context: SearchEnginePageContext
): SearchEngineRule => ({
  ...rule,
  queryParam:
    rule.queryParam ||
    context.queryParamCandidates[0] ||
    undefined,
  queryInputSelector:
    rule.queryParam ? rule.queryInputSelector : rule.queryInputSelector || context.queryInputCandidates[0] || undefined,
  containerSelector:
    rule.containerSelector ||
    context.containerSelectorCandidates[0] ||
    undefined,
  containerId:
    rule.containerSelector
      ? rule.containerId
      : rule.containerId || context.containerIdCandidates[0] || undefined,
  insertPosition: rule.insertPosition || "prepend"
})

const isGeneratedRuleValid = (rule: SearchEngineRule) =>
  !validateCustomSearchEngines(JSON.stringify([rule]))

const selectBestGeneratedRule = (
  rule: SearchEngineRule,
  context: SearchEnginePageContext
): SearchEngineRule => {
  if (hasSufficientGeneratedRule(rule)) {
    return rule
  }

  const enrichedRule = enrichGeneratedRule(rule, context)
  return isGeneratedRuleValid(enrichedRule) ? enrichedRule : rule
}

const customSearchEnginesAnchor = "custom-search-engines"

const getRuleLabel = (rule: SearchEngineRule) => rule.name || rule.urlPattern

const formatSavedRulesOverview = (
  totalCount: number,
  matchedCount: number,
  unmatchedCount: number
) =>
  chrome.i18n.getMessage("popupRulePanelSavedRulesSummary", [
    String(totalCount),
    String(matchedCount),
    String(unmatchedCount)
  ])

const getCustomSearchEnginesSettingsUrl = () => {
  const optionsBaseUrl = chrome.runtime.getURL("options.html")
  return `${optionsBaseUrl}?focus=${customSearchEnginesAnchor}&t=${Date.now()}#${customSearchEnginesAnchor}`
}

const findExistingOptionsTab = async () => {
  const optionsBaseUrl = chrome.runtime.getURL("options.html")
  const tabs = await chrome.tabs.query({})
  return tabs.find((tab) => tab.url?.startsWith(optionsBaseUrl))
}

const openCustomSearchEnginesSettings = async () => {
  const targetUrl = getCustomSearchEnginesSettingsUrl()
  const existingOptionsTab = await findExistingOptionsTab()

  if (existingOptionsTab?.id) {
    await chrome.tabs.update(existingOptionsTab.id, {
      active: true,
      url: targetUrl
    })
    return
  }

  await chrome.tabs.create({ url: targetUrl, active: true })
}

const formatSavedRuleSummary = (response: RuleTestResponse) => {
  const status = response.ok
    ? chrome.i18n.getMessage("settingPageSettingSearchGenerateTestSuccess")
    : chrome.i18n.getMessage("settingPageSettingSearchGenerateTestFail")

  return [
    `${chrome.i18n.getMessage("popupRulePanelSavedRulesStatusLabel")}: ${status}`,
    `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusUrl")}: ${response.urlMatched}`,
    `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusContainer")}: ${response.containerMatched}`,
    `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusQuery")}: ${response.queryMatched}`
  ].join("\n")
}

const formatSavedRuleDetail = (titleKey: string, items?: string[]) => {
  if (!items?.length) {
    return null
  }

  return `${chrome.i18n.getMessage(titleKey)}:\n${items
    .map((item) => `- ${item}`)
    .join("\n")}`
}

const formatSavedRuleReason = (response: RuleTestResponse) => {
  const failedParts = [
    !response.urlMatched &&
      chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusUrl"),
    !response.containerMatched &&
      chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusContainer"),
    !response.queryMatched &&
      chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusQuery")
  ].filter((value): value is string => Boolean(value))

  const reason = failedParts.length
    ? failedParts.join(" / ")
    : chrome.i18n.getMessage("popupRulePanelSavedRulesReasonUnknown")

  return `${chrome.i18n.getMessage("popupRulePanelSavedRulesReasonLabel")}: ${reason}`
}

export const SearchEngineRulePanel = () => {
  const dispatch = useDispatch()
  const customSearchEngines = useSelector(
    (state: AppStat) => state.customSearchEngines
  )
  const [expanded, setExpanded] = useState(false)
  const customSearchEnginesError = useMemo(
    () => validateCustomSearchEngines(customSearchEngines),
    [customSearchEngines]
  )
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateResult, setGenerateResult] = useState("")
  const [generatedRuleText, setGeneratedRuleText] = useState("")
  const [savedRulesReport, setSavedRulesReport] = useState<SavedRulesReport | null>(null)
  const [showMatchedSavedRules, setShowMatchedSavedRules] = useState(false)
  const [showUnmatchedSavedRules, setShowUnmatchedSavedRules] = useState(true)

  const clearSavedRulesReport = () => {
    setSavedRulesReport(null)
    setShowMatchedSavedRules(false)
    setShowUnmatchedSavedRules(true)
  }

  const showTextResult = (result: string) => {
    clearSavedRulesReport()
    setGenerateResult(result)
  }

  const formatRuleTestResult = (response: RuleTestResponse) => {
    const lines = [
      response.ok
        ? chrome.i18n.getMessage("settingPageSettingSearchGenerateTestSuccess")
        : chrome.i18n.getMessage("settingPageSettingSearchGenerateTestFail"),
      `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusUrl")}: ${response.urlMatched}`,
      `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusContainer")}: ${response.containerMatched}`,
      `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestStatusQuery")}: ${response.queryMatched}`,
      `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestMatchedContainer")}: ${response.matchedContainer || "-"}`,
      `${chrome.i18n.getMessage("settingPageSettingSearchGenerateTestMatchedQuery")}: ${response.matchedQuery || "-"}`
    ]

    if (response.issues?.length) {
      lines.push(
        "",
        chrome.i18n.getMessage("settingPageSettingSearchGenerateTestIssuesTitle")
      )
      response.issues.forEach((issue) => lines.push(`- ${issue}`))
    }

    if (response.suggestions?.length) {
      lines.push(
        "",
        chrome.i18n.getMessage("settingPageSettingSearchGenerateTestSuggestionsTitle")
      )
      response.suggestions.forEach((suggestion) => lines.push(`- ${suggestion}`))
    }

    return lines.join("\n")
  }

  const getActiveTabId = async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.id) {
      throw new Error(chrome.i18n.getMessage("settingPageSettingSearchGenerateTabError"))
    }
    return activeTab.id
  }

  const handleGenerateRule = async () => {
    setGenerateLoading(true)
    setGenerateResult("")
    clearSavedRulesReport()
    try {
      const activeTabId = await getActiveTabId()
      let collectedContext: { url?: string } | undefined

      try {
        collectedContext = (await chrome.tabs.sendMessage(activeTabId, {
          command: "collect_search_engine_context"
        })) as unknown as { url?: string } | undefined
      } catch {
        collectedContext = undefined
      }

      const fallbackContext = await buildFallbackSearchEngineContext(activeTabId)
      const pageContext = normalizeCollectedContext(collectedContext, fallbackContext)

      if (!hasEnoughContext(pageContext)) {
        setGenerateResult(getContextErrorMessage(pageContext))
        setGeneratedRuleText("")
        return
      }

      const response = await chrome.runtime.sendMessage({
        command: "generate_search_engine_rule",
        context: pageContext
      })

      if (!response?.ok || !response?.rule) {
        setGeneratedRuleText("")
        setGenerateResult(`Error: ${response?.error || "Request failed"}`)
        return
      }

      const rule = selectBestGeneratedRule(response.rule, pageContext)
      setGeneratedRuleText(JSON.stringify(rule, null, 2))
      setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateSuccess"))
    } catch (e: any) {
      setGeneratedRuleText("")
      setGenerateResult(`Error: ${e.message}`)
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleAppendGeneratedRule = () => {
    if (!generatedRuleText) {
      return
    }

    if (customSearchEnginesError) {
      showTextResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendFixError"))
      return
    }

    try {
      const parsedCurrent = customSearchEngines.trim()
        ? JSON.parse(customSearchEngines)
        : []
      const parsedRule = JSON.parse(generatedRuleText)
      const nextValue = JSON.stringify([...parsedCurrent, parsedRule], null, 2)
      const nextError = validateCustomSearchEngines(nextValue)
      if (nextError) {
        showTextResult(nextError)
        return
      }
      dispatch(setCustomSearchEngines(nextValue))
      showTextResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendSuccess"))
    } catch (e: any) {
      showTextResult(`Error: ${e.message}`)
    }
  }

  const handleReplaceWithGeneratedRule = () => {
    if (!generatedRuleText) {
      return
    }

    try {
      const parsedRule = JSON.parse(generatedRuleText)
      const nextValue = JSON.stringify([parsedRule], null, 2)
      const nextError = validateCustomSearchEngines(nextValue)
      if (nextError) {
        showTextResult(nextError)
        return
      }
      dispatch(setCustomSearchEngines(nextValue))
      showTextResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateReplaceSuccess"))
    } catch (e: any) {
      showTextResult(`Error: ${e.message}`)
    }
  }

  const handleTestGeneratedRule = async () => {
    if (!generatedRuleText) {
      return
    }

    clearSavedRulesReport()
    try {
      const activeTabId = await getActiveTabId()
      const rule = JSON.parse(generatedRuleText)
      const response = (await chrome.tabs.sendMessage(activeTabId, {
        command: "test_search_engine_rule",
        rule
      })) as unknown as RuleTestResponse | undefined

      if (!response) {
        setGenerateResult(
          chrome.i18n.getMessage("settingPageSettingSearchGenerateTestUnavailable")
        )
        return
      }

      setGenerateResult(formatRuleTestResult(response))
    } catch (e: any) {
      setGenerateResult(`Error: ${e.message}`)
    }
  }

  const handleTestSavedRules = async () => {
    if (customSearchEnginesError) {
      showTextResult(customSearchEnginesError)
      return
    }

    try {
      const parsedCurrent = customSearchEngines.trim()
        ? (JSON.parse(customSearchEngines) as SearchEngineRule[])
        : []
      if (!parsedCurrent.length) {
        showTextResult(chrome.i18n.getMessage("popupRulePanelNoSavedRules"))
        return
      }

      const activeTabId = await getActiveTabId()
      const matchedResults: string[] = []
      const unmatchedResults: string[] = []

      for (const [index, rule] of parsedCurrent.entries()) {
        const response = (await chrome.tabs.sendMessage(activeTabId, {
          command: "test_search_engine_rule",
          rule
        })) as unknown as RuleTestResponse | undefined

        if (!response) {
          showTextResult(chrome.i18n.getMessage("popupRulePanelSavedRulesUnavailable"))
          return
        }

        const summaryLines = [
          `${chrome.i18n.getMessage("popupRulePanelRuleLabel")} ${index + 1}: ${getRuleLabel(rule)}`,
          formatSavedRuleSummary(response)
        ]

        if (response.ok) {
          matchedResults.push(summaryLines.join("\n"))
          continue
        }

        const detailSections = [
          formatSavedRuleReason(response),
          formatSavedRuleDetail("popupRulePanelSavedRulesIssuesLabel", response.issues),
          formatSavedRuleDetail(
            "popupRulePanelSavedRulesSuggestionsLabel",
            response.suggestions
          )
        ].filter((value): value is string => Boolean(value))

        unmatchedResults.push([...summaryLines, ...detailSections].join("\n"))
      }

      setGenerateResult("")
      setSavedRulesReport({
        totalCount: parsedCurrent.length,
        matchedResults,
        unmatchedResults
      })
      setShowMatchedSavedRules(false)
      setShowUnmatchedSavedRules(true)
    } catch (e: any) {
      showTextResult(`Error: ${e.message}`)
    }
  }

  const handleOpenSettings = async () => {
    try {
      await openCustomSearchEnginesSettings()
      if (!savedRulesReport && !generateResult) {
        setGenerateResult(chrome.i18n.getMessage("popupRulePanelOpenSettingsHint"))
      }
    } catch (e: any) {
      showTextResult(`Error: ${e.message}`)
    }
  }

  const handleCopyGeneratedRule = async () => {
    if (!generatedRuleText) {
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedRuleText)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = generatedRuleText
        textArea.style.position = "fixed"
        textArea.style.opacity = "0"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
      }
      showTextResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateCopySuccess"))
    } catch (e: any) {
      showTextResult(`Error: ${e.message}`)
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 p-3 text-sm shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{chrome.i18n.getMessage("popupRulePanelTitle")}</div>
        <button
          className={buttonClassName}
          onClick={() => setExpanded((value) => !value)}>
          {expanded
            ? chrome.i18n.getMessage("popupRulePanelCollapse")
            : chrome.i18n.getMessage("popupRulePanelExpand")}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 overflow-y-auto max-h-64">
          <div className="text-gray-400 whitespace-pre-wrap mb-3">
            {chrome.i18n.getMessage("settingPageSettingSearchGenerateNote")}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              className={buttonClassName}
              onClick={handleGenerateRule}
              disabled={generateLoading}>
              {generateLoading
                ? chrome.i18n.getMessage("settingPageSettingSearchGenerateLoading")
                : chrome.i18n.getMessage("settingPageSettingSearchGenerateBtn")}
            </button>
            <button className={buttonClassName} onClick={handleTestSavedRules}>
              {chrome.i18n.getMessage("popupRulePanelTestSavedBtn")}
            </button>
            <button className={buttonClassName} onClick={handleOpenSettings}>
              {chrome.i18n.getMessage("popupRulePanelOpenSettings")}
            </button>
          </div>
          <div className="mt-2 text-gray-400 whitespace-pre-wrap">
            {chrome.i18n.getMessage("popupRulePanelOpenSettingsHint")}
          </div>
          {customSearchEnginesError ? (
            <div className="mt-2 text-red-500 whitespace-pre-wrap">
              {customSearchEnginesError}
            </div>
          ) : null}
          {savedRulesReport ? (
            <div className="mt-2 text-sm rounded bg-gray-900/40 p-2">
              <div className="whitespace-pre-wrap break-all">
                {formatSavedRulesOverview(
                  savedRulesReport.totalCount,
                  savedRulesReport.matchedResults.length,
                  savedRulesReport.unmatchedResults.length
                )}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-medium">
                    {chrome.i18n.getMessage("popupRulePanelSavedRulesMatchedTitle")} (
                    {savedRulesReport.matchedResults.length})
                  </div>
                  <button className={buttonClassName} onClick={() => setShowMatchedSavedRules((value) => !value)}>
                    {chrome.i18n.getMessage(
                      showMatchedSavedRules
                        ? "popupRulePanelSavedRulesHideMatchedBtn"
                        : "popupRulePanelSavedRulesShowMatchedBtn"
                    )}
                  </button>
                </div>
                <div className="mt-1 text-gray-400 whitespace-pre-wrap">
                  {chrome.i18n.getMessage("popupRulePanelSavedRulesMatchedDivider")}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-all">
                  {showMatchedSavedRules
                    ? savedRulesReport.matchedResults.length
                      ? savedRulesReport.matchedResults.join("\n\n")
                      : chrome.i18n.getMessage("popupRulePanelSavedRulesNoneMatched")
                    : chrome.i18n.getMessage("popupRulePanelSavedRulesMatchedCollapsed")}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-medium">
                    {chrome.i18n.getMessage("popupRulePanelSavedRulesUnmatchedTitle")} (
                    {savedRulesReport.unmatchedResults.length})
                  </div>
                  <button className={buttonClassName} onClick={() => setShowUnmatchedSavedRules((value) => !value)}>
                    {chrome.i18n.getMessage(
                      showUnmatchedSavedRules
                        ? "popupRulePanelSavedRulesHideUnmatchedBtn"
                        : "popupRulePanelSavedRulesShowUnmatchedBtn"
                    )}
                  </button>
                </div>
                <div className="mt-1 text-gray-400 whitespace-pre-wrap">
                  {chrome.i18n.getMessage("popupRulePanelSavedRulesUnmatchedDivider")}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-all">
                  {showUnmatchedSavedRules
                    ? savedRulesReport.unmatchedResults.length
                      ? savedRulesReport.unmatchedResults.join("\n\n")
                      : chrome.i18n.getMessage("popupRulePanelSavedRulesNoneUnmatched")
                    : chrome.i18n.getMessage("popupRulePanelSavedRulesUnmatchedCollapsed")}
                </div>
              </div>
            </div>
          ) : generateResult ? (
            <div className="mt-2 whitespace-pre-wrap break-all text-sm rounded bg-gray-900/40 p-2">
              {generateResult}
            </div>
          ) : null}
          {generatedRuleText ? (
            <>
              <textarea
                className="w-full mt-3 font-mono text-sm rounded-lg"
                value={generatedRuleText}
                onChange={(e) => setGeneratedRuleText(e.target.value)}
                rows={Math.max(generatedRuleText.split("\n").length, 8)}
              />
              <div className="mt-2 flex gap-4 flex-wrap">
                <button className={buttonClassName} onClick={handleAppendGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendBtn")}
                </button>
                <button className={buttonClassName} onClick={handleReplaceWithGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateReplaceBtn")}
                </button>
                <button className={buttonClassName} onClick={handleTestGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateTestBtn")}
                </button>
                <button className={buttonClassName} onClick={handleCopyGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateCopyBtn")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
