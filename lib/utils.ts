export function isMatchURL(patterns: string[], url: string): boolean {
  if (!patterns || patterns.length < 1) {
    return false
  }
  for (let i = 0; i < patterns.length; i++) {
    const re = new RegExp(patterns[i])
    if (!re) {
      continue
    }
    if (re.test(url)) {
      return true
    }
  }
  return false
}

export function truncateText(text: string, maxLength: number) {
  if (!text) {
    return ""
  }
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "..."
  }
  return text
}

export function deleteAfterSources(str: string): string {
  const index = str.indexOf("SOURCES:")
  if (index === -1) {
    return str
  }
  return str.substring(0, index)
}

export function findNearestArrays(arrayIndex: number[][], queryArray: number[], N: number): number[] {
  const distances = []
  for (let i = 0; i < arrayIndex.length; i++) {
    const distance = cosineDistance(arrayIndex[i], queryArray)
    distances.push({ index: i, distance })
  }
  distances.sort((a, b) => b.distance - a.distance)
  const nearestArrays = []
  for (let i = 0; i < N; i++) {
    if (distances[i]) {
      nearestArrays.push(distances[i].index)
    }
  }
  return nearestArrays
}

export function cosineDistance(arr1: number[], arr2: number[]): number {
  if (arr1.length !== arr2.length) {
    throw new Error("Arrays must have the same length")
  }
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < arr1.length; i++) {
    dotProduct += arr1[i] * arr2[i]
    normA += arr1[i] * arr1[i]
    normB += arr2[i] * arr2[i]
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) {
    return 0
  }
  return dotProduct / denominator
}

export function vectorToBlob(arr) {
  const typedarr = new Float64Array(arr)
  const buffer = typedarr.buffer
  const blob = new Blob([buffer])
  return blob
}

export async function blobToVector(blob) {
  const arrayBuffer = new Uint8Array(await blob.arrayBuffer())
  return Array.from(new Float64Array(arrayBuffer.buffer))
}

export function byteConvert(bytes) {
  if (isNaN(bytes)) {
    return ""
  }
  const symbols = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  let exp = Math.floor(Math.log(bytes) / Math.log(2))
  if (exp < 1) {
    exp = 0
  }
  const i = Math.floor(exp / 10)
  bytes = bytes / Math.pow(2, 10 * i)

  if (bytes.toString().length > bytes.toFixed(2).toString().length) {
    bytes = bytes.toFixed(2)
  }
  return bytes + " " + symbols[i]
}

export function getBookmarkUrl(urlResult) {
  let removedURLs = []
  if (urlResult.length > 0) {
    urlResult.forEach((e) => {
      if (e.children && e.children.length > 0) {
        removedURLs = removedURLs.concat(getBookmarkUrl(e.children))
      } else {
        removedURLs.push(handleUrlRemoveHash(e.url))
      }
    })
  } else {
    if (urlResult.node.children) {
      removedURLs = removedURLs.concat(getBookmarkUrl(urlResult.node.children))
    } else {
      removedURLs.push(handleUrlRemoveHash(urlResult.node.url))
    }
  }
  return removedURLs
}

export function handleUrlRemoveHash(url) {
  const urlSplit = url.split("#")
  return urlSplit[0]
}

export function getUrlVars(url) {
  const vars = {}
  url.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m, key, value) => {
    vars[key] = decodeURI(value)
    return m
  })
  return vars
}

export type SearchInsertPosition =
  | "prepend"
  | "append"
  | "beforebegin"
  | "afterbegin"
  | "beforeend"
  | "afterend"

export interface SearchEngineRule {
  name?: string
  urlPattern: string
  containerId?: string
  containerSelector?: string
  queryParam?: string
  queryInputSelector?: string
  insertPosition?: SearchInsertPosition
}

export interface SearchEnginePageContext {
  url: string
  title: string
  query: string
  queryParamCandidates: string[]
  queryInputCandidates: string[]
  containerIdCandidates: string[]
  containerSelectorCandidates: string[]
  pageTextHints: string[]
}

const validInsertPositions = new Set<SearchInsertPosition>([
  "prepend",
  "append",
  "beforebegin",
  "afterbegin",
  "beforeend",
  "afterend"
])

export function validateCustomSearchEngines(config: string): string {
  if (!config || !config.trim()) {
    return ""
  }

  try {
    const parsed = JSON.parse(config)
    if (!Array.isArray(parsed)) {
      return "Custom search engine rules must be a JSON array."
    }

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i]
      if (!item?.urlPattern) {
        return `Rule ${i + 1} is missing urlPattern.`
      }
      if (!item?.containerId && !item?.containerSelector) {
        return `Rule ${i + 1} needs containerId or containerSelector.`
      }
      if (!item?.queryParam && !item?.queryInputSelector) {
        return `Rule ${i + 1} needs queryParam or queryInputSelector.`
      }
      if (
        item?.insertPosition &&
        !validInsertPositions.has(item.insertPosition)
      ) {
        return `Rule ${i + 1} has an invalid insertPosition.`
      }
    }

    return ""
  } catch {
    return "Custom search engine rules must be valid JSON."
  }
}

export function parseCustomSearchEngines(config: string): SearchEngineRule[] {
  const error = validateCustomSearchEngines(config)
  if (error) {
    return []
  }

  if (!config || !config.trim()) {
    return []
  }

  const parsed = JSON.parse(config)
  return parsed.map((item) => ({
    ...item,
    insertPosition: item.insertPosition || "prepend"
  }))
}

export function getSearchEngineRule(url: string, customRules: SearchEngineRule[] = []): SearchEngineRule | null {
  const builtInRules: SearchEngineRule[] = [
    {
      name: "Google",
      urlPattern: "^https://www\\.google\\.com/search.*",
      containerId: "center_col",
      queryParam: "q",
      insertPosition: "prepend"
    },
    {
      name: "Bing CN",
      urlPattern: "^https://cn\\.bing\\.com/search.*",
      containerId: "b_results",
      queryParam: "q",
      insertPosition: "prepend"
    },
    {
      name: "Bing",
      urlPattern: "^https://www\\.bing\\.com/search.*",
      containerId: "b_results",
      queryParam: "q",
      insertPosition: "prepend"
    },
    {
      name: "Baidu",
      urlPattern: "^https://www\\.baidu\\.com/.*",
      containerId: "content_left",
      queryParam: "wd",
      insertPosition: "prepend"
    },
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
  ]

  const rules = [...customRules, ...builtInRules]
  for (const rule of rules) {
    try {
      if (new RegExp(rule.urlPattern).test(url)) {
        return rule
      }
    } catch {
      continue
    }
  }
  return null
}

export function isGoogle(url) {
  return getSearchEngineRule(url)?.name === "Google"
}

export function isBing(url) {
  const ruleName = getSearchEngineRule(url)?.name
  return ruleName === "Bing" || ruleName === "Bing CN"
}

export const isBaidu = (url) => {
  return getSearchEngineRule(url)?.name === "Baidu"
}

export const isWeibo = (url) => {
  const reg = /^https:\/\/weibo.com\/[0-9]+\/[A-Za-z0-9]+/g
  return reg.test(url)
}

export const getWeiboEncode = (url) => {
  const urlSplit = url.split("/")
  return urlSplit[4]
}

export function judgeChineseChar(str: string) {
  const reg = /[\u4E00-\u9FA5]/g
  const a = reg.test(str)

  return a
}

export function judgeJapaneseChar(str: string) {
  const reg = /[\u3040-\u30FF]/g
  const a = reg.test(str)
  return a
}
