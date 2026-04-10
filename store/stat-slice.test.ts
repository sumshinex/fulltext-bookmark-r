import { describe, expect, it } from "vitest"
import reducer, {
  addGptEndpoint,
  removeGptEndpoint,
  setAvailableModelsForEndpoint,
  setGptBindings,
  setGptDefaultModels,
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
})
