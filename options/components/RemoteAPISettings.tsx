import { memo } from "react"
import Toggle from "react-toggle"
import { SettingBlock } from "../SettingBlock"
import { SettingItem } from "../SettingItem"
import { SettingItemCol } from "../SettingItemCol"

interface RemoteAPISettingsProps {
  remoteStore: boolean
  remoteStoreEveryPage: boolean
  remoteStoreURL: string
  tempRemoteStoreURL: string
  handleRemoteStoreURLChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleBlurRemoteStoreURL: () => void
  onToggleRemoteStore: () => void
  onToggleRemoteStoreEveryPage: () => void
}

/**
 * Remote API settings component
 */
export const RemoteAPISettings = memo(({
  remoteStore,
  remoteStoreEveryPage,
  remoteStoreURL,
  tempRemoteStoreURL,
  handleRemoteStoreURLChange,
  handleBlurRemoteStoreURL,
  onToggleRemoteStore,
  onToggleRemoteStoreEveryPage
}: RemoteAPISettingsProps) => {
  return (
    <SettingBlock title={chrome.i18n.getMessage("settingPageRemoteTitle")}>
      <SettingItem
        description={chrome.i18n.getMessage("settingPageRemoteSendDesp")}
        notes={chrome.i18n.getMessage("settingPageRemoteSendnote")}
      >
        <Toggle checked={remoteStore} onChange={onToggleRemoteStore} />
      </SettingItem>

      <SettingItem
        description={chrome.i18n.getMessage("settingPageRemoteSendEveryDesp")}
        notes={chrome.i18n.getMessage("settingPageRemoteSendEveryNote")}
      >
        <Toggle checked={remoteStoreEveryPage} onChange={onToggleRemoteStoreEveryPage} />
      </SettingItem>

      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageRemoteAPIDesp")}
        notes={chrome.i18n.getMessage("settingPageRemoteAPINote")}
      >
        <textarea
          className="w-96"
          onChange={handleRemoteStoreURLChange}
          onBlur={handleBlurRemoteStoreURL}
          value={tempRemoteStoreURL}
          rows={tempRemoteStoreURL.split("\n").length || 4}
        />
      </SettingItemCol>
    </SettingBlock>
  )
})
