import { memo, useEffect, useRef } from "react"
import Toggle from "react-toggle"

import { SettingBlock } from "../SettingBlock"
import { SettingItem } from "../SettingItem"
import { SettingItemCol } from "../SettingItemCol"

const customSearchEnginesAnchor = "custom-search-engines"

const getFocusTarget = () => {
  const currentUrl = new URL(window.location.href)
  return currentUrl.searchParams.get("focus") || currentUrl.hash.replace(/^#/, "")
}

const clearFocusTarget = () => {
  const currentUrl = new URL(window.location.href)
  currentUrl.searchParams.delete("focus")
  currentUrl.hash = ""
  window.history.replaceState({}, "", currentUrl.toString())
}

interface GeneralSettingsProps {
  searchEngineAdaption: boolean
  weiboSupport: boolean
  showOnlyBookmarkedResults: boolean
  tempMaxResults: string | number
  tempCustomSearchEngines: string
  customSearchEnginesError: string
  handleMaxResultsChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleMaxResultsSubmit: () => void
  handleCustomSearchEnginesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleBlurCustomSearchEngines: () => void
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
  handleMaxResultsChange,
  handleMaxResultsSubmit,
  handleCustomSearchEnginesChange,
  handleBlurCustomSearchEngines,
  onToggleSearchEngineAdaption,
  onToggleWeiboSupport,
  onToggleShowOnlyBookmarkedResults
}: GeneralSettingsProps) => {
  const customSearchEnginesRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const focusCustomSearchEnginesEditor = () => {
      if (getFocusTarget() !== customSearchEnginesAnchor || !customSearchEnginesRef.current) {
        return
      }

      customSearchEnginesRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      })
      customSearchEnginesRef.current.focus()
      window.setTimeout(() => {
        customSearchEnginesRef.current?.focus()
        clearFocusTarget()
      }, 250)
    }

    focusCustomSearchEnginesEditor()
    window.addEventListener("hashchange", focusCustomSearchEnginesEditor)

    return () => {
      window.removeEventListener("hashchange", focusCustomSearchEnginesEditor)
    }
  }, [])

  return (
    <>
      {chrome.i18n.getMessage("settingPageNotice")}

      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingDisplay")}>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingSearchPageDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingSearchPageNote")}>
          <Toggle checked={searchEngineAdaption} onChange={onToggleSearchEngineAdaption} />
        </SettingItem>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingWeiboDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingWeiboNote")}>
          <Toggle checked={weiboSupport} onChange={onToggleWeiboSupport} />
        </SettingItem>
      </SettingBlock>

      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingSearch")}>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingSearchShowBookDesp")}>
          <Toggle
            checked={showOnlyBookmarkedResults}
            onChange={onToggleShowOnlyBookmarkedResults}
          />
        </SettingItem>
        <p></p>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingSearchMaxDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingSearchMaxNote")}>
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
          notes={chrome.i18n.getMessage("settingPageSettingSearchCustomEngineNote")}>
          <textarea
            id={customSearchEnginesAnchor}
            ref={customSearchEnginesRef}
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
      </SettingBlock>
    </>
  )
})
