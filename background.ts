


export {};
import Dexie from "dexie";

import "dexie-export-import";
import { chat, chatWithRefs, fetchAvailableModels, genEmbedding, initApi } from "~lib/chat";
import { v4 as uuidv4 } from "uuid";
import debounce from "~lib/debounce";
// @ts-ignore
import type { IGPTAnswer } from "~lib/interface";
// @ts-ignore

// @ts-ignore
import mid from "~lib/mid";
import {
  blobToVector,
  findNearestArrays,
  getBookmarkUrl,
  getWeiboEncode,
  handleUrlRemoveHash,
  isWeibo,
  type SearchEnginePageContext,
  validateCustomSearchEngines,
  vectorToBlob,
} from "~lib/utils";

import { textSplitter } from "~lib/textsplitter-utils";

import {
  setGPTAnswer,
  setGPTLoading,
  setGPTQuery,
} from "~store/stat-slice";
// import {index as voyIndex, search as voySearch} from "@src/lib/voy/voy_search"
// import reloadOnUpdate from "virtual:reload-on-update-in-background-script";
// reloadOnUpdate("pages/background");

/**
 * Extension reloading is necessary because the browser automatically caches the css.
 * If you do not use the css of the content script, please delete it.
 */
// reloadOnUpdate("pages/content/style.scss");



import { persistor, store } from "~store/store";
import { wordSplit } from "~lib/wordSplit";
import { createOffscreen } from "~lib/keepAlive";
import { initStoragePersistence } from "~lib/presistStorage";
let userOps = store.getState();
persistor.subscribe(() => {
  userOps = store?.getState()
});


// ==============================================================
// keep alive

// chrome.runtime.onStartup.addListener(() => {
//   console.log("start up")
//   createOffscreen();
// });

(async function(){
  await createOffscreen();
})();

// ====================================================================================================
// Database setup
// Dexie.delete("PageDatabase")
const db = new Dexie("PageDatabase");
db.version(1).stores({
  pages: "++id,url,title,date,pageId,isBookmarked",
  contents: "&pid,*contentWords,*titleWords,content", // pid is id of pages table
  vectors: "++id,pid,serial",
});
db.open();

// delete outdated records

// delete content table
// @ts-ignore
db.transaction("rw", db.pages, db.contents, async () => {
  // @ts-ignore
  const delIDs = await db.pages
    .where("date")
    .below(Date.now() - userOps.tempPageExpireTime)
    .and(item => item.isBookmarked == false).primaryKeys();

  if (delIDs && delIDs.length > 0) {
    // @ts-ignore
    await db.pages.where("id").anyOf(delIDs).delete();
    // @ts-ignore
    await db.contents.where("pid").anyOf(delIDs).delete();
  }
});



// (async function () {
//   await initStoragePersistence();
// })();

// ====================================================================================================

interface PageData {
  pageId?: string;
  url: string;
  content?: string;
  title: string;
  date: number;
  isBookmarked?: boolean;
  contentWords?: string[];
  titleWords?: string[];
}

interface Message {
  command: string;
  data: PageData;
  pageId: string;
}

function normalizeSearchEnginePageContext(context: Partial<SearchEnginePageContext>): SearchEnginePageContext {
  const toStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim()).slice(0, 10)
      : []

  return {
    url: typeof context?.url === "string" ? context.url : "",
    title: typeof context?.title === "string" ? context.title : "",
    query: typeof context?.query === "string" ? context.query : "",
    queryParamCandidates: toStringArray(context?.queryParamCandidates),
    queryInputCandidates: toStringArray(context?.queryInputCandidates),
    containerIdCandidates: toStringArray(context?.containerIdCandidates),
    containerSelectorCandidates: toStringArray(context?.containerSelectorCandidates),
    pageTextHints: toStringArray(context?.pageTextHints),
  }
}

function extractJsonObject(text: string): string {
  if (!text) {
    throw new Error("Empty model response");
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const content = fencedMatch?.[1]?.trim() || text.trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }

  return content.slice(start, end + 1);
}

