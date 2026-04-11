import type { PlasmoContentScript } from "plasmo"

import debounce from "~lib/debounce"
import {
  getSearchEngineRule,
  getUrlVars,
  parseCustomSearchEngines,
  truncateText,
  type SearchEnginePageContext,
  type SearchEngineRule
} from "~/lib/utils"

export const config: PlasmoContentScript = {
  matches: ["<all_urls>"],
  all_frames: false
}

interface SearchResult {
  title: string
  url: string
  date: number
  ok: boolean
}

interface SearchRuleTestResult {
  ok: boolean
  urlMatched: boolean
  containerMatched: boolean
  queryMatched: boolean
  matchedContainer: string
  matchedQuery: string
  message: string
  issues: string[]
  suggestions: string[]
}

const resultWrapperStyle = `
  height: 130px;
  margin-top: 10px;
  margin-bottom: 15px;
  z-index: 10;
`

const resultBoxStyle = `
  max-height: 130px;
  border: 2px solid #D1D5DB;
  border-radius: calc(min(0.375rem, 6px));
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: calc(min(1rem, 16px));
  padding-bottom: calc(min(0.5rem, 8px));
  gap: 5px;
`

const resultTitleStyle = `
  font-size: calc(min(1.125rem, 18px));
  line-height: calc(min(1.75rem, 28px));
  color: #60a5fa;
`

const resultTextStyle = `
  font-size: calc(min(0.875rem, 14px));
  line-height: calc(min(1.25rem, 20px));
  color: black;
`

const resultFooterStyle = `
  font-size: calc(min(0.875rem, 14px));
  line-height: calc(min(1.25rem, 20px));
  color: #6B7280;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

const resultWatermarkStyle = `
  font-size: calc(min(0.75rem, 12px));
  line-height: calc(min(1rem, 16px));
  padding-top: calc(min(1rem, 16px));
  color: #E5E7EB;
