import { memo, useMemo, useState } from "react"
import Toggle from "react-toggle"
import { v4 as uuidv4 } from "uuid"
import { resolveEndpointBinding } from "~lib/chat"
import type {
  ApiEndpoint,
  EndpointBindings,
  EndpointCapability,
  ModelDefaults,
} from "~store/stat-slice"
import { SettingBlock } from "../SettingBlock"
import { SettingItem } from "../SettingItem"
import { SettingItemCol } from "../SettingItemCol"

interface GPTSettingsProps {
  showAskGPT: boolean
  gptEndpoints: ApiEndpoint[]
  gptBindings: EndpointBindings
  gptDefaultModels: ModelDefaults
  gptPromptTemplate: string
  gptAvailableModelsByEndpoint: Record<string, string[]>
  handleAddGptEndpoint: (endpoint: ApiEndpoint) => void
  handleUpdateGptEndpoint: (endpoint: ApiEndpoint) => void
  handleRemoveGptEndpoint: (endpointId: string) => void
  handleToggleGptEndpointEnabled: (endpointId: string) => void
  handleSetGptBindings: (bindings: EndpointBindings) => void
  handleSetGptDefaultModels: (models: ModelDefaults) => void
  handleSetGptPromptTemplate: (template: string) => void
  handleSetAvailableModelsForEndpoint: (endpointId: string, models: string[]) => void
  onToggleShowAskGPT: () => void
}

const capabilityLabels: Record<EndpointCapability, string> = {
  chat: chrome.i18n.getMessage("settingPageSettingGPTCapabilityChat"),
  embedding: chrome.i18n.getMessage("settingPageSettingGPTCapabilityEmbedding"),
}