function buildSearchEngineRulePrompt(context: SearchEnginePageContext): string {
  return [
    "Generate one SearchEngineRule JSON object for a browser extension.",
    "Return JSON only. No markdown, no explanation.",
    "Allowed keys: name, urlPattern, containerId, containerSelector, queryParam, queryInputSelector, insertPosition.",
    "Requirements:",
    "- urlPattern must be a valid regular expression string that matches pages like the current URL.",
    "- Prefer queryParam when the query is clearly present in the URL.",
    "- Prefer containerSelector when it is more stable than containerId.",
    "- Prefer candidates that look like search result containers.",
    "- Use pageTextHints to infer whether the page is a search result page and which container is most plausible.",
    "- include only one of containerId/containerSelector when possible.",
    "- include only one of queryParam/queryInputSelector when possible.",
    "- insertPosition should usually be prepend.",
    "- The rule must be suitable for JSON.parse().",
    "Current page context:",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

async function generateSearchEngineRule(context: SearchEnginePageContext, config: {
  key: string;
  url: string;
  chatModel: string;
}) {
  const pageContext = normalizeSearchEnginePageContext(context);
  if (!pageContext.url) {
    throw new Error("Missing page context");
  }

  if (!config.key || !config.url || !config.chatModel) {
    throw new Error("Missing GPT configuration");
  }

  initApi(config.key, config.url, {
    chatModel: config.chatModel,
  });

  const response = await chat(buildSearchEngineRulePrompt(pageContext));
  const jsonText = extractJsonObject(response);
  const rule = JSON.parse(jsonText);
  const validationError = validateCustomSearchEngines(JSON.stringify([rule]));

  if (validationError) {
    throw new Error(validationError);
  }

  if (!rule.insertPosition) {
    rule.insertPosition = "prepend";
  }

  return rule;
}

// ====================================================================================================
//===================================================================
// get existed bookmarks
function getBookmarksOnInstalled(){
  chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
    const bookmarks = [];

    function traverseBookmarkNode(node) {
      if (node.children) {
        for (const childNode of node.children) {
          traverseBookmarkNode(childNode);
        }
      } else {
        // console.log(node)
        bookmarks.push({
          title: node.title,
          url: node.url,
          date: node.dateAdded,
        });
      }
    }

    for (const rootNode of bookmarkTreeNodes) {
      traverseBookmarkNode(rootNode);
    }
    // console.log(bookmarks)
    bookmarks.forEach((e) => {
      (async () => {
        await saveToDatabase({
          title: e.title,
          url: handleUrlRemoveHash(e.url),
          date: e.date,
          pageId: uuidv4(),
          isBookmarked: true,
        });
      })();
    });
  });
}

chrome.runtime.onInstalled.addListener(
 ()=>{
  getBookmarksOnInstalled()
 }
)

// listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.command) {
    case 'sync':
      userOps = message.state;
      return "a";
    case "keepAlive":
      return "a"
    // case "firsttime":
    //   console.log("firsttime");
      
    //   getBookmarksOnInstalled()
    //   return "a"
    case "store":
      // console.log("====================================");
      // console.log(message, sender);
      // console.log("====================================");
      // save to database
      (async () => {
        if (
          message.data.isBookmarked === true ||
          message.data.isBookmarked === false
        ) {
          // @ts-ignore
        } else {
          const bookmarkSearchResult = await chrome.bookmarks.search(
            message.data.url
          );
          // console.log("ppp",bookmarkSearchResult,message.data.url)
          if (bookmarkSearchResult && bookmarkSearchResult.length > 0) {
            // console.log("already bookmrked")
            message.data.isBookmarked = true;
          } else {
            message.data.isBookmarked = false;
          }
        }

        await saveToDatabase({ ...message.data, pageId: message.pageId });
        changeBadge(sender.tab.id);
        sendResponse("ok");
      })();
      return true;
    case "google_result":
      // console.log("google result", message.search)
      (async () => {
        const result = await searchString(message.search, "short");
        // console.log("search result", result)
        if (result && result.length > 0) {
          const matchedFirst = result[0];
          sendResponse({
            ...matchedFirst,
            ok: true,
          });
        } else {
          sendResponse({
            title: "",
            url: "",
            date: 0,
            ok: false,
          });
        }
      })();
      return true;
    case "popsearch":
      (async () => {
        const result = await searchString(message.search, "long");
        sendResponse(result);
      })();
      return true;
    case "gptsearch":
      (async () => {
        store.dispatch(setGPTLoading(true));
        store.dispatch(setGPTAnswer(null));
        store.dispatch(setGPTQuery(message.search));
        const apikey = message.key || userOps.GPTKey;
        const apiBaseUrl = message.url || userOps.GPTURL;
        const chatModel = message.chatModel || userOps.GPTChatModel;
        const embeddingModel = message.embeddingModel || userOps.GPTEmbeddingModel;
        const promptTemplate = message.promptTemplate || userOps.GPTPromptTemplate;

        initApi(apikey, apiBaseUrl, {
          chatModel,
          embeddingModel,
          promptTemplate,
        });
        const result = await searchStringGPT(message.search);
        store.dispatch(setGPTAnswer(result));
        store.dispatch(setGPTLoading(false));
        // console.log("search result", result)
        sendResponse(result);
      })();
      return true;
    case "gpt_models":
      (async () => {
        try {
          const apikey = message.key || userOps.GPTKey;
          const apiBaseUrl = message.url || userOps.GPTURL;
          initApi(apikey, apiBaseUrl, {
            chatModel: userOps.GPTChatModel,
            embeddingModel: userOps.GPTEmbeddingModel,
            promptTemplate: userOps.GPTPromptTemplate,
          });
          const models = await fetchAvailableModels(apikey, apiBaseUrl);
          sendResponse({ ok: true, models });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error.message || "Failed to fetch models",
            models: [],
          });
        }
      })();
      return true;
    case "generate_search_engine_rule":
      (async () => {
        try {
          const rule = await generateSearchEngineRule(message.context, {
            key: message.key || userOps.GPTKey,
            url: message.url || userOps.GPTURL,
            chatModel: message.chatModel || userOps.GPTChatModel,
          });
          sendResponse({ ok: true, rule });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error.message || "Failed to generate rule",
          });
        }
      })();
      return true;
    case "clearAllData":
      (async () => {
        // @ts-ignore
        await db.pages.clear();
        // @ts-ignore
        await db.contents.clear();
        sendResponse("ok");
      })();
      return true;
    case "export":
      (async () => {
        const blob = await db.export();
        // console.log(blob)
        // download(blob, "dlTextBlob.json", "application/json")
        const reader = new FileReader();
        reader.onload = function (e) {
          // let readerres = reader.result;
          // @ts-ignore
          const parseObj = JSON.parse(this.result);
          // console.log(parseObj)
          sendResponse(parseObj);
        };
        reader.readAsText(blob, "utf-8");
      })();
      return true;
    case "import":
      (async () => {
        try {
          if (!message.data || !message.data.url) {
            console.error("Invalid import data: missing URL");
            sendResponse("error: invalid data");
            return;
          }

          // Generate pageId if not provided
          if (!message.data.pageId) {
            message.data.pageId = uuidv4();
          }

          // Save to database
          await saveToDatabase(message.data);
          sendResponse("ok");
        } catch (error) {
          console.error("Error importing data:", error);
          sendResponse("error: " + (error.message || "unknown error"));
        }
      })();
      return true;
    default:
      sendResponse("invalid command");
      break;
  }
});