`

let showSearchResult = true
let thisURL = window.location.href
const storageKey = "fulltextbookmark"
const mountPointId = "fulltext-bookmark-mount-point"
let searchResult: SearchResult | null = null
let queryWord = ""
let resultElement: HTMLDivElement | null = null
let currentSearchEngineName = ""
let currentSearchEngineRule: SearchEngineRule | null = null
let customSearchEngineRules: SearchEngineRule[] = []

const clearResult = () => {
  document.getElementById(mountPointId)?.remove()
}

const resetSearchState = () => {
  searchResult = null
  queryWord = ""
  resultElement = null
  currentSearchEngineName = ""
  currentSearchEngineRule = null
}

const runWhenDocumentReady = (callback: () => void) => {
  if (document.readyState === "complete") {
    callback()
    return
  }

  window.addEventListener("load", callback, { once: true })
}

function getResultContainer(rule: SearchEngineRule): HTMLElement | null {
  if (rule.containerSelector) {
    return document.querySelector(rule.containerSelector)
  }
  if (rule.containerId) {
    return document.getElementById(rule.containerId)
  }
  return null
}

function getQueryWord(rule: SearchEngineRule) {
  if (rule.queryParam) {
    const queryFromUrl = getUrlVars(thisURL)[rule.queryParam]
    if (queryFromUrl) {
      return queryFromUrl
    }
  }

  if (rule.queryInputSelector) {
    const input = document.querySelector(rule.queryInputSelector) as HTMLInputElement | null
    return input?.value?.trim() || ""
  }

  return ""
}

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const scoreCandidateText = (value: string) => {
  const normalized = value.toLowerCase()
  let score = 0
  if (normalized.includes("result")) score += 3
  if (normalized.includes("search")) score += 3
  if (normalized.includes("content")) score += 2
  if (normalized.includes("main")) score += 2
  if (normalized.includes("link")) score += 2
  if (normalized.includes("center")) score += 1
  return score
}

const sortCandidatesByScore = (values: string[]) =>
  [...values].sort((a, b) => scoreCandidateText(b) - scoreCandidateText(a) || a.length - b.length)

const getPageTextHints = () => {
  const textBlocks = Array.from(
    document.querySelectorAll<HTMLElement>("title, h1, h2, [role='main'], main, #search, #results, #links")
  )
    .map((element) => element.textContent?.trim() || "")
    .filter(Boolean)
    .map((text) => text.replace(/\s+/g, " ").slice(0, 120))

  return uniqueStrings(textBlocks).slice(0, 8)
}

const getPreferredValue = (currentValue: string | undefined, candidates: string[], prefix = "") => {
  const normalizedCurrentValue = currentValue?.trim() || ""
  const preferredCandidate = candidates.find((candidate) => candidate && candidate !== normalizedCurrentValue)

  if (!preferredCandidate) {
    return ""
  }

  return prefix ? `${prefix}${preferredCandidate}` : preferredCandidate
}

const getMessage = (name: string, substitutions?: string | string[]) =>
  chrome.i18n.getMessage(name, substitutions) || name

const buildRuleTestDiagnostics = (rule: SearchEngineRule, diagnostics: {
  urlMatched: boolean
  containerMatched: boolean
  queryMatched: boolean
}) => {
  const issues: string[] = []
  const suggestions: string[] = []
  const queryParamCandidates = sortCandidatesByScore(uniqueStrings(Object.keys(getUrlVars(window.location.href)).slice(0, 10)))
  const queryInputCandidates = sortCandidatesByScore(
    uniqueStrings(
      Array.from(
        document.querySelectorAll<HTMLInputElement>("input[type='search'], input[name*='q'], input[name*='query'], input[name*='word'], textarea")
      )
        .map((input) => {
          if (input.id) {
            return `#${input.id}`
          }
          if (input.name) {
            return `${input.tagName.toLowerCase()}[name='${input.name}']`
          }
          if (input.placeholder) {
            return `${input.tagName.toLowerCase()}[placeholder='${input.placeholder}']`
          }
          return ""
        })
        .slice(0, 10)
    )
  )
  const containerIdCandidates = sortCandidatesByScore(
    uniqueStrings(
      Array.from(
        document.querySelectorAll<HTMLElement>("main, #content, #search, #results, #links, #center_col, #b_results, #content_left, [role='main']")
      )
        .map((element) => element.id)
        .slice(0, 12)
    )
  )
  const containerSelectorCandidates = sortCandidatesByScore(
    uniqueStrings(
      Array.from(
        document.querySelectorAll<HTMLElement>("main, [role='main'], #search-result, #links, #b_results, #center_col, #content_left, .results, .search-results, .serp, .result-list")
      )
        .map((element) => {
          if (element.id) {
            return `#${element.id}`
          }
          const className = element.className
          if (typeof className === "string" && className.trim()) {
            return `.${className.trim().split(/\s+/)[0]}`
          }
          return element.tagName.toLowerCase()
        })
        .slice(0, 12)
    )
  )

  if (!diagnostics.urlMatched) {
    issues.push(getMessage("settingPageSettingSearchGenerateDiagUrlIssue"))
    suggestions.push(
      getMessage(
        "settingPageSettingSearchGenerateDiagUrlSuggestion",
        window.location.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      )
    )
  }

  if (!diagnostics.containerMatched) {
    issues.push(getMessage("settingPageSettingSearchGenerateDiagContainerIssue"))

    const suggestedSelector = getPreferredValue(rule.containerSelector, containerSelectorCandidates)
    const suggestedId = getPreferredValue(rule.containerId, containerIdCandidates, "#")

    if (suggestedSelector) {
      suggestions.push(getMessage("settingPageSettingSearchGenerateDiagContainerSelectorSuggestion", suggestedSelector))
    } else if (suggestedId) {
      suggestions.push(getMessage("settingPageSettingSearchGenerateDiagContainerIdSuggestion", suggestedId.slice(1)))
    } else {
      suggestions.push(getMessage("settingPageSettingSearchGenerateDiagContainerFallbackSuggestion"))
    }
  }

  if (!diagnostics.queryMatched) {
    issues.push(getMessage("settingPageSettingSearchGenerateDiagQueryIssue"))

    const suggestedQueryParam = getPreferredValue(rule.queryParam, queryParamCandidates)
    const suggestedQueryInputSelector = getPreferredValue(rule.queryInputSelector, queryInputCandidates)

    if (suggestedQueryParam) {
      suggestions.push(getMessage("settingPageSettingSearchGenerateDiagQueryParamSuggestion", suggestedQueryParam))
    } else if (suggestedQueryInputSelector) {
      suggestions.push(getMessage("settingPageSettingSearchGenerateDiagQuerySelectorSuggestion", suggestedQueryInputSelector))
    } else {
      suggestions.push(getMessage("settingPageSettingSearchGenerateDiagQueryFallbackSuggestion"))
    }
  }

  return {
    issues,
    suggestions
  }
}

