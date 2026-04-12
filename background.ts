


export {};
import Dexie from "dexie";

import "dexie-export-import";
import {
  chat,
  chatWithRefs,
  executeWithEndpointFallback,
  fetchAvailableModels,
  genEmbedding,
  initApi,
  resolveEndpointBinding,
  resolveModelForEndpoint,
} from "~lib/chat";
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
  buildSettingsBackupPayload,
  clearAvailableModelsForAllEndpoints,
  normalizeSettingsBackupData,
  replaceGptEndpoints,
  setCustomSearchEngines,
  setForbiddenURLs,
  setGPTAnswer,
  setGPTLoading,
  setGPTQuery,
  setGptBindings,
  setGptDefaultModels,
  setGptPromptTemplate,
  setMaxResults,
  setRemoteStoreURL,
  setTempPageExpireTime,
  setWebdavConfig,
  setWebdavStatus,
  toggleBookmarkAdaption,
  toggleRemoteStore,
  toggleRemoteStoreEveryPage,
  toggleSearchEngineAdaption,
  toggleShowAskGPT,
  toggleShowOnlyBookmarkedResults,
  toggleStoreEveryPage,
  toggleWeiboSupport,
  type AppStat,
  type EndpointCapability,
  type SettingsBackupPayload,
  type WebdavConfig,
  type WebdavStatus,
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

async function waitForPersistorBootstrap() {
  if (persistor.getState().bootstrapped) {
    return
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = persistor.subscribe(() => {
      if (!persistor.getState().bootstrapped) {
        return
      }

      unsubscribe()
      resolve()
    })
  })
}



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

interface WebdavBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  source: string;
  data: unknown;
  stats: {
    pages: number;
    contents: number;
    vectors: number;
  };
}

const WEBDAV_AUTO_BACKUP_ALARM = "webdav-auto-backup";

function getDefaultWebdavConfig(): WebdavConfig {
  return {
    baseUrl: "",
    username: "",
    password: "",
    fileName: "fulltext-bookmark-backup.json",
    autoBackupEnabled: false,
    autoBackupMode: "daily_time",
    autoBackupTime: "03:00",
    autoBackupIntervalHours: 24,
    retentionCount: 10,
  };
}

function getStoredWebdavConfig(config: Partial<WebdavConfig>): WebdavConfig {
  const defaults = getDefaultWebdavConfig();

  return {
    ...defaults,
    ...config,
    baseUrl: (config?.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, ""),
    username: (config?.username || defaults.username).trim(),
    password: config?.password || defaults.password,
    fileName: (config?.fileName || defaults.fileName).trim() || defaults.fileName,
    autoBackupEnabled: Boolean(config?.autoBackupEnabled),
    autoBackupMode: config?.autoBackupMode === "interval" ? "interval" : "daily_time",
    autoBackupTime: (config?.autoBackupTime || defaults.autoBackupTime).trim() || defaults.autoBackupTime,
    autoBackupIntervalHours: Math.max(1, config?.autoBackupIntervalHours || defaults.autoBackupIntervalHours),
    retentionCount: Math.max(1, config?.retentionCount || defaults.retentionCount),
  };
}

function getWebdavFileNameParts(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return {
      prefix: fileName,
      suffix: "",
    };
  }

  return {
    prefix: fileName.slice(0, dotIndex),
    suffix: fileName.slice(dotIndex),
  };
}

function padTimestampPart(value: number) {
  return value.toString().padStart(2, "0");
}

function formatBackupTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${padTimestampPart(date.getMonth() + 1)}-${padTimestampPart(date.getDate())}_${padTimestampPart(date.getHours())}-${padTimestampPart(date.getMinutes())}-${padTimestampPart(date.getSeconds())}`;
}

function buildVersionedWebdavFileName(fileName: string, timestamp: number) {
  const { prefix, suffix } = getWebdavFileNameParts(fileName);
  return `${prefix}-${formatBackupTimestamp(timestamp)}${suffix}`;
}

function isVersionedWebdavFileName(candidate: string, baseFileName: string) {
  const { prefix, suffix } = getWebdavFileNameParts(baseFileName);
  if (
    candidate === baseFileName ||
    !candidate.startsWith(`${prefix}-`) ||
    !candidate.endsWith(suffix)
  ) {
    return false;
  }

  const middle = candidate.slice(prefix.length + 1, suffix ? -suffix.length : undefined);
  return /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(middle);
}

function parseDailyTime(timeText: string) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((timeText || "").trim());
  if (!match) {
    return { hours: 3, minutes: 0 };
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function calculateNextWebdavBackupAt(config: WebdavConfig, baseTimestamp = Date.now()) {
  if (!config.autoBackupEnabled) {
    return null;
  }

  if (config.autoBackupMode === "interval") {
    return baseTimestamp + Math.max(1, config.autoBackupIntervalHours || 24) * 60 * 60 * 1000;
  }

  const { hours, minutes } = parseDailyTime(config.autoBackupTime);
  const next = new Date(baseTimestamp);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);

  if (next.getTime() <= baseTimestamp) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

function normalizeSearchEnginePageContext(context: Partial<SearchEnginePageContext>): SearchEnginePageContext {
  const toStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        ).slice(0, 10)
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

async function runWithCapabilityEndpoint<T>(
  capability: EndpointCapability,
  executor: (config: {
    endpointId: string;
    endpointName: string;
    apiKey: string;
    baseUrl: string;
    chatModel: string;
    embeddingModel: string;
    promptTemplate: string;
  }) => Promise<T>,
  overrides?: {
    endpoints?: AppStat["gptEndpoints"];
    bindings?: AppStat["gptBindings"];
    defaultModels?: AppStat["gptDefaultModels"];
    promptTemplate?: AppStat["gptPromptTemplate"];
  }
) {
  const state = store.getState() as AppStat
  const endpoints = overrides?.endpoints || state.gptEndpoints
  const bindings = overrides?.bindings || state.gptBindings
  const defaultModels = overrides?.defaultModels || state.gptDefaultModels
  const promptTemplate = overrides?.promptTemplate || state.gptPromptTemplate

  return executeWithEndpointFallback(
    {
      capability,
      endpoints,
      bindings,
      defaultModels,
    },
    async ({ endpoint, model }) => {
      const config = {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        apiKey: endpoint.apiKey,
        baseUrl: endpoint.baseUrl,
        chatModel:
          capability === "chat"
            ? model
            : resolveModelForEndpoint(endpoint, "chat", defaultModels),
        embeddingModel:
          capability === "embedding"
            ? model
            : resolveModelForEndpoint(endpoint, "embedding", defaultModels),
        promptTemplate,
      }

      initApi(config.apiKey, config.baseUrl, {
        chatModel: config.chatModel,
        embeddingModel: config.embeddingModel,
        promptTemplate: config.promptTemplate,
      })

      return executor(config)
    }
  )
}

async function fetchModelsFromCapabilityBinding(
  capability: EndpointCapability,
  overrides?: {
    endpoints?: AppStat["gptEndpoints"];
    bindings?: AppStat["gptBindings"];
    defaultModels?: AppStat["gptDefaultModels"];
  }
) {
  const state = store.getState() as AppStat
  const resolution = resolveEndpointBinding({
    capability,
    endpoints: overrides?.endpoints || state.gptEndpoints,
    bindings: overrides?.bindings || state.gptBindings,
    defaultModels: overrides?.defaultModels || state.gptDefaultModels,
  })

  if (resolution.availableEndpoints.length === 0) {
    throw new Error(
      resolution.configurationErrors[0] ||
        chrome.i18n.getMessage("gptBindingUnavailable", capability)
    )
  }

  const mergedModels = new Set<string>()
  const failures: { endpointName: string; reason: string }[] = []

  for (const { endpoint } of resolution.availableEndpoints) {
    try {
      const models = await fetchAvailableModels(endpoint.apiKey, endpoint.baseUrl)
      models.forEach((model) => mergedModels.add(model))
    } catch (error) {
      failures.push({
        endpointName: endpoint.name,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    models: Array.from(mergedModels),
    failures,
    configurationErrors: resolution.configurationErrors,
  }
}

function getWebdavMessage(key: string) {
  const message = chrome.i18n.getMessage(key)
  return message || key
}

function normalizeWebdavBaseUrl(baseUrl: string) {
  const trimmed = (baseUrl || "").trim()
  if (!trimmed) {
    throw new Error(getWebdavMessage("settingPageWebDAVInvalidUrl"))
  }
  return trimmed.replace(/\/+$/, "")
}

function normalizeWebdavConfig(config: Partial<WebdavConfig>): WebdavConfig {
  const storedConfig = getStoredWebdavConfig(config)
  const { baseUrl, username, password, fileName } = storedConfig

  if (!username) {
    throw new Error(getWebdavMessage("settingPageWebDAVUsernameRequired"))
  }
  if (!password) {
    throw new Error(getWebdavMessage("settingPageWebDAVPasswordRequired"))
  }
  if (!fileName) {
    throw new Error(getWebdavMessage("settingPageWebDAVFileNameRequired"))
  }

  try {
    new URL(baseUrl)
  } catch {
    throw new Error(getWebdavMessage("settingPageWebDAVInvalidUrl"))
  }

  return storedConfig
}

function buildWebdavTargetUrl(config: WebdavConfig, fileName = config.fileName) {
  return `${config.baseUrl}/${encodeURIComponent(fileName)}`
}

function getWebdavDirectoryUrl(config: WebdavConfig) {
  return `${config.baseUrl}/`
}

function createWebdavHeaders(config: WebdavConfig, contentType?: string) {
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
  }

  if (contentType) {
    headers["Content-Type"] = contentType
  }

  return headers
}

function normalizeWebdavError(error: unknown) {
  if (error instanceof TypeError) {
    return `WebDAV network request failed: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return getWebdavMessage("settingPageWebDAVOperationFailed")
}

