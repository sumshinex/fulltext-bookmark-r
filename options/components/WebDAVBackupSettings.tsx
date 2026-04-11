import { useEffect, useMemo, useState } from "react"
import { SettingBlock } from "../SettingBlock"
import { SettingItemCol } from "../SettingItemCol"
import type { WebdavStatus } from "~store/stat-slice"

interface WebDAVBackupSettingsProps {
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

export const WebDAVBackupSettings = ({
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
}: WebDAVBackupSettingsProps) => {
  const [actionLoading, setActionLoading] = useState<"test" | "backup" | "restore" | "history" | null>(null)
  const [backupHistory, setBackupHistory] = useState<string[]>([])
  const [selectedBackupFileName, setSelectedBackupFileName] = useState("")

  const isConfigComplete = useMemo(() => {
    return Boolean(
      tempWebdavBaseUrl.trim() &&
        tempWebdavUsername.trim() &&
        tempWebdavPassword &&
        tempWebdavFileName.trim()
    )
  }, [tempWebdavBaseUrl, tempWebdavUsername, tempWebdavPassword, tempWebdavFileName])

  const getRunningLabel = (state: "test" | "backup" | "restore" | "history" | null) => {
    if (state === "test") {
      return chrome.i18n.getMessage("settingPageWebDAVTestingConnection")
    }
    if (state === "backup") {
      return chrome.i18n.getMessage("settingPageWebDAVBackingUp")
    }
    if (state === "restore") {
      return chrome.i18n.getMessage("settingPageWebDAVRestoring")
    }
    if (state === "history") {
      return chrome.i18n.getMessage("settingPageWebDAVLoadingHistory")
    }
    return chrome.i18n.getMessage("settingPageWebDAVOperationRunning")
  }

  const buildRuntimeConfig = () => ({
    ...webdavConfig,
    baseUrl: tempWebdavBaseUrl.trim(),
    username: tempWebdavUsername.trim(),
    password: tempWebdavPassword,
    fileName: tempWebdavFileName.trim() || "fulltext-bookmark-backup.json",
    autoBackupEnabled: tempWebdavAutoBackupEnabled,
    autoBackupMode: tempWebdavAutoBackupMode,
    autoBackupTime: tempWebdavAutoBackupTime || "03:00",
    autoBackupIntervalHours: Math.max(1, tempWebdavAutoBackupIntervalHours || 24),
    retentionCount: Math.max(1, tempWebdavRetentionCount || 10),
  })

  const loadBackupHistory = async () => {
    if (!isConfigComplete) {
      setBackupHistory([])
      setSelectedBackupFileName("")
      return
    }

    setActionLoading("history")
    try {
      const response = await chrome.runtime.sendMessage({
        command: "webdav_backup_history",
        config: buildRuntimeConfig(),
      })
      if (!response?.ok) {
        throw new Error(response?.error || chrome.i18n.getMessage("settingPageWebDAVOperationFailed"))
      }

      const files = Array.isArray(response.files) ? response.files : []
      setBackupHistory(files)
      setSelectedBackupFileName((current) => {
        if (current && files.includes(current)) {
          return current
        }
        return files[0] || ""
      })
    } catch (error) {
      handleSetWebdavStatus({
        lastOperationStatus: "error",
        lastOperationMessage:
          error instanceof Error
            ? error.message
            : chrome.i18n.getMessage("settingPageWebDAVOperationFailed"),
      })
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    void loadBackupHistory()
  }, [tempWebdavBaseUrl, tempWebdavUsername, tempWebdavPassword, tempWebdavFileName])

  const runAction = async (command: "webdav_test_connection" | "webdav_backup_export" | "webdav_backup_restore") => {
    handleBlurWebdavConfig()

    if (command === "webdav_backup_restore") {
      const confirmed = window.confirm(
        chrome.i18n.getMessage("settingPageWebDAVRestoreConfirm")
      )
      if (!confirmed) {
        return
      }
    }

    const loadingState =
      command === "webdav_test_connection"
        ? "test"
        : command === "webdav_backup_export"
          ? "backup"
          : "restore"

    setActionLoading(loadingState)
    handleSetWebdavStatus({
      lastOperationStatus: "idle",
      lastOperationMessage: getRunningLabel(loadingState),
    })

    try {
      const response = await chrome.runtime.sendMessage({
        command,
        config: buildRuntimeConfig(),
        backupFileName:
          command === "webdav_backup_restore" && selectedBackupFileName
            ? selectedBackupFileName
            : undefined,
      })

      if (!response?.ok) {
        throw new Error(response?.error || chrome.i18n.getMessage("settingPageWebDAVOperationFailed"))
      }

      handleSetWebdavStatus({
        lastBackupAt:
          command === "webdav_backup_export"
            ? response.backedUpAt || Date.now()
            : webdavStatus.lastBackupAt,
        lastOperationStatus: "success",
        lastOperationMessage:
          response.message || chrome.i18n.getMessage("settingPageWebDAVOperationSuccess"),
      })

      if (command === "webdav_backup_export") {
        void loadBackupHistory()
      }

      if (command === "webdav_backup_restore") {
        window.alert(chrome.i18n.getMessage("settingPageWebDAVRestoreSuccessHint"))
      }
    } catch (error) {
      handleSetWebdavStatus({
        lastOperationStatus: "error",
        lastOperationMessage:
          error instanceof Error
            ? error.message
            : chrome.i18n.getMessage("settingPageWebDAVOperationFailed"),
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <SettingBlock title={chrome.i18n.getMessage("settingPageWebDAVTitle")}>
      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageWebDAVBaseUrl")}
        notes={chrome.i18n.getMessage("settingPageWebDAVBaseUrlNote")}
      >
        <input
          className="w-full rounded border px-3 py-2"
          value={tempWebdavBaseUrl}
          onChange={handleWebdavBaseUrlChange}
          onBlur={handleBlurWebdavConfig}
          placeholder="https://dav.example.com/remote.php/dav/files/user/backups"
        />
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVUsername")}>
        <input
          className="w-full rounded border px-3 py-2"
          value={tempWebdavUsername}
          onChange={handleWebdavUsernameChange}
          onBlur={handleBlurWebdavConfig}
        />
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVPassword")}>
        <input
          type="password"
          className="w-full rounded border px-3 py-2"
          value={tempWebdavPassword}
          onChange={handleWebdavPasswordChange}
          onBlur={handleBlurWebdavConfig}
        />
      </SettingItemCol>

      <SettingItemCol
        description={chrome.i18n.getMessage("settingPageWebDAVFileName")}
        notes={chrome.i18n.getMessage("settingPageWebDAVFileNameNote")}
      >
        <input
          className="w-full rounded border px-3 py-2"
          value={tempWebdavFileName}
          onChange={handleWebdavFileNameChange}
          onBlur={handleBlurWebdavConfig}
        />
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVAutoBackupEnabled")}>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={tempWebdavAutoBackupEnabled}
            onChange={handleWebdavAutoBackupEnabledChange}
            onBlur={handleBlurWebdavConfig}
          />
          <span>{chrome.i18n.getMessage("settingPageWebDAVAutoBackupEnabledNote")}</span>
        </label>
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVAutoBackupMode")}>
        <select
          className="w-full rounded border px-3 py-2"
          value={tempWebdavAutoBackupMode}
          onChange={handleWebdavAutoBackupModeChange}
          onBlur={handleBlurWebdavConfig}
          disabled={!tempWebdavAutoBackupEnabled}
        >
          <option value="daily_time">
            {chrome.i18n.getMessage("settingPageWebDAVAutoBackupModeDailyTime")}
          </option>
          <option value="interval">
            {chrome.i18n.getMessage("settingPageWebDAVAutoBackupModeInterval")}
          </option>
        </select>
      </SettingItemCol>

      {tempWebdavAutoBackupMode === "daily_time" ? (
        <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVAutoBackupTime")}>
          <input
            type="time"
            className="w-full rounded border px-3 py-2"
            value={tempWebdavAutoBackupTime}
            onChange={handleWebdavAutoBackupTimeChange}
            onBlur={handleBlurWebdavConfig}
            disabled={!tempWebdavAutoBackupEnabled}
          />
        </SettingItemCol>
      ) : (
        <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVAutoBackupIntervalHours")}>
          <input
            type="number"
            min={1}
            className="w-full rounded border px-3 py-2"
            value={tempWebdavAutoBackupIntervalHours}
            onChange={handleWebdavAutoBackupIntervalHoursChange}
            onBlur={handleBlurWebdavConfig}
            disabled={!tempWebdavAutoBackupEnabled}
          />
        </SettingItemCol>
      )}

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVRetentionCount")}>
        <input
          type="number"
          min={1}
          className="w-full rounded border px-3 py-2"
          value={tempWebdavRetentionCount}
          onChange={handleWebdavRetentionCountChange}
          onBlur={handleBlurWebdavConfig}
          disabled={!tempWebdavAutoBackupEnabled}
        />
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVLastBackupAt")}>
        <span className="text-sm text-gray-600">
          {webdavStatus.lastBackupAt
            ? new Date(webdavStatus.lastBackupAt).toLocaleString()
            : chrome.i18n.getMessage("settingPageWebDAVNeverBackedUp")}
        </span>
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVLastBackupFileName")}>
        <span className="text-sm text-gray-600">
          {webdavStatus.lastBackupFileName || chrome.i18n.getMessage("settingPageWebDAVNoBackupFileYet")}
        </span>
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVNextBackupAt")}>
        <span className="text-sm text-gray-600">
          {webdavStatus.nextBackupAt
            ? new Date(webdavStatus.nextBackupAt).toLocaleString()
            : chrome.i18n.getMessage("settingPageWebDAVAutoBackupDisabled")}
        </span>
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVBackupHistory")}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              className="w-full rounded border px-3 py-2"
              value={selectedBackupFileName}
              onChange={(e) => setSelectedBackupFileName(e.target.value)}
              disabled={!isConfigComplete || actionLoading !== null || backupHistory.length === 0}
            >
              {backupHistory.length === 0 ? (
                <option value="">{chrome.i18n.getMessage("settingPageWebDAVNoBackupHistory")}</option>
              ) : (
                backupHistory.map((fileName) => (
                  <option key={fileName} value={fileName}>
                    {fileName}
                  </option>
                ))
              )}
            </select>
            <button
              className="text-blue-500 text-sm disabled:text-gray-400"
              disabled={!isConfigComplete || actionLoading !== null}
              onClick={() => void loadBackupHistory()}
            >
              {actionLoading === "history"
                ? chrome.i18n.getMessage("settingPageWebDAVLoadingHistory")
                : chrome.i18n.getMessage("settingPageWebDAVRefreshHistory")}
            </button>
          </div>
          <span className="text-xs text-gray-500">
            {backupHistory.length === 0
              ? chrome.i18n.getMessage("settingPageWebDAVNoBackupHistory")
              : chrome.i18n.getMessage("settingPageWebDAVBackupHistoryCount", String(backupHistory.length))}
          </span>
        </div>
      </SettingItemCol>

      <SettingItemCol description={chrome.i18n.getMessage("settingPageWebDAVLastOperation")}>
        <span
          className={`text-sm ${
            webdavStatus.lastOperationStatus === "error"
              ? "text-red-500"
              : webdavStatus.lastOperationStatus === "success"
                ? "text-green-600"
                : "text-gray-600"
          }`}>
          {webdavStatus.lastOperationMessage || chrome.i18n.getMessage("settingPageWebDAVNoOperationYet")}
        </span>
      </SettingItemCol>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          className="text-blue-500 text-lg disabled:text-gray-400"
          disabled={!isConfigComplete || actionLoading !== null}
          onClick={() => runAction("webdav_test_connection")}
        >
          {actionLoading === "test"
            ? chrome.i18n.getMessage("settingPageWebDAVTestingConnection")
            : chrome.i18n.getMessage("settingPageWebDAVTestConnection")}
        </button>
        <button
          className="text-blue-500 text-lg disabled:text-gray-400"
          disabled={!isConfigComplete || actionLoading !== null}
          onClick={() => runAction("webdav_backup_export")}
        >
          {actionLoading === "backup"
            ? chrome.i18n.getMessage("settingPageWebDAVBackingUp")
            : chrome.i18n.getMessage("settingPageWebDAVBackup")}
        </button>
        <button
          className="text-blue-500 text-lg disabled:text-gray-400"
          disabled={!isConfigComplete || actionLoading !== null || (backupHistory.length > 0 && !selectedBackupFileName)}
          onClick={() => runAction("webdav_backup_restore")}
        >
          {actionLoading === "restore"
            ? chrome.i18n.getMessage("settingPageWebDAVRestoring")
            : chrome.i18n.getMessage("settingPageWebDAVRestore")}
        </button>
      </div>
    </SettingBlock>
  )
}