function getSearchEnginePageContext(): SearchEnginePageContext {
  const url = window.location.href
  const title = document.title || ""
  const vars = getUrlVars(url)
  const searchInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[type='search'], input[name*='q'], input[name*='query'], input[name*='word'], textarea")
  )
  const queryFromInput = searchInputs.find((input) => input.value?.trim())?.value?.trim() || ""
  const queryFromUrl = Object.values(vars).find((value) => typeof value === "string" && value.trim()) || ""
  const query = getQueryWord(currentSearchEngineRule || { urlPattern: "" }) || queryFromInput || queryFromUrl

  const queryParamCandidates = sortCandidatesByScore(uniqueStrings(Object.keys(vars).slice(0, 10)))
  const queryInputCandidates = sortCandidatesByScore(
    uniqueStrings(
      searchInputs
        .map((input) => {
          if (input.id) {
            return `#${input.id}`
          }
          if (input.name) {
            return `${input.tagName.toLowerCase()}[name='${input.name}']`
          }
          if (input.placeholder) {
            return `${input.tagName.toLowerCase()}[placeholder='${input.placeholder}']`
          }
          return ""
        })
        .slice(0, 10)
    )
  )

  const containerIdCandidates = sortCandidatesByScore(
    uniqueStrings(
      Array.from(
        document.querySelectorAll<HTMLElement>("main, #content, #search, #results, #links, #center_col, #b_results, #content_left, [role='main']")
      )
        .map((element) => element.id)
        .slice(0, 12)
    )
  )

  const containerSelectorCandidates = sortCandidatesByScore(
    uniqueStrings(
      Array.from(
        document.querySelectorAll<HTMLElement>("main, [role='main'], #search-result, #links, #b_results, #center_col, #content_left, .results, .search-results, .serp, .result-list")
      )
        .map((element) => {
          if (element.id) {
            return `#${element.id}`
          }
          const className = element.className
          if (typeof className === "string" && className.trim()) {
            return `.${className.trim().split(/\s+/)[0]}`
          }
          return element.tagName.toLowerCase()
        })
        .slice(0, 12)
    )
  )

  return {
    url,
    title,
    query: typeof query === "string" ? query : "",
    queryParamCandidates,
    queryInputCandidates,
    containerIdCandidates,
    containerSelectorCandidates,
    pageTextHints: getPageTextHints()
  }
}

function testSearchEngineRule(rule: SearchEngineRule): SearchRuleTestResult {
  let urlMatched = false

  try {
    urlMatched = !!rule.urlPattern && new RegExp(rule.urlPattern).test(window.location.href)
  } catch {
    return {
      ok: false,
      urlMatched: false,
      containerMatched: false,
      queryMatched: false,
      matchedContainer: "",
      matchedQuery: "",
      message: "Invalid urlPattern",
      issues: [getMessage("settingPageSettingSearchGenerateDiagInvalidRegexIssue")],
      suggestions: [getMessage("settingPageSettingSearchGenerateDiagInvalidRegexSuggestion")]
    }
  }

  const container = getResultContainer(rule)
  const matchedQuery = getQueryWord(rule)
  const matchedContainer = rule.containerSelector || (container?.id ? `#${container.id}` : rule.containerId || "")
  const containerMatched = !!container
  const queryMatched = !!matchedQuery
  const ok = urlMatched && containerMatched && queryMatched
  const diagnostics = buildRuleTestDiagnostics(rule, {
    urlMatched,
    containerMatched,
    queryMatched
  })

  return {
    ok,
    urlMatched,
    containerMatched,
    queryMatched,
    matchedContainer,
    matchedQuery,
    message: ok ? "Matched" : "Rule did not fully match the current page",
    issues: diagnostics.issues,
    suggestions: diagnostics.suggestions
  }
}

function insertResult(originContainer: HTMLElement, newElement: HTMLDivElement, rule: SearchEngineRule) {
  const insertPosition = rule.insertPosition || "prepend"

  switch (insertPosition) {
    case "append":
      originContainer.appendChild(newElement)
      break
    case "beforebegin":
      originContainer.insertAdjacentElement("beforebegin", newElement)
      break
    case "afterbegin":
      originContainer.insertAdjacentElement("afterbegin", newElement)
      break
    case "beforeend":
      originContainer.insertAdjacentElement("beforeend", newElement)
      break
    case "afterend":
      originContainer.insertAdjacentElement("afterend", newElement)
      break
    default:
      originContainer.prepend(newElement)
      break
  }
}

function doWork() {
  if (!currentSearchEngineRule || !showSearchResult || !resultElement) {
    return
  }

  const originContainer = getResultContainer(currentSearchEngineRule)
  if (!originContainer) {
    return
  }

  clearResult()
  insertResult(originContainer, resultElement, currentSearchEngineRule)
}