async function saveWebdavConfig(config: WebdavConfig) {
  const nextBackupAt = calculateNextWebdavBackupAt(config)
  store.dispatch(setWebdavConfig(config))
  store.dispatch(
    setWebdavStatus({
      lastOperationStatus: "idle",
      nextBackupAt,
    })
  )
  await persistor.flush()
  await scheduleWebdavAutoBackup(config)
}

async function updateWebdavStatus(status: Partial<WebdavStatus>) {
  store.dispatch(setWebdavStatus(status))
  await persistor.flush()
}

async function scheduleWebdavAutoBackup(configInput?: Partial<WebdavConfig>) {
  const config = getStoredWebdavConfig(configInput || (store.getState() as AppStat).webdavConfig)

  await chrome.alarms.clear(WEBDAV_AUTO_BACKUP_ALARM)

  if (!config.autoBackupEnabled || !config.baseUrl || !config.username || !config.password) {
    await updateWebdavStatus({ nextBackupAt: null })
    return
  }

  const when = calculateNextWebdavBackupAt(config)
  if (!when) {
    await updateWebdavStatus({ nextBackupAt: null })
    return
  }

  chrome.alarms.create(WEBDAV_AUTO_BACKUP_ALARM, { when })
  await updateWebdavStatus({ nextBackupAt: when })
}

async function readBlobAsJson(blob: Blob) {
  return await new Promise<any>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function () {
      try {
        // @ts-ignore
        resolve(JSON.parse(this.result))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob, "utf-8")
  })
}

async function readExportedDatabaseJson() {
  const blob = await db.export()
  return readBlobAsJson(blob)
}

function parseSettingsBackupPayload(payload: unknown): SettingsBackupPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("设置备份文件结构无效")
  }

  const candidate = payload as Partial<SettingsBackupPayload>
  if (!candidate.data || typeof candidate.data !== "object") {
    throw new Error("设置备份文件缺少 data 字段")
  }

  return {
    schemaVersion:
      typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 1,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    source: typeof candidate.source === "string" ? candidate.source : "unknown",
    data: normalizeSettingsBackupData(candidate.data),
  }
}

async function buildWebdavBackupPayload(): Promise<WebdavBackupPayload> {
  const exportedData = await readExportedDatabaseJson()
  // @ts-ignore
  const tables = Array.isArray(exportedData?.data?.data) ? exportedData.data.data : []
  const findCount = (tableName: string) => {
    const table = tables.find((item) => item?.tableName === tableName)
    return Array.isArray(table?.rows) ? table.rows.length : 0
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: "fulltext-bookmark-main",
    data: exportedData,
    stats: {
      pages: findCount("pages"),
      contents: findCount("contents"),
      vectors: findCount("vectors"),
    },
  }
}

