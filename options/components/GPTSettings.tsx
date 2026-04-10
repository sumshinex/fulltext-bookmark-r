import { memo, useState } from "react"
import Toggle from "react-toggle"
import { buildChatCompletionUrl } from "~lib/chat"
import { SettingBlock } from "../SettingBlock"
import { SettingItem } from "../SettingItem"
import { SettingItemCol } from "../SettingItemCol"

interface GPTSettingsProps {
  showAskGPT: boolean
  GPTKey: string
  GPTUrl: string
  GPTChatModel: string
  GPTEmbeddingModel: string
  GPTPromptTemplate: string
  GPTAvailableModels: string[]
  tempGPTKey: string
  tempGPTUrl: string
  tempGPTChatModel: string
  tempGPTEmbeddingModel: string
  tempGPTPromptTemplate: string
  handleGPTKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleGPTUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleBlurGPTKey: () => void
  handleBlurGPTUrl: () => void
  handleGPTChatModelChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  handleBlurGPTChatModel: () => void
  handleGPTEmbeddingModelChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  handleBlurGPTEmbeddingModel: () => void
  handleGPTPromptTemplateChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleBlurGPTPromptTemplate: () => void
  handleGPTAvailableModelsChange: (models: string[]) => void
  onToggleShowAskGPT: () => void
}

