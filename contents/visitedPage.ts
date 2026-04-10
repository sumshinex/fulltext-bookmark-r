import { Readability, isProbablyReaderable } from "@mozilla/readability"
import type { PlasmoContentScript } from "plasmo"
import { v4 as uuidv4 } from "uuid"

export const config: PlasmoContentScript = {
  matches: ["<all_urls>"],
  all_frames: false,
  match_about_blank: false,
  run_at: "document_start"
}

const excludeURLs = [
  "https://www.google.com/*",
  "https://cn.bing.com/*",
  "https://www.baidu.com/*",
  "https://weibo.com/*",
]

const pageId = uuidv4()
const storageKey = "fulltextbookmark"
const minReadableTextLength = 200
let options = {
  storeEveryPage: true,
  bookmarkAdaption: true,
  forbiddenURLs: ""
}

if (!isExcludeURL(excludeURLs, window.location.href)) {
  chrome.storage.local.get([`persist:${storageKey}`], (items) => {
    if (items[`persist:${storageKey}`]) {
      options = JSON.parse(items[`persist:${storageKey}`])
    }

    if (isExcludeURL(JSON.parse(options.forbiddenURLs), window.location.href)) {
      return
    }

    if (options.bookmarkAdaption.toString() === "true") {
      newBookmarkListener()
    }

    if (options.storeEveryPage.toString() === "true") {
      scheduleParsePageAndSend()
    }
  })
}

const scheduleTask = (callback: () => void) => {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 1500 })
    return
  }

  window.setTimeout(callback, 0)
}

const runWhenPageReady = (callback: () => void) => {
  if (document.readyState === "complete") {
    callback()
    return
  }

  window.addEventListener("load", callback, { once: true })
}

const scheduleParsePageAndSend = () => {
  runWhenPageReady(() => {
    scheduleTask(() => {
      parsePageAndSend()
    })
  })
}

const newBookmarkListener = (): void => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "bookmark") {
      if (options.storeEveryPage.toString() === "true") {
        sendResponse({ pageId: pageId, stored: true })
      } else {
        const article = parsePage()
        sendResponse({ data: article, pageId: pageId, stored: false })
      }
    } else {
      sendResponse({})
    }
    return true
  })
}

function isExcludeURL(patterns: string[], url: string): boolean {
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

function parsePageAndSend() {
  const article = parsePage()
  if (!article.content && !article.title) {
    return
  }

  chrome.runtime
    .sendMessage({ command: "store", data: article, pageId: pageId })
    .then(() => {})
}

function parsePage() {
  const fallbackTitle = document.title || ""
  const fallbackContent = document.body?.innerText?.trim() || ""
  const fallbackArticle = {
    title: fallbackTitle,
    url: window.location.href || "",
    content: fallbackContent,
    date: Date.now()
  }

  if (fallbackContent.length < minReadableTextLength) {
    return fallbackArticle
  }

  const documentClone = document.cloneNode(true) as Document
  if (isProbablyReaderable(documentClone)) {
    const readableArticle = new Readability(documentClone as Document).parse()
    if (readableArticle) {
      return {
        title: readableArticle.title || fallbackTitle,
        content: readableArticle.textContent || fallbackContent,
        url: window.location.href || "",
        date: Date.now()
      }
    }
  }

  return fallbackArticle
}