async function listWebdavBackupFiles(config: WebdavConfig) {
  const response = await fetch(getWebdavDirectoryUrl(config), {
    method: "PROPFIND",
    headers: {
      ...createWebdavHeaders(config),
      Depth: "1",
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(getWebdavMessage("settingPageWebDAVAuthFailed"))
  }

  if (!response.ok) {
    throw new Error(`WebDAV list failed (${response.status})`)
  }

  const text = await response.text()
  const hrefMatches = Array.from(text.matchAll(/<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href>/gi))

  return hrefMatches
    .map((match) => {
      const href = (match[1] || "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .trim()
      if (!href) {
        return null
      }

      try {
        const decoded = decodeURIComponent(href)
        const url = new URL(decoded, getWebdavDirectoryUrl(config))
        const fileName = url.pathname.split("/").filter(Boolean).pop() || ""
        if (!fileName || !isVersionedWebdavFileName(fileName, config.fileName)) {
          return null
        }

        return {
          fileName,
          url: buildWebdavTargetUrl(config, fileName),
        }
      } catch {
        return null
      }
    })
    .filter((item): item is { fileName: string; url: string } => Boolean(item))
    .sort((left, right) => right.fileName.localeCompare(left.fileName))
}

async function fetchWebdavBackupPayload(config: WebdavConfig, backupFileName?: string) {
  const targetUrl = buildWebdavTargetUrl(config, backupFileName || config.fileName)
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: createWebdavHeaders(config),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(getWebdavMessage("settingPageWebDAVAuthFailed"))
  }

  if (response.status === 404) {
    throw new Error(getWebdavMessage("settingPageWebDAVFileMissing"))
  }

  if (!response.ok) {
    throw new Error(`WebDAV restore failed (${response.status})`)
  }

  const payload = (await response.json()) as WebdavBackupPayload
  if (!payload || typeof payload !== "object" || !payload.data || !payload.schemaVersion) {
    throw new Error("备份文件结构无效")
  }

  return payload
}

async function getWebdavBackupHistory(configInput: Partial<WebdavConfig>) {
  const config = normalizeWebdavConfig(configInput)
  await saveWebdavConfig(config)
  const files = await listWebdavBackupFiles(config)

  return {
    ok: true,
    files: files.map((file) => file.fileName),
  }
}

async function deleteWebdavBackupVersion(
  configInput: Partial<WebdavConfig>,
  backupFileName?: string
) {
  const config = normalizeWebdavConfig(configInput)
  await saveWebdavConfig(config)

  if (!backupFileName || !isVersionedWebdavFileName(backupFileName, config.fileName)) {
    throw new Error(getWebdavMessage("settingPageWebDAVDeleteInvalidTarget"))
  }

  const response = await fetch(buildWebdavTargetUrl(config, backupFileName), {
    method: "DELETE",
    headers: createWebdavHeaders(config),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(getWebdavMessage("settingPageWebDAVAuthFailed"))
  }

  if (!response.ok && response.status !== 404) {
    throw new Error(`WebDAV delete failed (${response.status})`)
  }

  return {
    ok: true,
    message: getWebdavMessage("settingPageWebDAVDeleteSuccess"),
  }
}

async function pruneWebdavBackups(config: WebdavConfig) {
  const files = await listWebdavBackupFiles(config)
  const redundantFiles = files
    .sort((left, right) => right.fileName.localeCompare(left.fileName))
    .slice(Math.max(1, config.retentionCount || 10))

  await Promise.all(
    redundantFiles.map(async (file) => {
      const response = await fetch(file.url, {
        method: "DELETE",
        headers: createWebdavHeaders(config),
      })

      if (!response.ok && response.status !== 404) {
        throw new Error(`WebDAV cleanup failed (${response.status})`)
      }
    })
  )
}

async function testWebdavConnection(configInput: Partial<WebdavConfig>) {
  const config = normalizeWebdavConfig(configInput)
  const targetUrl = buildWebdavTargetUrl(config)
  await saveWebdavConfig(config)

  const response = await fetch(targetUrl, {
    method: "HEAD",
    headers: createWebdavHeaders(config),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(getWebdavMessage("settingPageWebDAVAuthFailed"))
  }

  if (!response.ok && response.status !== 404) {
    throw new Error(`WebDAV connection failed (${response.status})`)
  }

  const message =
    response.status === 404
      ? getWebdavMessage("settingPageWebDAVConnectionTargetMissing")
      : getWebdavMessage("settingPageWebDAVConnectionSuccess")

  store.dispatch(
    setWebdavStatus({
      lastOperationStatus: "success",
      lastOperationMessage: message,
    })
  )

  return {
    ok: true,
    message,
  }
}

async function exportBackupToWebdav(configInput: Partial<WebdavConfig>) {
  const config = normalizeWebdavConfig(configInput)
  const backedUpAt = Date.now()
  const versionedFileName = buildVersionedWebdavFileName(config.fileName, backedUpAt)
  const targetUrl = buildWebdavTargetUrl(config, versionedFileName)
  const latestTargetUrl = buildWebdavTargetUrl(config)
  const payload = await buildWebdavBackupPayload()
  await saveWebdavConfig(config)

  const requestBody = JSON.stringify(payload, null, 2)
  const uploadTargets = [targetUrl, latestTargetUrl]

  for (const url of uploadTargets) {
    const response = await fetch(url, {
      method: "PUT",
      headers: createWebdavHeaders(config, "application/json"),
      body: requestBody,
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error(getWebdavMessage("settingPageWebDAVAuthFailed"))
    }

    if (!response.ok) {
      throw new Error(`WebDAV backup failed (${response.status})`)
    }
  }

  await pruneWebdavBackups(config)

  const nextBackupAt = calculateNextWebdavBackupAt(config, backedUpAt)
  const message = getWebdavMessage("settingPageWebDAVBackupSuccess")
  await updateWebdavStatus({
    lastBackupAt: backedUpAt,
    lastBackupFileName: versionedFileName,
    nextBackupAt,
    lastOperationStatus: "success",
    lastOperationMessage: message,
  })

  if (config.autoBackupEnabled) {
    chrome.alarms.create(WEBDAV_AUTO_BACKUP_ALARM, { when: nextBackupAt || undefined })
  }

  return {
    ok: true,
    backedUpAt,
    backupFileName: versionedFileName,
    nextBackupAt,
    message,
    stats: payload.stats,
  }
}

async function applySettingsBackupData(payload: SettingsBackupPayload) {
  const nextSettings = normalizeSettingsBackupData(payload.data)
  const currentState = store.getState() as AppStat

  if (currentState.searchEngineAdaption !== nextSettings.searchEngineAdaption) {
    store.dispatch(toggleSearchEngineAdaption())
  }
  if (currentState.storeEveryPage !== nextSettings.storeEveryPage) {
    store.dispatch(toggleStoreEveryPage())
  }
  if (currentState.bookmarkAdaption !== nextSettings.bookmarkAdaption) {
    store.dispatch(toggleBookmarkAdaption())
  }
  if (currentState.remoteStore !== nextSettings.remoteStore) {
    store.dispatch(toggleRemoteStore())
  }
  if (currentState.showOnlyBookmarkedResults !== nextSettings.showOnlyBookmarkedResults) {
    store.dispatch(toggleShowOnlyBookmarkedResults())
  }
  if (currentState.remoteStoreEveryPage !== nextSettings.remoteStoreEveryPage) {
    store.dispatch(toggleRemoteStoreEveryPage())
  }
  if (currentState.weiboSupport !== nextSettings.weiboSupport) {
    store.dispatch(toggleWeiboSupport())
  }
  if (currentState.showAskGPT !== nextSettings.showAskGPT) {
    store.dispatch(toggleShowAskGPT())
  }

  store.dispatch(setRemoteStoreURL(nextSettings.remoteStoreURL))
  store.dispatch(setTempPageExpireTime(nextSettings.tempPageExpireTime))
  store.dispatch(setMaxResults(nextSettings.maxResults))
  store.dispatch(setForbiddenURLs(nextSettings.forbiddenURLs))
  store.dispatch(setCustomSearchEngines(nextSettings.customSearchEngines))
  store.dispatch(replaceGptEndpoints(nextSettings.gptEndpoints))
  store.dispatch(setGptBindings(nextSettings.gptBindings))
  store.dispatch(setGptDefaultModels(nextSettings.gptDefaultModels))
  store.dispatch(setGptPromptTemplate(nextSettings.gptPromptTemplate))
  store.dispatch(setWebdavConfig(nextSettings.webdavConfig))
  store.dispatch(clearAvailableModelsForAllEndpoints())

  userOps = store.getState()

  await updateWebdavStatus({
    lastOperationStatus: "idle",
    lastOperationMessage: "",
  })

  userOps = store.getState()

  await persistor.flush()
  await scheduleWebdavAutoBackup(nextSettings.webdavConfig)

  return nextSettings
}

async function restoreBackupFromWebdav(
  configInput: Partial<WebdavConfig>,
  backupFileName?: string
) {
  const config = normalizeWebdavConfig(configInput)
  await saveWebdavConfig(config)
  const payload = await fetchWebdavBackupPayload(config, backupFileName)

  const importBlob = new Blob([JSON.stringify(payload.data)], {
    type: "application/json",
  })

  await db.import(importBlob, {
    clearTablesBeforeImport: true,
    overwriteValues: true,
    acceptVersionDiff: true,
  })

  const message = getWebdavMessage("settingPageWebDAVRestoreSuccess")
  await updateWebdavStatus({
    nextBackupAt: calculateNextWebdavBackupAt(config),
    lastOperationStatus: "success",
    lastOperationMessage: message,
  })

  return {
    ok: true,
    message,
  }
}

async function generateEmbeddingWithBinding(
  message: string,
  overrides?: {
    endpoints?: AppStat["gptEndpoints"];
    bindings?: AppStat["gptBindings"];
    defaultModels?: AppStat["gptDefaultModels"];
    promptTemplate?: AppStat["gptPromptTemplate"];
  }
) {
  return runWithCapabilityEndpoint(
    "embedding",
    async () => genEmbedding(message),
    overrides
  )
}

async function generateChatWithRefs(
  message: string,
  sources,
  overrides?: {
    endpoints?: AppStat["gptEndpoints"];
    bindings?: AppStat["gptBindings"];
    defaultModels?: AppStat["gptDefaultModels"];
    promptTemplate?: AppStat["gptPromptTemplate"];
  }
) {
  return runWithCapabilityEndpoint(
    "chat",
    async () => chatWithRefs(message, sources),
    overrides
  )
}

async function generateSearchEngineRule(
  context: SearchEnginePageContext,
  overrides?: {
    endpoints?: AppStat["gptEndpoints"];
    bindings?: AppStat["gptBindings"];
    defaultModels?: AppStat["gptDefaultModels"];
    promptTemplate?: AppStat["gptPromptTemplate"];
  }
) {
  const pageContext = normalizeSearchEnginePageContext(context);
  if (!pageContext.url) {
    throw new Error(chrome.i18n.getMessage("gptMissingPageContext"));
  }

  const response = await runWithCapabilityEndpoint(
    "chat",
    async () => {
      return chat(buildSearchEngineRulePrompt(pageContext));
    },
    overrides
  );
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

chrome.runtime.onInstalled.addListener(() => {
  getBookmarksOnInstalled()
  void (async () => {
    await waitForPersistorBootstrap()
    await scheduleWebdavAutoBackup()
  })()
})

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await waitForPersistorBootstrap()
    await scheduleWebdavAutoBackup()
  })()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== WEBDAV_AUTO_BACKUP_ALARM) {
    return
  }

  void (async () => {
    try {
      await exportBackupToWebdav((store.getState() as AppStat).webdavConfig)
    } catch (error) {
      const config = getStoredWebdavConfig((store.getState() as AppStat).webdavConfig)
      await updateWebdavStatus({
        nextBackupAt: calculateNextWebdavBackupAt(config),
        lastOperationStatus: "error",
        lastOperationMessage: normalizeWebdavError(error),
      })
      await scheduleWebdavAutoBackup(config)
    }
  })()
})

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
    case "gpt_search":
      (async () => {
        try {
          store.dispatch(setGPTLoading(true));
          store.dispatch(setGPTAnswer(null));
          store.dispatch(setGPTQuery(message.search));
          const result = await searchStringGPT(message.search, {
            endpoints: message.endpoints,
            bindings: message.bindings,
            defaultModels: message.defaultModels,
            promptTemplate: message.promptTemplate,
          });
          store.dispatch(setGPTAnswer(result));
          sendResponse(result);
        } catch (error) {
          const answer = error instanceof Error ? error.message : String(error);
          const errorResult = { answer, sources: null };
          store.dispatch(setGPTAnswer(errorResult));
          sendResponse(errorResult);
        } finally {
          store.dispatch(setGPTLoading(false));
        }
      })();
      return true;
    case "gpt_models":
    case "gpt_fetch_binding_models":
      (async () => {
        try {
          const capability = message.capability === "embedding" ? "embedding" : "chat";
          const result = await fetchModelsFromCapabilityBinding(capability, {
            endpoints: message.endpoints,
            bindings: message.bindings,
            defaultModels: message.defaultModels,
          });
          sendResponse({ ok: true, ...result });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : chrome.i18n.getMessage("gptBackgroundFetchModelsFailed"),
            models: [],
            failures: [],
            configurationErrors: [],
          });
        }
      })();
      return true;
    case "gpt_fetch_endpoint_models":
      (async () => {
        try {
          if (!message.endpointId) {
            throw new Error(chrome.i18n.getMessage("gptMissingEndpointId"));
          }
          const state = store.getState() as AppStat;
          const endpoint =
            state.gptEndpoints.find((item) => item.id === message.endpointId) ||
            message.endpoint;
          if (!endpoint || endpoint.id !== message.endpointId) {
            throw new Error(`Endpoint \"${message.endpointId}\" does not exist`);
          }
          if (!endpoint.baseUrl?.trim()) {
            throw new Error(`Endpoint \"${endpoint.name}\" is missing base URL`);
          }
          if (!endpoint.apiKey?.trim()) {
            throw new Error(`Endpoint \"${endpoint.name}\" is missing API key`);
          }
          const models = await fetchAvailableModels(endpoint.apiKey, endpoint.baseUrl);
          sendResponse({ ok: true, models, endpointId: endpoint.id });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : chrome.i18n.getMessage("gptBackgroundFetchModelsFailed"),
            models: [],
          });
        }
      })();
      return true;
    case "gpt_test_endpoint":
      (async () => {
        try {
          if (!message.endpointId) {
            throw new Error(chrome.i18n.getMessage("gptMissingEndpointId"));
          }
          const capability = message.capability === "embedding" ? "embedding" : "chat";
          const state = store.getState() as AppStat;
          const endpoint =
            state.gptEndpoints.find((item) => item.id === message.endpointId) ||
            message.endpoint;
          if (!endpoint || endpoint.id !== message.endpointId) {
            throw new Error(`Endpoint \"${message.endpointId}\" does not exist`);
          }
          if (!endpoint.capabilities.includes(capability)) {
            throw new Error(`Endpoint \"${endpoint.name}\" does not support ${capability}`);
          }
          if (!endpoint.baseUrl?.trim()) {
            throw new Error(`Endpoint \"${endpoint.name}\" is missing base URL`);
          }
          if (!endpoint.apiKey?.trim()) {
            throw new Error(`Endpoint \"${endpoint.name}\" is missing API key`);
          }

          const defaultModels = message.defaultModels || state.gptDefaultModels;
          const promptTemplate = message.promptTemplate || state.gptPromptTemplate;
          const chatModel = resolveModelForEndpoint(endpoint, "chat", defaultModels);
          const embeddingModel = resolveModelForEndpoint(endpoint, "embedding", defaultModels);

          initApi(endpoint.apiKey, endpoint.baseUrl, {
            chatModel,
            embeddingModel,
            promptTemplate,
          });

          if (capability === "chat") {
            const result = await chat("Say hello");
            sendResponse({ ok: true, endpointId: endpoint.id, model: chatModel, result });
            return;
          }

          await genEmbedding("hello");
          sendResponse({ ok: true, endpointId: endpoint.id, model: embeddingModel });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : chrome.i18n.getMessage("gptBackgroundTestEndpointFailed"),
          });
        }
      })();
      return true;
    case "gpt_test_binding":
      (async () => {
        try {
          const capability = message.capability === "embedding" ? "embedding" : "chat";
          const result = await runWithCapabilityEndpoint(capability, async (config) => {
            if (capability === "chat") {
              const reply = await chat("Say hello");
              return {
                ok: true,
                endpointId: config.endpointId,
                endpointName: config.endpointName,
                model: config.chatModel,
                result: reply,
              };
            }

            await genEmbedding("hello");
            return {
              ok: true,
              endpointId: config.endpointId,
              endpointName: config.endpointName,
              model: config.embeddingModel,
            };
          }, {
            endpoints: message.endpoints,
            bindings: message.bindings,
            defaultModels: message.defaultModels,
            promptTemplate: message.promptTemplate,
          });
          sendResponse(result);
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : chrome.i18n.getMessage("gptBackgroundTestBindingFailed"),
          });
        }
      })();
      return true;
    case "generate_search_engine_rule":
      (async () => {
        try {
          const rule = await generateSearchEngineRule(message.context, {
            endpoints: message.endpoints,
            bindings: message.bindings,
            defaultModels: message.defaultModels,
            promptTemplate: message.promptTemplate,
          });
          sendResponse({ ok: true, rule });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : chrome.i18n.getMessage("gptBackgroundGenerateRuleFailed"),
          });
        }
      })();
      return true;
    case "webdav_test_connection":
      (async () => {
        try {
          const result = await testWebdavConnection(message.config || {})
          sendResponse(result)
        } catch (error) {
          sendResponse({ ok: false, error: normalizeWebdavError(error) })
        }
      })();
      return true;
    case "webdav_backup_export":
      (async () => {
        try {
          const result = await exportBackupToWebdav(message.config || {})
          sendResponse(result)
        } catch (error) {
          sendResponse({ ok: false, error: normalizeWebdavError(error) })
        }
      })();
      return true;
    case "webdav_backup_history":
      (async () => {
        try {
          const result = await getWebdavBackupHistory(message.config || {})
          sendResponse(result)
        } catch (error) {
          sendResponse({ ok: false, error: normalizeWebdavError(error) })
        }
      })();
      return true;
    case "webdav_backup_restore":
      (async () => {
        try {
          const result = await restoreBackupFromWebdav(
            message.config || {},
            message.backupFileName
          )
          sendResponse(result)
        } catch (error) {
          sendResponse({ ok: false, error: normalizeWebdavError(error) })
        }
      })();
      return true;
    case "webdav_backup_delete":
      (async () => {
        try {
          const result = await deleteWebdavBackupVersion(
            message.config || {},
            message.backupFileName
          )
          sendResponse(result)
        } catch (error) {
          sendResponse({ ok: false, error: normalizeWebdavError(error) })
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
    case "export_settings":
      (async () => {
        try {
          const payload = buildSettingsBackupPayload(store.getState() as AppStat)
          sendResponse({ ok: true, payload })
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "settings export failed",
          })
        }
      })();
      return true;
    case "import_settings":
      (async () => {
        try {
          const payload = parseSettingsBackupPayload(message.payload)
          await applySettingsBackupData(payload)
          sendResponse({ ok: true })
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "settings import failed",
          })
        }
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
    docs.map((d) => generateEmbeddingWithBinding(d.pageContent))
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

async function searchStringGPT(
  search: string,
  overrides?: {
    endpoints?: AppStat["gptEndpoints"];
    bindings?: AppStat["gptBindings"];
    defaultModels?: AppStat["gptDefaultModels"];
    promptTemplate?: AppStat["gptPromptTemplate"];
  }
): Promise<IGPTAnswer> {
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
    queryVector = await generateEmbeddingWithBinding(search, overrides);
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
    answerString = await generateChatWithRefs(
      search,
      [{ content: nearestDoc.pageContent, source: nearestDoc.metadata.url }],
      overrides
    );
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

  const titleResult = await findAndSort(splitSearch, "titleWords", false);
  if (titleResult && titleResult.length > 0 && type === "short") {
    return titleResult;
  }

  const wordResult = await findAndSort(splitSearch, "contentWords", false);
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
