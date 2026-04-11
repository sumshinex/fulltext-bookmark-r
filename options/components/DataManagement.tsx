import { useRef, useState } from "react"
import { SettingBlock } from "../SettingBlock"
import { SettingItemCol } from "../SettingItemCol"
import { handleExportExcel, handleFileUpload } from "../utils/csvUtils"
import { WebDAVBackupSettings } from "./WebDAVBackupSettings"
import type { WebdavStatus } from "~store/stat-slice"

interface DataManagementProps {
  setStoreSize: (size: { quota: string; usage: string }) => void
  webdavConfig: {
    baseUrl: string
    username: string
    password: string
    fileName: string
    autoBackupEnabled: boolean
    autoBackupMode: "daily_time" | "interval"
    autoBackupTime: string
    autoBackupIntervalHours: number
    retentionCount: number
  }
  webdavStatus: WebdavStatus
  tempWebdavBaseUrl: string
  tempWebdavUsername: string
  tempWebdavPassword: string
  tempWebdavFileName: string
  tempWebdavAutoBackupEnabled: boolean
  tempWebdavAutoBackupMode: "daily_time" | "interval"
  tempWebdavAutoBackupTime: string
  tempWebdavAutoBackupIntervalHours: number
  tempWebdavRetentionCount: number
  handleWebdavBaseUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavFileNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavAutoBackupEnabledChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavAutoBackupModeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  handleWebdavAutoBackupTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavAutoBackupIntervalHoursChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleWebdavRetentionCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleBlurWebdavConfig: () => void
  handleSetWebdavStatus: (status: Partial<WebdavStatus>) => void
}

export const DataManagement = ({
  setStoreSize,
  webdavConfig,
  webdavStatus,
  tempWebdavBaseUrl,
  tempWebdavUsername,
  tempWebdavPassword,
  tempWebdavFileName,
  tempWebdavAutoBackupEnabled,
  tempWebdavAutoBackupMode,
  tempWebdavAutoBackupTime,
  tempWebdavAutoBackupIntervalHours,
  tempWebdavRetentionCount,
  handleWebdavBaseUrlChange,
  handleWebdavUsernameChange,
  handleWebdavPasswordChange,
  handleWebdavFileNameChange,
  handleWebdavAutoBackupEnabledChange,
  handleWebdavAutoBackupModeChange,
  handleWebdavAutoBackupTimeChange,
  handleWebdavAutoBackupIntervalHoursChange,
  handleWebdavRetentionCountChange,
  handleBlurWebdavConfig,
  handleSetWebdavStatus,
}: DataManagementProps) => {
  const csvFileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleImportCSV = () => {
    csvFileInputRef.current?.click()
  }

  return (
    <>
      <SettingBlock title={chrome.i18n.getMessage("settingPageDataManagementTitle")}>
        <SettingItemCol
          description={chrome.i18n.getMessage("settingPageDataManagementDesc")}
          notes={chrome.i18n.getMessage("settingPageDataManagementNote")}
        >
          <div className="flex gap-4 items-center">
            <button
              className="text-blue-500 text-lg"
              onClick={handleImportCSV}
              disabled={isImporting}
            >
              {chrome.i18n.getMessage("settingPageSettingIndexSizeImportBtn")}
            </button>
            <button
              className="text-blue-500 text-lg"
              onClick={handleExportExcel}
              disabled={isImporting}
            >
              {chrome.i18n.getMessage("settingPageSettingIndexSizeExportBtn")}
            </button>
            {isImporting && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
                <span>Importing...</span>
              </div>
            )}
          </div>
          <input
            type="file"
            accept=".csv"
            ref={csvFileInputRef}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setIsImporting(true)
                handleFileUpload(e.target.files[0], () => {
                  setIsImporting(false)
                  setStoreSize({ quota: "", usage: "" })
                })
              }
            }}
          />
        </SettingItemCol>
      </SettingBlock>
      <WebDAVBackupSettings
        webdavConfig={webdavConfig}
        webdavStatus={webdavStatus}
        tempWebdavBaseUrl={tempWebdavBaseUrl}
        tempWebdavUsername={tempWebdavUsername}
        tempWebdavPassword={tempWebdavPassword}
        tempWebdavFileName={tempWebdavFileName}
        tempWebdavAutoBackupEnabled={tempWebdavAutoBackupEnabled}
        tempWebdavAutoBackupMode={tempWebdavAutoBackupMode}
        tempWebdavAutoBackupTime={tempWebdavAutoBackupTime}
        tempWebdavAutoBackupIntervalHours={tempWebdavAutoBackupIntervalHours}
        tempWebdavRetentionCount={tempWebdavRetentionCount}
        handleWebdavBaseUrlChange={handleWebdavBaseUrlChange}
        handleWebdavUsernameChange={handleWebdavUsernameChange}
        handleWebdavPasswordChange={handleWebdavPasswordChange}
        handleWebdavFileNameChange={handleWebdavFileNameChange}
        handleWebdavAutoBackupEnabledChange={handleWebdavAutoBackupEnabledChange}
        handleWebdavAutoBackupModeChange={handleWebdavAutoBackupModeChange}
        handleWebdavAutoBackupTimeChange={handleWebdavAutoBackupTimeChange}
        handleWebdavAutoBackupIntervalHoursChange={handleWebdavAutoBackupIntervalHoursChange}
        handleWebdavRetentionCountChange={handleWebdavRetentionCountChange}
        handleBlurWebdavConfig={handleBlurWebdavConfig}
        handleSetWebdavStatus={handleSetWebdavStatus}
      />
    </>
  )
}
