import { memo, useState } from "react"
import Toggle from "react-toggle"
import { SettingBlock } from "../SettingBlock"
import { SettingItem } from "../SettingItem"
import { SettingItemCol } from "../SettingItemCol"

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

interface GeneralSettingsProps {
  searchEngineAdaption: boolean
  weiboSupport: boolean
  showOnlyBookmarkedResults: boolean
  tempMaxResults: string | number
  tempCustomSearchEngines: string
  customSearchEnginesError: string
  tempGPTKey: string
  tempGPTUrl: string
  tempGPTChatModel: string
  handleMaxResultsChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleMaxResultsSubmit: () => void
  handleCustomSearchEnginesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleBlurCustomSearchEngines: () => void
  applyCustomSearchEngines: (nextValue: string) => boolean
  onToggleSearchEngineAdaption: () => void
  onToggleWeiboSupport: () => void
  onToggleShowOnlyBookmarkedResults: () => void
}

export const GeneralSettings = memo(({
  searchEngineAdaption,
  weiboSupport,
  showOnlyBookmarkedResults,
  tempMaxResults,
  tempCustomSearchEngines,
  customSearchEnginesError,
  tempGPTKey,
  tempGPTUrl,
  tempGPTChatModel,
  handleMaxResultsChange,
  handleMaxResultsSubmit,
  handleCustomSearchEnginesChange,
  handleBlurCustomSearchEngines,
  applyCustomSearchEngines,
  onToggleSearchEngineAdaption,
  onToggleWeiboSupport,
  onToggleShowOnlyBookmarkedResults
}: GeneralSettingsProps) => {
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateResult, setGenerateResult] = useState("")
  const [generatedRuleText, setGeneratedRuleText] = useState("")

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
      lines.push("", chrome.i18n.getMessage("settingPageSettingSearchGenerateTestIssuesTitle"))
      response.issues.forEach((issue) => lines.push(`- ${issue}`))
    }

    if (response.suggestions?.length) {
      lines.push("", chrome.i18n.getMessage("settingPageSettingSearchGenerateTestSuggestionsTitle"))
      response.suggestions.forEach((suggestion) => lines.push(`- ${suggestion}`))
    }

    return lines.join("\n")
  }

  const handleGenerateRule = async () => {
    if (!tempGPTUrl || !tempGPTKey || !tempGPTChatModel) {
      setGenerateResult(chrome.i18n.getMessage("settingPageSettingGPTMissingConfig"))
      return
    }

    setGenerateLoading(true)
    setGenerateResult("")
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateTabError"))
        return
      }

      const pageContext = await chrome.tabs.sendMessage(activeTab.id, {
        command: "collect_search_engine_context"
      })

      if (!pageContext?.url) {
        setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateContextError"))
        return
      }

      const response = await chrome.runtime.sendMessage({
        command: "generate_search_engine_rule",
        context: pageContext,
        key: tempGPTKey,
        url: tempGPTUrl,
        chatModel: tempGPTChatModel
      })

      if (!response?.ok || !response?.rule) {
        setGeneratedRuleText("")
        setGenerateResult(`Error: ${response?.error || "Request failed"}`)
        return
      }

      setGeneratedRuleText(JSON.stringify(response.rule, null, 2))
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
      setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendFixError"))
      return
    }

    try {
      const parsedCurrent = tempCustomSearchEngines.trim()
        ? JSON.parse(tempCustomSearchEngines)
        : []
      const parsedRule = JSON.parse(generatedRuleText)
      const nextValue = JSON.stringify([...parsedCurrent, parsedRule], null, 2)
      const applied = applyCustomSearchEngines(nextValue)

      if (!applied) {
        setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendFail"))
        return
      }

      setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendSuccess"))
    } catch (e: any) {
      setGenerateResult(`Error: ${e.message}`)
    }
  }

  const handleReplaceWithGeneratedRule = () => {
    if (!generatedRuleText) {
      return
    }

    try {
      const parsedRule = JSON.parse(generatedRuleText)
      const nextValue = JSON.stringify([parsedRule], null, 2)
      const applied = applyCustomSearchEngines(nextValue)

      if (!applied) {
        setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateReplaceFail"))
        return
      }

      setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateReplaceSuccess"))
    } catch (e: any) {
      setGenerateResult(`Error: ${e.message}`)
    }
  }

  const handleTestGeneratedRule = async () => {
    if (!generatedRuleText) {
      return
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateTabError"))
        return
      }

      const rule = JSON.parse(generatedRuleText)
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        command: "test_search_engine_rule",
        rule
      })

      if (!response) {
        setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateTestUnavailable"))
        return
      }

      setGenerateResult(formatRuleTestResult(response as RuleTestResponse))
    } catch (e: any) {
      setGenerateResult(`Error: ${e.message}`)
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
      setGenerateResult(chrome.i18n.getMessage("settingPageSettingSearchGenerateCopySuccess"))
    } catch (e: any) {
      setGenerateResult(`Error: ${e.message}`)
    }
  }

  return (
    <>
      {chrome.i18n.getMessage("settingPageNotice")}

      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingDisplay")}>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingSearchPageDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingSearchPageNote")}
        >
          <Toggle checked={searchEngineAdaption} onChange={onToggleSearchEngineAdaption} />
        </SettingItem>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingWeiboDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingWeiboNote")}
        >
          <Toggle checked={weiboSupport} onChange={onToggleWeiboSupport} />
        </SettingItem>
      </SettingBlock>

      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingSearch")}>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingSearchShowBookDesp")}
        >
          <Toggle
            checked={showOnlyBookmarkedResults}
            onChange={onToggleShowOnlyBookmarkedResults}
          />
        </SettingItem>
        <p></p>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingSearchMaxDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingSearchMaxNote")}
        >
          <input
            type="text"
            className="w-32 h-6"
            value={tempMaxResults}
            onChange={handleMaxResultsChange}
            onBlur={handleMaxResultsSubmit}
          />{" "}
        </SettingItemCol>
        <p></p>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingSearchCustomEngineDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingSearchCustomEngineNote")}
        >
          <textarea
            className="w-96"
            value={tempCustomSearchEngines}
            onChange={handleCustomSearchEnginesChange}
            onBlur={handleBlurCustomSearchEngines}
            rows={Math.max(tempCustomSearchEngines.split("\n").length, 8)}
          />
          {customSearchEnginesError ? (
            <div className="text-sm text-red-500 whitespace-pre-wrap mt-2">
              {customSearchEnginesError}
            </div>
          ) : (
            <div className="text-sm text-gray-500 whitespace-pre-wrap mt-2">
              {chrome.i18n.getMessage("settingPageSettingSearchCustomEngineExample")}
            </div>
          )}
        </SettingItemCol>
        <p></p>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingSearchGenerateDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingSearchGenerateNote")}
        >
          <button
            className="text-blue-500 text-lg"
            onClick={handleGenerateRule}
            disabled={generateLoading}
          >
            {generateLoading
              ? chrome.i18n.getMessage("settingPageSettingSearchGenerateLoading")
              : chrome.i18n.getMessage("settingPageSettingSearchGenerateBtn")}
          </button>
          {generateResult && (
            <div className="mt-2 whitespace-pre-wrap break-all text-sm">{generateResult}</div>
          )}
          {generatedRuleText && (
            <>
              <textarea
                className="w-96 mt-3 font-mono text-sm"
                value={generatedRuleText}
                onChange={(e) => setGeneratedRuleText(e.target.value)}
                rows={Math.max(generatedRuleText.split("\n").length, 8)}
              />
              <div className="mt-2 flex gap-4 flex-wrap">
                <button className="text-blue-500 text-lg" onClick={handleAppendGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateAppendBtn")}
                </button>
                <button className="text-blue-500 text-lg" onClick={handleReplaceWithGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateReplaceBtn")}
                </button>
                <button className="text-blue-500 text-lg" onClick={handleTestGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateTestBtn")}
                </button>
                <button className="text-blue-500 text-lg" onClick={handleCopyGeneratedRule}>
                  {chrome.i18n.getMessage("settingPageSettingSearchGenerateCopyBtn")}
                </button>
              </div>
            </>
          )}
        </SettingItemCol>
      </SettingBlock>
    </>
  )
})
