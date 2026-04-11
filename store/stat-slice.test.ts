import { describe, expect, it } from "vitest"
import reducer, {
  addGptEndpoint,
  buildSettingsBackupData,
  getDefaultSettingsBackupData,
  normalizeSettingsBackupData,
  removeGptEndpoint,
  setAvailableModelsForEndpoint,
  setGptBindings,
  setGptDefaultModels,
  setWebdavConfig,
  setWebdavStatus,
  toggleGptEndpointEnabled,
  updateGptEndpoint,
  type ApiEndpoint,
} from "./stat-slice"

describe("stat slice GPT orchestration state", () => {
  it("initializes endpoint orchestration defaults", () => {
    const state = reducer(undefined, { type: "init" })

    expect(state.gptEndpoints).toEqual([])
    expect(state.gptBindings).toEqual({ chat: [], embedding: [] })
    expect(state.gptDefaultModels).toEqual({
      chat: "gpt-3.5-turbo",
      embedding: "text-embedding-3-small",
    })
    expect(state.gptAvailableModelsByEndpoint).toEqual({})
    expect(state.webdavConfig).toEqual({
      baseUrl: "",
      username: "",
      password: "",
      fileName: "fulltext-bookmark-backup.json",
      autoBackupEnabled: false,
      autoBackupMode: "daily_time",
      autoBackupTime: "03:00",
      autoBackupIntervalHours: 24,
      retentionCount: 10,
    })
    expect(state.webdavStatus).toEqual({
      lastBackupAt: null,
      lastBackupFileName: "",
      nextBackupAt: null,
      lastOperationStatus: "idle",
      lastOperationMessage: "",
    })
  })

  it("adds updates and toggles endpoints", () => {
    const endpoint: ApiEndpoint = {
      id: "ep-1",
      name: "Primary",
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      enabled: true,
      capabilities: ["chat", "embedding"],
    }

    const added = reducer(undefined, addGptEndpoint(endpoint))
    const updated = reducer(
      added,
      updateGptEndpoint({
        ...endpoint,
        name: "Primary Updated",
        modelOverrides: { chat: "gpt-4o-mini" },
      })
    )
    const toggled = reducer(updated, toggleGptEndpointEnabled("ep-1"))

    expect(added.gptEndpoints).toHaveLength(1)
    expect(updated.gptEndpoints[0].name).toBe("Primary Updated")
    expect(updated.gptEndpoints[0].modelOverrides).toEqual({ chat: "gpt-4o-mini" })
    expect(toggled.gptEndpoints[0].enabled).toBe(false)
  })

  it("removes deleted endpoints from bindings and cached models", () => {
    const endpoint: ApiEndpoint = {
      id: "ep-1",
      name: "Primary",
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      enabled: true,
      capabilities: ["chat"],
    }

    let state = reducer(undefined, addGptEndpoint(endpoint))
    state = reducer(state, setGptBindings({ chat: ["ep-1"], embedding: ["ep-1"] }))
    state = reducer(
      state,
      setAvailableModelsForEndpoint({ endpointId: "ep-1", models: ["gpt-4o-mini"] })
    )

    const nextState = reducer(state, removeGptEndpoint("ep-1"))

    expect(nextState.gptEndpoints).toEqual([])
    expect(nextState.gptBindings).toEqual({ chat: [], embedding: [] })
    expect(nextState.gptAvailableModelsByEndpoint).toEqual({})
  })

  it("updates default models independently", () => {
    const state = reducer(
      undefined,
      setGptDefaultModels({ chat: "gpt-4.1-mini", embedding: "text-embedding-3-large" })
    )

    expect(state.gptDefaultModels).toEqual({
      chat: "gpt-4.1-mini",
      embedding: "text-embedding-3-large",
    })
  })

  it("keeps prompt template updates separate from endpoint state", () => {
    const endpoint: ApiEndpoint = {
      id: "ep-1",
      name: "Primary",
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      enabled: true,
      capabilities: ["chat"],
    }

    let state = reducer(undefined, addGptEndpoint(endpoint))
    state = reducer(state, setGptBindings({ chat: ["ep-1"], embedding: [] }))
    state = reducer(state, { type: "stat/setGptPromptTemplate", payload: "custom prompt" })

    expect(state.gptPromptTemplate).toBe("custom prompt")
    expect(state.gptEndpoints).toHaveLength(1)
    expect(state.gptBindings.chat).toEqual(["ep-1"])
  })

  it("updates webdav config and status independently", () => {
    let state = reducer(
      undefined,
      setWebdavConfig({
        baseUrl: "https://dav.example.com/backup",
        username: "alice",
        autoBackupEnabled: true,
        autoBackupMode: "interval",
        autoBackupIntervalHours: 12,
        retentionCount: 5,
      })
    )

    state = reducer(
      state,
      setWebdavStatus({
        lastBackupAt: 1712800000000,
        lastBackupFileName: "fulltext-bookmark-backup-2026-04-11_03-00-00.json",
        nextBackupAt: 1712843200000,
        lastOperationStatus: "success",
        lastOperationMessage: "Backup completed",
      })
    )

    expect(state.webdavConfig).toEqual({
      baseUrl: "https://dav.example.com/backup",
      username: "alice",
      password: "",
      fileName: "fulltext-bookmark-backup.json",
      autoBackupEnabled: true,
      autoBackupMode: "interval",
      autoBackupTime: "03:00",
      autoBackupIntervalHours: 12,
      retentionCount: 5,
    })
    expect(state.webdavStatus).toEqual({
      lastBackupAt: 1712800000000,
      lastBackupFileName: "fulltext-bookmark-backup-2026-04-11_03-00-00.json",
      nextBackupAt: 1712843200000,
      lastOperationStatus: "success",
      lastOperationMessage: "Backup completed",
    })
    expect(state.gptEndpoints).toEqual([])
  })

  it("builds settings-only backup data without runtime fields", () => {
    const endpoint: ApiEndpoint = {
      id: "ep-1",
      name: "Primary",
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      enabled: true,
      capabilities: ["chat", "embedding"],
    }

    let state = reducer(undefined, addGptEndpoint(endpoint))
    state = reducer(state, setGptBindings({ chat: ["ep-1"], embedding: ["ep-1"] }))
    state = reducer(
      state,
      setAvailableModelsForEndpoint({ endpointId: "ep-1", models: ["gpt-4o-mini"] })
    )

    const backup = buildSettingsBackupData(state)

    expect(backup.gptEndpoints).toEqual([endpoint])
    expect(backup.gptBindings).toEqual({ chat: ["ep-1"], embedding: ["ep-1"] })
    expect("gptAvailableModelsByEndpoint" in backup).toBe(false)
    expect("GPTQuery" in backup).toBe(false)
    expect("webdavStatus" in backup).toBe(false)
  })

  it("normalizes imported settings backups and drops invalid bindings", () => {
    const defaults = getDefaultSettingsBackupData()
    const normalized = normalizeSettingsBackupData({
      remoteStoreURL: " https://remote.example.com/api ",
      maxResults: 0,
      forbiddenURLs: ["https://keep.example.com/*", "", 123 as never],
      gptEndpoints: [
        {
          id: "ep-1",
          name: "  Endpoint 1  ",
          baseUrl: " https://api.example.com/v1 ",
          apiKey: "key-1",
          enabled: true,
          capabilities: ["chat", "invalid" as never],
          modelOverrides: {
            chat: " gpt-4.1-mini ",
            embedding: "   ",
          },
        },
        {
          id: "ep-2",
          name: "",
          baseUrl: "",
          apiKey: "",
          enabled: true,
          capabilities: [],
        },
      ],
      gptBindings: {
        chat: ["ep-1", "missing"],
        embedding: ["missing"],
      },
      webdavConfig: {
        baseUrl: " https://dav.example.com/backup/ ",
        username: " alice ",
        autoBackupIntervalHours: 0,
        retentionCount: 0,
      },
    })

    expect(normalized.remoteStoreURL).toBe("https://remote.example.com/api")
    expect(normalized.maxResults).toBe(defaults.maxResults)
    expect(normalized.forbiddenURLs).toEqual(["https://keep.example.com/*"])
    expect(normalized.gptEndpoints).toEqual([
      {
        id: "ep-1",
        name: "Endpoint 1",
        baseUrl: "https://api.example.com/v1",
        apiKey: "key-1",
        enabled: true,
        capabilities: ["chat"],
        modelOverrides: { chat: "gpt-4.1-mini" },
      },
    ])
    expect(normalized.gptBindings).toEqual({ chat: ["ep-1"], embedding: [] })
    expect(normalized.webdavConfig).toEqual({
      ...defaults.webdavConfig,
      baseUrl: "https://dav.example.com/backup/",
      username: "alice",
      autoBackupIntervalHours: defaults.webdavConfig.autoBackupIntervalHours,
      retentionCount: defaults.webdavConfig.retentionCount,
    })
  })
})