// bookmark linstener
chrome.bookmarks.onCreated.addListener((id, bm) => {
  // console.log("bookmarks created:", id, bm)
  // const userOptions = store.getState();
  // console.log("ss oprion", userOptions)
  if (!userOps.bookmarkAdaption) {
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // console.log("tabs tabs",tabs)
    chrome.tabs.sendMessage(
      tabs[0].id,
      { command: "bookmark", data: "create" },
      (resp) => {
        // console.log("book resp", resp)
        // change archive status in db
        if (!resp) {
          (async () => {
            await saveToDatabase({
              title: tabs[0].title,
              url: handleUrlRemoveHash(tabs[0].url),
              date: Date.now(),
              pageId: tabs[0].id.toString(),
              isBookmarked: true,
            });
          })();
        } else {
          if (resp.stored === true) {
            bookmark(resp.pageId);
          } else {
            // console.log("bookmark not stored")
            resp.data.isBookmarked = true;
            (async () => {
              await saveToDatabase({ ...resp.data, pageId: resp.pageId });
            })();
          }
        }

        return true;
      }
    );
  });
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  // console.log("bookmark remove")
  const removedURLs = getBookmarkUrl(removeInfo);
  unBookmarked(removedURLs);
});

//

// chrome.omnibox.setDefaultSuggestion(
//   {description:"search fulltext bookmark/history "},
// )

// chrome.omnibox.onInputStarted.addListener(() => {
//   console.log("start omnibox input")
// })

const omniboxSearch = debounce(
  async (text, suggest) => {
    // console.log("input changed", text)
    const result = await searchString(text, "long");
    // slice to length 5
    const resultSlice = result.slice(0, 5);
    const sug = resultSlice.map((e) => {
      return {
        content: e.url,
        description: `${e.title} - <url>${e.url} </url>`,
      };
    });
    suggest(sug);
  },
  500,
  { leading: false, trailing: true }
);

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  omniboxSearch(text, suggest);
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  if (disposition == "newForegroundTab") {
    // console.log("newForegroundTab")
    // create a new tab and load the url
    chrome.tabs.create({ url: text });
  }
  if (disposition == "newBackgroundTab") {
    // console.log("newBackgroundTab")
    // create a new background tab and load the url
    chrome.tabs.create({ url: text, active: false });
  }
  if (disposition == "currentTab") {
    // console.log("currentTab")
    // redirect current tab to the url
    chrome.tabs.query({ active: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: text });
    });
  }
});

// ====================================================================================================
function changeBadge(tabId) {
  chrome.action.setBadgeText({
    text: "√",
    tabId: tabId,
  });
  // @ts-ignore
  chrome.action.setBadgeTextColor({
    color: "white",
    tabId: tabId,
  });
  chrome.action.setBadgeBackgroundColor({
    color: "#2ab24c",
    tabId: tabId,
  });
  chrome.action.setTitle({
    title: "page archieved",
    tabId: tabId,
  });
}

// ====================================================================================================
// database functions
function unBookmarked(urls: string[]): void {
  // delete from database matching the removedURLs
  // console.log("+++++++++++++++",urls)
  // @ts-ignore
  db.pages
    .where("url")
    .anyOf(urls)
    .modify({ isBookmarked: false })
    .then(() => {
      // console.log("unbookmarked")
    });
}

function bookmark(pageId: string) {
  // @ts-ignore
  db.transaction("rw", db.pages, async () => {
    // @ts-ignore
    const existed = await db.pages.where("pageId").equals(pageId).first();
    if (existed && existed.id) {
      // @ts-ignore
      await db.pages.update(existed.id, { isBookmarked: true });
      const options = store.getState();
      if (options.remoteStore) {
        // console.log("bookmark remote 1")
        sendToRemote({ ...existed, isBookmarked: true });
      }
    }
  });
}