export const GPTSettings = memo(({
  showAskGPT,
  gptEndpoints,
  gptBindings,
  gptDefaultModels,
  gptPromptTemplate,
  gptAvailableModelsByEndpoint,
  handleAddGptEndpoint,
  handleUpdateGptEndpoint,
  handleRemoveGptEndpoint,
  handleToggleGptEndpointEnabled,
  handleSetGptBindings,
  handleSetGptDefaultModels,
  handleSetGptPromptTemplate,
  handleSetAvailableModelsForEndpoint,
  onToggleShowAskGPT,
}: GPTSettingsProps) => {
  const [endpointMessages, setEndpointMessages] = useState<Record<string, string>>({})
  const [bindingMessages, setBindingMessages] = useState<
    Partial<Record<EndpointCapability, string>>
  >({})
  const [bindingModels, setBindingModels] = useState<
    Record<EndpointCapability, string[]>
  >({
    chat: [],
    embedding: [],
  })
  const [endpointLoading, setEndpointLoading] = useState<Record<string, boolean>>({})
  const [bindingLoading, setBindingLoading] = useState<
    Partial<Record<EndpointCapability, boolean>>
  >({})

  const bindingResolutions = useMemo(
    () => ({
      chat: resolveEndpointBinding({
        capability: "chat",
        endpoints: gptEndpoints,
        bindings: gptBindings,
        defaultModels: gptDefaultModels,
      }),
      embedding: resolveEndpointBinding({
        capability: "embedding",
        endpoints: gptEndpoints,
        bindings: gptBindings,
        defaultModels: gptDefaultModels,
      }),
    }),
    [gptBindings, gptDefaultModels, gptEndpoints]
  )

  const availableBindingModels = useMemo(() => {
    const buildModels = (capability: EndpointCapability) => {
      if (bindingModels[capability].length > 0) {
        return bindingModels[capability]
      }

      const models = bindingResolutions[capability].availableEndpoints.flatMap(
        ({ endpoint }) => gptAvailableModelsByEndpoint[endpoint.id] || []
      )
      return Array.from(new Set(models))
    }

    return {
      chat: buildModels("chat"),
      embedding: buildModels("embedding"),
    }
  }, [bindingModels, bindingResolutions, gptAvailableModelsByEndpoint])

  const sortedEndpointIds = {
    chat: gptBindings.chat,
    embedding: gptBindings.embedding,
  }

  const createEndpoint = () => {
    handleAddGptEndpoint({
      id: uuidv4(),
      name: chrome.i18n.getMessage("settingPageSettingGPTPrimaryEndpointName", String(gptEndpoints.length + 1)),
      baseUrl: "",
      apiKey: "",
      enabled: true,
      capabilities: ["chat"],
      modelOverrides: {},
      notes: "",
    })
  }

  const updateEndpoint = (endpointId: string, patch: Partial<ApiEndpoint>) => {
    const endpoint = gptEndpoints.find((item) => item.id === endpointId)
    if (!endpoint) {
      return
    }

    handleUpdateGptEndpoint({
      ...endpoint,
      ...patch,
      modelOverrides: {
        ...endpoint.modelOverrides,
        ...patch.modelOverrides,
      },
    })
  }

  const toggleEndpointCapability = (
    endpoint: ApiEndpoint,
    capability: EndpointCapability
  ) => {
    const exists = endpoint.capabilities.includes(capability)
    const nextCapabilities = exists
      ? endpoint.capabilities.filter((item) => item !== capability)
      : [...endpoint.capabilities, capability]

    updateEndpoint(endpoint.id, { capabilities: nextCapabilities })

    if (exists && gptBindings[capability].includes(endpoint.id)) {
      handleSetGptBindings({
        ...gptBindings,
        [capability]: gptBindings[capability].filter((id) => id !== endpoint.id),
      })
    }
  }

  const toggleBinding = (capability: EndpointCapability, endpointId: string) => {
    const ids = gptBindings[capability]
    const nextIds = ids.includes(endpointId)
      ? ids.filter((id) => id !== endpointId)
      : [...ids, endpointId]

    handleSetGptBindings({
      ...gptBindings,
      [capability]: nextIds,
    })
  }

  const moveBinding = (
    capability: EndpointCapability,
    index: number,
    direction: -1 | 1
  ) => {
    const ids = [...gptBindings[capability]]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= ids.length) {
      return
    }

    const [endpointId] = ids.splice(index, 1)
    ids.splice(targetIndex, 0, endpointId)

    handleSetGptBindings({
      ...gptBindings,
      [capability]: ids,
    })
  }

  const removeEndpoint = (endpoint: ApiEndpoint) => {
    const impacts = (["chat", "embedding"] as EndpointCapability[])
      .filter((capability) => gptBindings[capability].includes(endpoint.id))
      .join(", ")

    const confirmed = window.confirm(
      impacts
        ? chrome.i18n.getMessage(
            "settingPageSettingGPTDeleteEndpointBoundConfirm",
            [endpoint.name, impacts]
          )
        : chrome.i18n.getMessage(
            "settingPageSettingGPTDeleteEndpointConfirm",
            endpoint.name
          )
    )

    if (!confirmed) {
      return
    }

    handleRemoveGptEndpoint(endpoint.id)
  }

  const handleFetchEndpointModels = async (endpoint: ApiEndpoint) => {
    setEndpointLoading((state) => ({ ...state, [endpoint.id]: true }))
    setEndpointMessages((state) => ({ ...state, [endpoint.id]: "" }))
    try {
      const response = await chrome.runtime.sendMessage({
        command: "gpt_fetch_endpoint_models",
        endpointId: endpoint.id,
        endpoint,
      })
      const models = Array.isArray(response?.models) ? response.models : []
      if (!response?.ok) {
        setEndpointMessages((state) => ({
          ...state,
          [endpoint.id]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${response?.error || "Request failed"}`,
        }))
        handleSetAvailableModelsForEndpoint(endpoint.id, [])
        return
      }

      handleSetAvailableModelsForEndpoint(endpoint.id, models)
      setEndpointMessages((state) => ({
        ...state,
        [endpoint.id]:
          models.length > 0
            ? `${chrome.i18n.getMessage("settingPageSettingGPTModelsFetchSuccess")} (${models.length})`
            : chrome.i18n.getMessage("settingPageSettingGPTModelsFetchEmpty"),
      }))
    } catch (error: any) {
      setEndpointMessages((state) => ({
        ...state,
        [endpoint.id]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${error.message}`,
      }))
    } finally {
      setEndpointLoading((state) => ({ ...state, [endpoint.id]: false }))
    }
  }

  const handleTestEndpoint = async (
    endpoint: ApiEndpoint,
    capability: EndpointCapability
  ) => {
    setEndpointLoading((state) => ({ ...state, [endpoint.id]: true }))
    setEndpointMessages((state) => ({ ...state, [endpoint.id]: "" }))
    try {
      const response = await chrome.runtime.sendMessage({
        command: "gpt_test_endpoint",
        endpointId: endpoint.id,
        endpoint,
        capability,
        defaultModels: gptDefaultModels,
        promptTemplate: gptPromptTemplate,
      })
      if (!response?.ok) {
        setEndpointMessages((state) => ({
          ...state,
          [endpoint.id]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${response?.error || "Request failed"}`,
        }))
        return
      }

      const model = response?.model ? ` (${response.model})` : ""
      setEndpointMessages((state) => ({
        ...state,
        [endpoint.id]: `${chrome.i18n.getMessage("settingPageSettingGPTSuccess")}${model}`,
      }))
    } catch (error: any) {
      setEndpointMessages((state) => ({
        ...state,
        [endpoint.id]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${error.message}`,
      }))
    } finally {
      setEndpointLoading((state) => ({ ...state, [endpoint.id]: false }))
    }
  }

  const handleFetchBindingModels = async (capability: EndpointCapability) => {
    setBindingLoading((state) => ({ ...state, [capability]: true }))
    setBindingMessages((state) => ({ ...state, [capability]: "" }))
    try {
      const response = await chrome.runtime.sendMessage({
        command: "gpt_fetch_binding_models",
        capability,
      })
      const models = Array.isArray(response?.models) ? response.models : []
      if (!response?.ok) {
        setBindingMessages((state) => ({
          ...state,
          [capability]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${response?.error || "Request failed"}`,
        }))
        setBindingModels((state) => ({ ...state, [capability]: [] }))
        return
      }

      setBindingModels((state) => ({ ...state, [capability]: models }))
      const failures = Array.isArray(response?.failures) ? response.failures : []
      const suffix = failures.length
        ? ` | ${chrome.i18n.getMessage("settingPageSettingGPTPartialFailures")}: ${failures
            .map((item) => `${item.endpointName} - ${item.reason}`)
            .join("; ")}`
        : ""
      setBindingMessages((state) => ({
        ...state,
        [capability]:
          models.length > 0
            ? `${chrome.i18n.getMessage("settingPageSettingGPTModelsFetchSuccess")} (${models.length})${suffix}`
            : `${chrome.i18n.getMessage("settingPageSettingGPTModelsFetchEmpty")}${suffix}`,
      }))
    } catch (error: any) {
      setBindingMessages((state) => ({
        ...state,
        [capability]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${error.message}`,
      }))
    } finally {
      setBindingLoading((state) => ({ ...state, [capability]: false }))
    }
  }

  const handleTestBinding = async (capability: EndpointCapability) => {
    setBindingLoading((state) => ({ ...state, [capability]: true }))
    setBindingMessages((state) => ({ ...state, [capability]: "" }))
    try {
      const response = await chrome.runtime.sendMessage({
        command: "gpt_test_binding",
        capability,
      })
      if (!response?.ok) {
        setBindingMessages((state) => ({
          ...state,
          [capability]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${response?.error || "Request failed"}`,
        }))
        return
      }

      setBindingMessages((state) => ({
        ...state,
        [capability]: `${chrome.i18n.getMessage("settingPageSettingGPTSuccess")}: ${response?.endpointName || "-"} (${response?.model || "-"})`,
      }))
    } catch (error: any) {
      setBindingMessages((state) => ({
        ...state,
        [capability]: `${chrome.i18n.getMessage("settingPageSettingGPTError")}: ${error.message}`,
      }))
    } finally {
      setBindingLoading((state) => ({ ...state, [capability]: false }))
    }
  }

  const renderModelField = (
    label: string,
    value: string,
    models: string[],
    onChange: (value: string) => void
  ) => {
    const dedupedModels = Array.from(new Set(models)).filter(Boolean)
    const hasModels = dedupedModels.length > 0

    return (
      <SettingItemCol description={label}>
        {hasModels ? (
          <select
            className="w-96 h-8"
            value={value}
            onChange={(e) => onChange(e.target.value)}>
            <option value="">{chrome.i18n.getMessage("settingPageSettingGPTSelectModel")}</option>
            {dedupedModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="w-96 h-6"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </SettingItemCol>
    )
  }

  const renderBindingSection = (capability: EndpointCapability) => {
    const resolution = bindingResolutions[capability]

    return (
      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingGPTBindingTitle", capabilityLabels[capability])}>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingGPTBindingOrderDesp", capabilityLabels[capability])}
          notes={chrome.i18n.getMessage("settingPageSettingGPTBindingOrderNote")}>
          <div className="flex flex-col gap-2">
            {sortedEndpointIds[capability].length === 0 ? (
              <div className="text-sm text-gray-500">
                {chrome.i18n.getMessage("settingPageSettingGPTNoBindings")}
              </div>
            ) : (
              sortedEndpointIds[capability].map((endpointId, index) => {
                const endpoint = gptEndpoints.find((item) => item.id === endpointId)
                return (
                  <div
                    className="border rounded p-3 flex flex-col gap-2"
                    key={`${capability}-${endpointId}`}>
                    <div className="font-medium">
                      {index + 1}. {endpoint?.name || endpointId}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="text-blue-500"
                        onClick={() => moveBinding(capability, index, -1)}>
                        {chrome.i18n.getMessage("settingPageSettingGPTMoveUpBtn")}
                      </button>
                      <button
                        className="text-blue-500"
                        onClick={() => moveBinding(capability, index, 1)}>
                        {chrome.i18n.getMessage("settingPageSettingGPTMoveDownBtn")}
                      </button>
                      <button
                        className="text-red-500"
                        onClick={() => toggleBinding(capability, endpointId)}>
                        {chrome.i18n.getMessage("settingPageSettingGPTRemoveBtn")}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </SettingItemCol>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingGPTBindingDiagnosticsDesp", capabilityLabels[capability])}
          notes={chrome.i18n.getMessage("settingPageSettingGPTBindingDiagnosticsNote")}>
          <div className="flex gap-4 flex-wrap">
            <button
              className="text-blue-500 text-lg"
              disabled={bindingLoading[capability]}
              onClick={() => handleFetchBindingModels(capability)}>
              {bindingLoading[capability]
                ? chrome.i18n.getMessage("settingPageSettingGPTModelsFetchLoading")
                : chrome.i18n.getMessage("settingPageSettingGPTModelsFetchBtn")}
            </button>
            <button
              className="text-blue-500 text-lg"
              disabled={bindingLoading[capability]}
              onClick={() => handleTestBinding(capability)}>
              {bindingLoading[capability]
                ? chrome.i18n.getMessage("settingPageSettingGPTTestLoading")
                : chrome.i18n.getMessage("settingPageSettingGPTTestBtn")}
            </button>
          </div>
          {bindingMessages[capability] ? (
            <div className="mt-2 whitespace-pre-wrap break-all">
              {bindingMessages[capability]}
            </div>
          ) : null}
          {resolution.configurationErrors.length > 0 ? (
            <ul className="mt-2 text-sm text-red-500 list-disc pl-6">
              {resolution.configurationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </SettingItemCol>
      </SettingBlock>
    )
  }

  return (
    <>
      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingGPT")}>
        <SettingItem
          description={chrome.i18n.getMessage("settingPageSettingGPTShowDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingGPTShowNote")}>
          <Toggle checked={showAskGPT} onChange={onToggleShowAskGPT} />
        </SettingItem>
      </SettingBlock>

      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingGPTDefaultModelsTitle")}>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingGPTCurrentModelDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingGPTCurrentModelHint")}>
          <div className="text-sm text-gray-500 whitespace-pre-line">
            {`${chrome.i18n.getMessage("settingPageSettingGPTCurrentChatModelNote")}: ${gptDefaultModels.chat || "-"}\n${chrome.i18n.getMessage("settingPageSettingGPTCurrentEmbeddingModelNote")}: ${gptDefaultModels.embedding || "-"}`}
          </div>
        </SettingItemCol>
        {renderModelField(
          chrome.i18n.getMessage("settingPageSettingGPTChatModelDesp"),
          gptDefaultModels.chat,
          availableBindingModels.chat,
          (value) => handleSetGptDefaultModels({ ...gptDefaultModels, chat: value })
        )}
        {renderModelField(
          chrome.i18n.getMessage("settingPageSettingGPTEmbeddingModelDesp"),
          gptDefaultModels.embedding,
          availableBindingModels.embedding,
          (value) =>
            handleSetGptDefaultModels({ ...gptDefaultModels, embedding: value })
        )}
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingGPTPromptTemplateDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingGPTPromptTemplateNote")}>
          <textarea
            className="w-96"
            value={gptPromptTemplate}
            onChange={(e) => handleSetGptPromptTemplate(e.target.value)}
            rows={Math.max(gptPromptTemplate.split("\n").length, 6)}
          />
        </SettingItemCol>
      </SettingBlock>

      <SettingBlock title={chrome.i18n.getMessage("settingPageSettingGPTEndpointsTitle")}>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageSettingGPTEndpointResourcesDesp")}
          notes={chrome.i18n.getMessage("settingPageSettingGPTEndpointResourcesNote")}>
          <button className="text-blue-500 text-lg" onClick={createEndpoint}>
            {chrome.i18n.getMessage("settingPageSettingGPTAddEndpointBtn")}
          </button>
        </SettingItemCol>
        <div className="flex flex-col gap-4">
          {gptEndpoints.length === 0 ? (
            <div className="text-sm text-gray-500">
              {chrome.i18n.getMessage("settingPageSettingGPTNoEndpoints")}
            </div>
          ) : (
            gptEndpoints.map((endpoint) => {
              const endpointModels = gptAvailableModelsByEndpoint[endpoint.id] || []
              return (
                <div className="border rounded p-4 flex flex-col gap-3" key={endpoint.id}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <input
                      type="text"
                      className="w-72 h-8"
                      value={endpoint.name}
                      onChange={(e) =>
                        updateEndpoint(endpoint.id, { name: e.target.value })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <span>{chrome.i18n.getMessage("settingPageSettingGPTEnabled")}</span>
                      <Toggle
                        checked={endpoint.enabled}
                        onChange={() => handleToggleGptEndpointEnabled(endpoint.id)}
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    className="w-full h-8"
                    value={endpoint.baseUrl}
                    placeholder={chrome.i18n.getMessage("settingPageSettingGPTUrlDesp")}
                    onChange={(e) =>
                      updateEndpoint(endpoint.id, { baseUrl: e.target.value })
                    }
                  />
                  <input
                    type="password"
                    className="w-full h-8"
                    value={endpoint.apiKey}
                    placeholder={chrome.i18n.getMessage("settingPageSettingGPTKeyDesp")}
                    onChange={(e) =>
                      updateEndpoint(endpoint.id, { apiKey: e.target.value })
                    }
                  />
                  <div className="flex gap-4 flex-wrap">
                    {(["chat", "embedding"] as EndpointCapability[]).map((capability) => (
                      <label className="flex items-center gap-2" key={`${endpoint.id}-${capability}`}>
                        <input
                          type="checkbox"
                          checked={endpoint.capabilities.includes(capability)}
                          onChange={() => toggleEndpointCapability(endpoint, capability)}
                        />
                        {capabilityLabels[capability]}
                      </label>
                    ))}
                  </div>
                  {renderModelField(
                    chrome.i18n.getMessage("settingPageSettingGPTChatOverride"),
                    endpoint.modelOverrides?.chat || "",
                    endpointModels,
                    (value) =>
                      updateEndpoint(endpoint.id, {
                        modelOverrides: {
                          ...endpoint.modelOverrides,
                          chat: value,
                        },
                      })
                  )}
                  {renderModelField(
                    chrome.i18n.getMessage("settingPageSettingGPTEmbeddingOverride"),
                    endpoint.modelOverrides?.embedding || "",
                    endpointModels,
                    (value) =>
                      updateEndpoint(endpoint.id, {
                        modelOverrides: {
                          ...endpoint.modelOverrides,
                          embedding: value,
                        },
                      })
                  )}
                  <textarea
                    className="w-full"
                    rows={3}
                    value={endpoint.notes || ""}
                    placeholder={chrome.i18n.getMessage("settingPageSettingGPTNotesPlaceholder")}
                    onChange={(e) =>
                      updateEndpoint(endpoint.id, { notes: e.target.value })
                    }
                  />
                  <div className="flex gap-4 flex-wrap">
                    <button
                      className="text-blue-500"
                      disabled={endpointLoading[endpoint.id]}
                      onClick={() => handleFetchEndpointModels(endpoint)}>
                      {endpointLoading[endpoint.id]
                        ? chrome.i18n.getMessage("settingPageSettingGPTModelsFetchLoading")
                        : chrome.i18n.getMessage("settingPageSettingGPTModelsFetchBtn")}
                    </button>
                    {endpoint.capabilities.includes("chat") ? (
                      <button
                        className="text-blue-500"
                        disabled={endpointLoading[endpoint.id]}
                        onClick={() => handleTestEndpoint(endpoint, "chat")}>
                        {chrome.i18n.getMessage("settingPageSettingGPTTestChatBtn")}
                      </button>
                    ) : null}
                    {endpoint.capabilities.includes("embedding") ? (
                      <button
                        className="text-blue-500"
                        disabled={endpointLoading[endpoint.id]}
                        onClick={() => handleTestEndpoint(endpoint, "embedding")}>
                        {chrome.i18n.getMessage("settingPageSettingGPTTestEmbeddingBtn")}
                      </button>
                    ) : null}
                    <button
                      className="text-blue-500"
                      onClick={() => toggleBinding("chat", endpoint.id)}>
                      {gptBindings.chat.includes(endpoint.id)
                        ? chrome.i18n.getMessage("settingPageSettingGPTUnbindChatBtn")
                        : chrome.i18n.getMessage("settingPageSettingGPTBindChatBtn")}
                    </button>
                    <button
                      className="text-blue-500"
                      onClick={() => toggleBinding("embedding", endpoint.id)}>
                      {gptBindings.embedding.includes(endpoint.id)
                        ? chrome.i18n.getMessage("settingPageSettingGPTUnbindEmbeddingBtn")
                        : chrome.i18n.getMessage("settingPageSettingGPTBindEmbeddingBtn")}
                    </button>
                    <button
                      className="text-red-500"
                      onClick={() => removeEndpoint(endpoint)}>
                      {chrome.i18n.getMessage("settingPageSettingGPTRemoveBtn")}
                    </button>
                  </div>
                  {endpointModels.length > 0 ? (
                    <div className="text-sm text-gray-500 break-all">
                      {chrome.i18n.getMessage("settingPageSettingGPTModelsLabel")}: {endpointModels.join(", ")}
                    </div>
                  ) : null}
                  {endpointMessages[endpoint.id] ? (
                    <div className="text-sm whitespace-pre-wrap break-all">
                      {endpointMessages[endpoint.id]}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </SettingBlock>

      {renderBindingSection("chat")}
      {renderBindingSection("embedding")}
    </>
  )
})