function createResult() {
  const newEl = document.createElement("div")
  newEl.id = mountPointId
  newEl.style.cssText = resultWrapperStyle

  const box = document.createElement("div")
  box.style.cssText = resultBoxStyle
  newEl.appendChild(box)

  const titleSpan = document.createElement("span")
  titleSpan.style.cssText = resultTitleStyle
  box.appendChild(titleSpan)

  const urlLink = document.createElement("a")
  urlLink.href = searchResult?.url ?? ""
  urlLink.target = "_blank"
  urlLink.rel = "noopener noreferrer"
  urlLink.textContent = truncateText(searchResult?.title, 60)
  titleSpan.appendChild(urlLink)

  const urlSpan = document.createElement("span")
  urlSpan.style.cssText = resultTextStyle
  urlSpan.textContent = truncateText(searchResult?.url, 60)
  box.appendChild(urlSpan)

  const footer = document.createElement("div")
  footer.style.cssText = resultFooterStyle
  box.appendChild(footer)

  const dateSpan = document.createElement("span")
  dateSpan.textContent = new Date(searchResult?.date).toLocaleDateString()
  footer.appendChild(dateSpan)

  const watermarkSpan = document.createElement("span")
  watermarkSpan.textContent = `by fulltext-bookmark${currentSearchEngineName ? ` · ${currentSearchEngineName}` : ""}`
  watermarkSpan.style.cssText = resultWatermarkStyle
  footer.appendChild(watermarkSpan)

  return newEl
}

function prepare() {
  resetSearchState()
  clearResult()

  if (!thisURL || !showSearchResult) {
    return
  }

  const searchEngineRule = getSearchEngineRule(thisURL, customSearchEngineRules)
  if (!searchEngineRule) {
    return
  }

  currentSearchEngineRule = searchEngineRule
  currentSearchEngineName = searchEngineRule.name || "Custom"
  queryWord = getQueryWord(searchEngineRule)

  if (!queryWord) {
    return
  }

  chrome.runtime
    .sendMessage({ command: "google_result", search: queryWord })
    .then((v) => {
      searchResult = v
      if (!searchResult || searchResult.ok === false) {
        return
      }

      resultElement = createResult()
      runWhenDocumentReady(doWork)
    })
}

const handleLocationChange = debounce(
  () => {
    const nextURL = window.location.href
    if (nextURL === thisURL) {
      return
    }

    thisURL = nextURL
    prepare()
  },
  100,
  { leading: false, trailing: true }
)

const locationChangeEventName = "fulltext-bookmark-locationchange"

type PatchedHistoryMethod = History["pushState"] & {
  __fulltextBookmarkPatched?: boolean
}

const patchHistoryMethod = (method: "pushState" | "replaceState") => {
  const originalMethod = window.history[method] as PatchedHistoryMethod
  if (originalMethod.__fulltextBookmarkPatched) {
    return
  }

  const patchedMethod: PatchedHistoryMethod = function (...args) {
    const result = originalMethod.apply(window.history, args)
    window.dispatchEvent(new Event(locationChangeEventName))
    return result
  }

  patchedMethod.__fulltextBookmarkPatched = true
  window.history[method] = patchedMethod
}

const observeLocationChanges = () => {
  patchHistoryMethod("pushState")
  patchHistoryMethod("replaceState")

  window.addEventListener(locationChangeEventName, handleLocationChange)
  window.addEventListener("popstate", handleLocationChange)
  window.addEventListener("hashchange", handleLocationChange)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.command === "collect_search_engine_context") {
    sendResponse(getSearchEnginePageContext())
    return true
  }

  if (message.command === "test_search_engine_rule") {
    sendResponse(testSearchEngineRule(message.rule))
    return true
  }

  return false
})

const applyPersistedSettings = (persistedValue?: string) => {
  if (!persistedValue) {
    showSearchResult = true
    customSearchEngineRules = []
    return
  }

  const rootParsed = JSON.parse(persistedValue)
  showSearchResult = rootParsed?.searchEngineAdaption !== false
  customSearchEngineRules = parseCustomSearchEngines(rootParsed?.customSearchEngines || "")
}

chrome.storage.local.get([`persist:${storageKey}`], (items) => {
  applyPersistedSettings(items[`persist:${storageKey}`])
  prepare()
  observeLocationChanges()
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return
  }

  const persistedChange = changes[`persist:${storageKey}`]
  if (!persistedChange) {
    return
  }

  applyPersistedSettings(persistedChange.newValue)
  if (!showSearchResult) {
    clearResult()
    resetSearchState()
    return
  }

  prepare()
})