async function saveToDatabase(data: PageData) {
  // @ts-ignore
  const existedId = await db.pages.where("pageId").equals(data.pageId).first();
  if (existedId && existedId.id) {
    return;
  }

  const indexData = {
    url: data.url,
    title: data.title,
    date: data.date,
    isBookmarked: data.isBookmarked,
    pageId: data.pageId,
  };
  const options = store.getState();
  if (options.remoteStore) {
    if (options.remoteStoreEveryPage || data.isBookmarked) {
      sendToRemote(indexData);
    }
  }

  // @ts-ignore
  db.transaction("rw", db.pages, db.contents, async () => {
    // @ts-ignore
    const existed = await db.pages.where("url").equals(data.url).first();
    const contentWords = wordSplit(data.content);
    const titleWords = wordSplit(data.title);
    const hasSearchableContent = contentWords.length > 0 || titleWords.length > 0;
    const largeData = {
      contentWords,
      titleWords,
      content: data.content,
    };

    if (existed && existed.id) {
      const id = existed.id;
      const ps = [];
      // @ts-ignore
      ps.push(db.pages.update(id, indexData));
      if (hasSearchableContent) {
        // @ts-ignore
        ps.push(db.contents.where("pid").equals(id).modify(largeData));
      }
      await Promise.all(ps);
      return;
    }

    // @ts-ignore
    const id = await db.pages.add(indexData);
    // @ts-ignore
    await db.contents.add({ pid: id, ...largeData });
  }).catch((e) => {
    alert(e.stack || e);
  });
}