export const GPTSettings = memo(({
  showAskGPT,
  GPTKey,
  GPTUrl,
  GPTChatModel,
  GPTEmbeddingModel,
  GPTPromptTemplate,
  GPTAvailableModels,
  tempGPTKey,
  tempGPTUrl,
  tempGPTChatModel,
  tempGPTEmbeddingModel,
  tempGPTPromptTemplate,
  handleGPTKeyChange,
  handleGPTUrlChange,
  handleBlurGPTKey,
  handleBlurGPTUrl,
  handleGPTChatModelChange,
  handleBlurGPTChatModel,
  handleGPTEmbeddingModelChange,
  handleBlurGPTEmbeddingModel,
  handleGPTPromptTemplateChange,
  handleBlurGPTPromptTemplate,
  handleGPTAvailableModelsChange,
  onToggleShowAskGPT
}: GPTSettingsProps) => {
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState("")
  const [modelsLoading, setModelsLoading] = useState(false)

  const handleTestGPT = async () => {
    if (!tempGPTUrl || !tempGPTKey || !tempGPTChatModel) {
      setTestResult(chrome.i18n.getMessage("settingPageSettingGPTMissingConfig"))
      return
    }

    setTestLoading(true)
    setTestResult("")
    try {
      const response = await fetch(buildChatCompletionUrl(tempGPTUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempGPTKey}`,
        },
        body: JSON.stringify({
          model: tempGPTChatModel,
          messages: [
            {
              role: "user",
              content: "Say hello",
            },
          ],
        }),
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        setTestResult(`Error: ${data?.error?.message || response.statusText || "Request failed"}`)
      } else {
        setTestResult(`Success: ${data?.choices?.[0]?.message?.content || "Connected successfully."}`)
      }
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`)
    } finally {
      setTestLoading(false)
    }
  }

  const handleFetchModels = async () => {
    if (!tempGPTUrl || !tempGPTKey) {
      setTestResult(chrome.i18n.getMessage("settingPageSettingGPTMissingConfig"))
      return
    }

    setModelsLoading(true)
    setTestResult("")
    try {
      const response = await chrome.runtime.sendMessage({
        command: "gpt_models",
        key: tempGPTKey,
        url: tempGPTUrl,
      })
      const models = Array.isArray(response?.models) ? response.models : []

      if (!response?.ok) {
        setTestResult(`Error: ${response?.error || "Request failed"}`)
        handleGPTAvailableModelsChange([])
      } else {
        handleGPTAvailableModelsChange(models)
        setTestResult(
          models.length > 0
            ? `${chrome.i18n.getMessage("settingPageSettingGPTModelsFetchSuccess")} (${models.length})`
            : chrome.i18n.getMessage("settingPageSettingGPTModelsFetchEmpty")
        )
      }
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`)
    } finally {
      setModelsLoading(false)
    }
  }

  const renderModelField = (
    label: string,
    value: string,
    tempValue: string,
    models: string[],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void,
    onBlur: () => void
  ) => {
    const hasModels = models.length > 0
    return (
      <SettingItemCol description={label}>
        {hasModels ? (
          <select className="w-96 h-8" value={tempValue} onChange={onChange} onBlur={onBlur}>
            <option value="">Select a model</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="w-96 h-6"
            value={tempValue}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={value}
          />
        )}
      </SettingItemCol>
    )
  }

  return (
    <SettingBlock title={chrome.i18n.getMessage("settingPageSettingGPT")}>
      <SettingItem
        description={chrome.i18n.getMessage("settingPageSettingGPTShowDesp")}
        notes={chrome.i18n.getMessage("settingPageSettingGPTShowNote")}
      >
        <Toggle checked={showAskGPT} onChange={onToggleShowAskGPT} />
      </SettingItem>
      <p></p>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageSettingGPTUrlDesp")}
        notes={chrome.i18n.getMessage("settingPageSettingGPTUrlNote")}
      >
        <input
          type="text"
          className="w-96 h-6"
          value={tempGPTUrl}
          onChange={handleGPTUrlChange}
          onBlur={handleBlurGPTUrl}
        />
      </SettingItemCol>
      <p></p>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageSettingGPTKeyDesp")}
        notes={chrome.i18n.getMessage("settingPageSettingGPTKeyNote")}
      >
        <input
          type="password"
          className="w-96 h-6"
          value={tempGPTKey}
          onChange={handleGPTKeyChange}
          onBlur={handleBlurGPTKey}
        />
      </SettingItemCol>
      <p></p>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageSettingGPTModelsFetchDesp")}
        notes={chrome.i18n.getMessage("settingPageSettingGPTModelsFetchNote")}
      >
        <button className="text-blue-500 text-lg" onClick={handleFetchModels} disabled={modelsLoading}>
          {modelsLoading
            ? chrome.i18n.getMessage("settingPageSettingGPTModelsFetchLoading")
            : chrome.i18n.getMessage("settingPageSettingGPTModelsFetchBtn")}
        </button>
      </SettingItemCol>
      <p></p>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageSettingGPTCurrentModelDesp")}
        notes={`${chrome.i18n.getMessage("settingPageSettingGPTCurrentChatModelNote")}: ${GPTChatModel || "-"}\n${chrome.i18n.getMessage("settingPageSettingGPTCurrentEmbeddingModelNote")}: ${GPTEmbeddingModel || "-"}`}
      >
        <div className="text-sm text-gray-500 whitespace-pre-line">
          {chrome.i18n.getMessage("settingPageSettingGPTCurrentModelHint")}
        </div>
      </SettingItemCol>
      <p></p>
      {renderModelField(
        chrome.i18n.getMessage("settingPageSettingGPTChatModelDesp"),
        GPTChatModel,
        tempGPTChatModel,
        GPTAvailableModels,
        handleGPTChatModelChange,
        handleBlurGPTChatModel
      )}
      <p></p>
      {renderModelField(
        chrome.i18n.getMessage("settingPageSettingGPTEmbeddingModelDesp"),
        GPTEmbeddingModel,
        tempGPTEmbeddingModel,
        GPTAvailableModels,
        handleGPTEmbeddingModelChange,
        handleBlurGPTEmbeddingModel
      )}
      <p></p>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageSettingGPTPromptTemplateDesp")}
        notes={chrome.i18n.getMessage("settingPageSettingGPTPromptTemplateNote")}
      >
        <textarea
          className="w-96"
          value={tempGPTPromptTemplate}
          onChange={handleGPTPromptTemplateChange}
          onBlur={handleBlurGPTPromptTemplate}
          rows={Math.max(tempGPTPromptTemplate.split("\n").length, 6)}
        />
      </SettingItemCol>
      <p></p>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageSettingGPTTestDesp")}
        notes={chrome.i18n.getMessage("settingPageSettingGPTTestNote")}
      >
        <button
          className="text-blue-500 text-lg"
          onClick={handleTestGPT}
          disabled={testLoading}
        >
          {testLoading
            ? chrome.i18n.getMessage("settingPageSettingGPTTestLoading")
            : chrome.i18n.getMessage("settingPageSettingGPTTestBtn")}
        </button>
        {testResult && <div className="mt-2 whitespace-pre-wrap break-all">{testResult}</div>}
      </SettingItemCol>
    </SettingBlock>
  )
})
