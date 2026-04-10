// import {truncateText} from "~/lib/util"
// import "../style.css"
import icon512 from "data-base64:~assets/icon512.png"
import loading from "data-base64:~assets/loading.gif"
import tickPNG from "data-base64:~assets/tick.png"
import type { PlasmoContentScript } from "plasmo"
import { v4 as uuidv4 } from "uuid"

import debounce from "~lib/debounce"

export const config: PlasmoContentScript = {
  matches: ["https://weibo.com/*"],
  // run_at: "document_start",
  all_frames: false
}

const storageKey = "fulltextbookmark"
const processedCards = new WeakSet<Element>()
const tickedSet = new Set<string>()
const tickedQueue: string[] = []
const feedCardSelector = "div[class^='vue-recycle-scroller__item-view']"
let weiboSupport = "true"
let feedObserver: MutationObserver | null = null

chrome.storage.local.get([`persist:${storageKey}`], (items) => {
  if (items[`persist:${storageKey}`]) {
    const rootParsed = JSON.parse(items[`persist:${storageKey}`])
    weiboSupport = rootParsed.weiboSupport
  }

  if (weiboSupport === "false") {
    return
  }

  scheduleAddButtons()
  if (document.readyState === "complete") {
    observeFeedCards()
  } else {
    window.addEventListener("load", observeFeedCards, { once: true })
  }
})

const scheduleAddButtons = debounce(
  () => {
    addButtonsToCards(document.querySelectorAll(feedCardSelector))
  },
  300,
  { leading: true, trailing: true }
)

function observeFeedCards() {
  if (!document.body || feedObserver) {
    return
  }

  feedObserver = new MutationObserver((mutations) => {
    const addedCards = [] as Element[]
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return
        }

        if (node.matches(feedCardSelector)) {
          addedCards.push(node)
        }

        node.querySelectorAll?.(feedCardSelector).forEach((card) => {
          addedCards.push(card)
        })
      })
    })

    if (addedCards.length > 0) {
      addButtonsToCards(addedCards)
    }
  })

  feedObserver.observe(document.body, {
    childList: true,
    subtree: true
  })
}

function addButtonsToCards(cards: Iterable<Element>) {
  for (const card of cards) {
    if (processedCards.has(card) || card.querySelector("#fulltext_bookmark_search-btn")) {
      continue
    }

    const urlA = card.querySelector("a[class^='head-info_time']") as HTMLAnchorElement | null
    const headName = card.querySelector("a[class*='head_name']")
    if (!urlA || !headName) {
      continue
    }

    const headInfo =
      card.querySelector("div[class*='toolbar_main']") ||
      card.querySelector("div[class*='head-info_info']")
    if (!headInfo) {
      continue
    }

    const content = Array.from(
      card.querySelectorAll("div[class^='detail_wbtext']")
    )
      .map((item) => item.textContent || "")
      .join("\n")
      .trim()

    const title = `@${headName.textContent || ""}://${content}`
    headInfo.appendChild(makeBtn(urlA.href, content, title))
    processedCards.add(card)
  }
}

function makeBtn(url: string, content: string, title: string) {
  const btn = document.createElement("btn")
  if (tickedSet.has(url)) {
    btn.style.backgroundImage = `url(${tickPNG})`
  } else {
    btn.style.backgroundImage = `url(${icon512})`
  }

  btn.style.backgroundSize = "contain"
  btn.style.backgroundRepeat = "no-repeat"
  btn.style.backgroundPosition = "center"
  btn.id = "fulltext_bookmark_search-btn"
  btn.style.borderRadius = "100%"
  btn.style.width = "20px"
  btn.style.height = "20px"
  btn.style.border = "none"
  btn.style.color = "#939393"
  btn.style.fontSize = "0.5rem"
  btn.onmouseover = function () {
    btn.style.backgroundColor = "#fff2e5"
  }
  btn.onmouseout = function () {
    btn.style.backgroundColor = "#fff"
  }
  if (!tickedSet.has(url)) {
    btn.onclick = async function () {
      btn.style.backgroundImage = `url(${loading})`
      await archive(url, content, title)
      btn.style.backgroundImage = `url(${tickPNG})`
    }
  }

  return btn
}

async function archive(url: string, content: string, title: string) {
  const data = {
    url: url,
    content: content,
    title: title,
    date: Date.now(),
    isBookmarked: true
  }
  if (tickedQueue.length > 100) {
    const removedUrls = tickedQueue.splice(0, 50)
    removedUrls.forEach((removedUrl) => tickedSet.delete(removedUrl))
  }
  tickedQueue.push(data.url)
  tickedSet.add(data.url)
  return chrome.runtime.sendMessage({
    command: "store",
    data: data,
    pageId: uuidv4()
  })
}