// a search method that give the most possible result
function findAndSort(prefixes, field, GPT): Promise<any[]> {
  // @ts-ignore
  return db.transaction("r", db.contents, db.pages, function* () {
    const results = yield Dexie.Promise.all(
      prefixes.map((prefix) =>
        // @ts-ignore
        db.contents.where(field).startsWith(prefix).primaryKeys()
      )
    );

    const counts = new Map<number, number>();
    results.forEach((matches) => {
      matches.forEach((id) => {
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });

    const limit = GPT ? userOps.GPTSearchMaxNumber : userOps.maxResults;
    let intArray = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    if (userOps.showOnlyBookmarkedResults === true && !GPT) {
      const bookmarkedLimit = Math.max(limit, 300);
      const candidateIds = intArray.slice(0, bookmarkedLimit);
      if (candidateIds.length === 0) {
        return [];
      }

      // @ts-ignore
      const bookmarkedCandidates = yield db.pages
        .where(":id")
        .anyOf(candidateIds)
        .filter((item) => item.isBookmarked === true)
        .primaryKeys();
      const bookmarkedSet = new Set(bookmarkedCandidates);
      intArray = candidateIds.filter((id) => bookmarkedSet.has(id));
    }

    if (intArray.length > limit) {
      intArray = intArray.slice(0, limit);
    }

    // @ts-ignore
    return yield db.pages.bulkGet(intArray);
  });
}

async function getPageData(a) {
  // @ts-ignore
  const contentA = await db.contents.where("pid").equals(a.id).first();
  return { content: contentA?.content || "", ...a };
}

async function getEmbedding(a) {
  // @ts-ignore
  const existed = await db.vectors.where("pid").equals(a.id).first();
  if (existed && existed.id) {
    // @ts-ignore
    const emds = await db.vectors.where("pid").equals(a.id).sortBy("serial");
    const vecs = await Promise.all(
      emds.map((e) => {
        return blobToVector(e.vectorBlob);
      })
    );
    return emds.map((e, i) => {
      delete e.vectorBlob;
      return { vector: vecs[i], ...e };
    });
  }

  const content = await getPageData(a);
  const docs = await textSplitter(content);
  if (!docs || docs.length === 0) {
    return [];
  }

  const newVecs = await Promise.all(
    docs.map((d) => genEmbedding(d.pageContent))
  );

  // @ts-ignore
  await db.vectors.where("pid").equals(a.id).delete();
  await Promise.all(
    newVecs.map((e, i) => {
      const b = { pid: a.id, serial: i, vectorBlob: vectorToBlob(e) };
      // @ts-ignore
      return db.vectors.add(b);
    })
  );

  return newVecs.map((vector, serial) => ({
    vector,
    pid: a.id,
    serial,
  }));
}

function getSearchTerms(search: string): string[] {
  if (!search) {
    return [];
  }
  return wordSplit(search);
}

async function searchStringGPT(search: string): Promise<IGPTAnswer> {
  if (!search) {
    return { answer: "you ask for nothing", sources: null };
  }

  const splitSearch = getSearchTerms(search);
  if (splitSearch.length === 0) {
    return {
      answer: "no refrences found in your archieved webpages",
      sources: null,
    };
  }

  const wordResult = await findAndSort(splitSearch, "contentWords", true);
  if (!wordResult || wordResult.length === 0) {
    return {
      answer: "no refrences found in your archieved webpages",
      sources: null,
    };
  }

  const gptCandidates = wordResult.slice(0, 5);
  let vectorsArray = [];
  try {
    vectorsArray = await Promise.all(
      gptCandidates.map((item) => {
        return getEmbedding(item);
      })
    );
  } catch (error) {
    return { answer: error.message, sources: null };
  }

  const candidateVectors = vectorsArray.flat();
  if (candidateVectors.length === 0) {
    return {
      answer: "no refrences found in your archieved webpages",
      sources: null,
    };
  }

  let queryVector;
  try {
    queryVector = await genEmbedding(search);
  } catch (error) {
    return { answer: error.message, sources: null };
  }

  const candidateIndex = candidateVectors.map((item) => item.vector)
  const nearestIndex = findNearestArrays(
    candidateIndex,
    queryVector,
    1
  )[0];
  const near = candidateVectors[nearestIndex];
  if (!near) {
    return {
      answer: "no refrences found in your archieved webpages",
      sources: null,
    };
  }

  // @ts-ignore
  const nearPage = await db.pages.where("id").equals(near.pid).first();
  if (!nearPage) {
    return {
      answer: "no refrences found in your archieved webpages",
      sources: null,
    };
  }

  const nearContent = await getPageData(nearPage);
  const nearDocs = await textSplitter(nearContent);
  const nearestDoc = nearDocs[near.serial];
  if (!nearestDoc) {
    return {
      answer: "no refrences found in your archieved webpages",
      sources: null,
    };
  }

  let answerString;
  try {
    answerString = await chatWithRefs(search, [
      { content: nearestDoc.pageContent, source: nearestDoc.metadata.url },
    ]);
  } catch (error) {
    return { answer: error.message, sources: null };
  }

  return { answer: answerString, sources: [nearPage] };
}

async function searchString(search: string, type: string) {
  const splitSearch = getSearchTerms(search);
  if (splitSearch.length === 0) {
    return [];
  }

  const titleResult = await findAndSort(splitSearch, "titleWords");
  if (titleResult && titleResult.length > 0 && type === "short") {
    return titleResult;
  }

  const wordResult = await findAndSort(splitSearch, "contentWords");
  if (titleResult && titleResult.length > 0) {
    if (wordResult && wordResult.length > 0) {
      const dedupedResults = [];
      const seenIds = new Set();
      [...titleResult, ...wordResult].forEach((item) => {
        if (!item || seenIds.has(item.id)) {
          return;
        }
        seenIds.add(item.id);
        dedupedResults.push(item);
      });
      return dedupedResults;
    }
    return titleResult;
  }

  if (wordResult && wordResult.length > 0) {
    return wordResult;
  }

  return [];
}

// ============================================================================================

// ============================================================================================
function sendToRemote(data: PageData) {
  (async () => {
    const remoteStoreURL = userOps.remoteStoreURL?.trim();
    if (!remoteStoreURL) {
      return;
    }

    const postData = {
      url: data.url,
      title: data.title,
      date: data.date,
      isBookmarked: data.isBookmarked,
    };

    if (isWeibo(postData.url)) {
      const encode = getWeiboEncode(postData.url);
      postData.url = "https://m.weibo.cn/status/" + mid.decode(encode);
    }

    await fetch(remoteStoreURL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });
  })();
}

// ============================================================================================


// ============================================================================================
