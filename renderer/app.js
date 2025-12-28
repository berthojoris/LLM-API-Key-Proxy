const startBtn = document.getElementById('start-btn')
const stopBtn = document.getElementById('stop-btn')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const logsContainer = document.getElementById('logs-container')
const clearLogsBtn = document.getElementById('clear-logs-btn')
const saveSettingsBtn = document.getElementById('save-settings-btn')
const saveConfigBtn = document.getElementById('save-config-btn')

const pythonPathInput = document.getElementById('python-path')
const proxyScriptInput = document.getElementById('proxy-script')
const workingDirInput = document.getElementById('working-dir')

const maxRetriesInput = document.getElementById('max-retries')
const cooldownMsInput = document.getElementById('cooldown-ms')
const timeoutMsInput = document.getElementById('timeout-ms')

let isRunning = false

async function loadSettings() {
  try {
    const settings = await window.electronAPI.loadProxySettings()
    if (settings.pythonPath) pythonPathInput.value = settings.pythonPath
    if (settings.proxyScript) proxyScriptInput.value = settings.proxyScript
    if (settings.workingDir) workingDirInput.value = settings.workingDir
  } catch (error) {
    addLog('error', `Failed to load settings: ${error.message}`)
  }
}

async function loadConfig() {
  try {
    const config = await window.electronAPI.loadConfig()
    if (config.maxRetries) maxRetriesInput.value = config.maxRetries
    if (config.cooldownMs) cooldownMsInput.value = config.cooldownMs
    if (config.timeoutMs) timeoutMsInput.value = config.timeoutMs
  } catch (error) {
    addLog('error', `Failed to load config: ${error.message}`)
  }
}

function updateStatus(status, message) {
  statusDot.className = `status-dot ${status}`
  statusText.textContent = message || status.charAt(0).toUpperCase() + status.slice(1)

  if (status === 'running') {
    isRunning = true
    startBtn.disabled = true
    stopBtn.disabled = false
  } else if (status === 'stopped') {
    isRunning = false
    startBtn.disabled = false
    stopBtn.disabled = true
  }
}

function addLog(type, log) {
  const logEntry = document.createElement('div')
  logEntry.className = `log-entry log-${type}`
  const timestamp = new Date().toLocaleTimeString()
  logEntry.textContent = `[${timestamp}] ${log}`
  logsContainer.appendChild(logEntry)
  logsContainer.scrollTop = logsContainer.scrollHeight
}

startBtn.addEventListener('click', async () => {
  try {
    addLog('info', 'Starting proxy...')
    await window.electronAPI.startProxy()
  } catch (error) {
    addLog('error', `Failed to start proxy: ${error.message}`)
  }
})

stopBtn.addEventListener('click', async () => {
  try {
    addLog('info', 'Stopping proxy...')
    await window.electronAPI.stopProxy()
  } catch (error) {
    addLog('error', `Failed to stop proxy: ${error.message}`)
  }
})

clearLogsBtn.addEventListener('click', () => {
  logsContainer.innerHTML = ''
  addLog('info', 'Logs cleared')
})

saveSettingsBtn.addEventListener('click', async () => {
  try {
    const settings = {
      pythonPath: pythonPathInput.value,
      proxyScript: proxyScriptInput.value,
      workingDir: workingDirInput.value
    }
    await window.electronAPI.saveProxySettings(settings)
    addLog('info', 'Settings saved successfully')
  } catch (error) {
    addLog('error', `Failed to save settings: ${error.message}`)
  }
})

document.getElementById('browse-python-btn').addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.browseForFile({
      title: 'Select Python Executable',
      filters: [
        { name: 'Python Executables', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.success && result.filePath) {
      pythonPathInput.value = result.filePath
      addLog('info', `Selected Python: ${result.filePath}`)
    }
  } catch (error) {
    addLog('error', `Failed to browse for file: ${error.message}`)
  }
})

document.getElementById('browse-working-dir-btn').addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.browseForDirectory({
      title: 'Select Working Directory'
    })

    if (result.success && result.filePath) {
      workingDirInput.value = result.filePath
      addLog('info', `Selected Working Directory: ${result.filePath}`)
    }
  } catch (error) {
    addLog('error', `Failed to browse for directory: ${error.message}`)
  }
})

document.getElementById('browse-proxy-script-btn').addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.browseForFile({
      title: 'Select Proxy Script',
      filters: [
        { name: 'Python Scripts', extensions: ['py'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.success && result.filePath) {
      proxyScriptInput.value = result.filePath
      addLog('info', `Selected Proxy Script: ${result.filePath}`)
    }
  } catch (error) {
    addLog('error', `Failed to browse for file: ${error.message}`)
  }
})

saveConfigBtn.addEventListener('click', async () => {
  try {
    const config = {
      maxRetries: parseInt(maxRetriesInput.value),
      cooldownMs: parseInt(cooldownMsInput.value),
      timeoutMs: parseInt(timeoutMsInput.value)
    }
    await window.electronAPI.saveConfig(config)
    addLog('info', 'Configuration saved successfully')
  } catch (error) {
    addLog('error', `Failed to save config: ${error.message}`)
  }
})

window.electronAPI.onProxyStatus((data) => {
  updateStatus(data.status, data.message)
  if (data.status === 'running' || data.status === 'stopped') {
    addLog('info', data.message)
  } else if (data.status === 'error') {
    addLog('error', data.message)
  }
})

window.electronAPI.onProxyLog((data) => {
  addLog(data.type, data.log.trim())
})

loadSettings()
loadConfig()

const refreshOAuthBtn = document.getElementById('refresh-oauth-btn')
const oauthProvidersContainer = document.getElementById('oauth-providers-container')

async function loadOAuthProviders() {
  try {
    oauthProvidersContainer.innerHTML = '<div class="loading-spinner">Loading OAuth providers...</div>'

    const providers = await window.electronAPI.getOAuthProviders()
    const credentials = await window.electronAPI.getOAuthCredentials()

    oauthProvidersContainer.innerHTML = ''

    for (const [providerId, provider] of Object.entries(providers)) {
      const providerCard = document.createElement('div')
      providerCard.className = 'oauth-provider-card'
      providerCard.dataset.providerId = providerId

      const credentialsList = credentials[providerId] || []
      const hasCredentials = credentialsList.length > 0

      providerCard.innerHTML = `
        <div class="oauth-provider-header">
          <div class="oauth-provider-info">
            <h3 class="oauth-provider-name">${provider.name}</h3>
            <p class="oauth-provider-description">${provider.description}</p>
          </div>
          <div class="oauth-provider-actions">
            <button class="btn btn-primary btn-small auth-btn" data-provider="${providerId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              🔧 Start Auth [NEW]
            </button>
            <button class="btn btn-secondary btn-small config-port-btn" data-provider="${providerId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.04.64.09.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
              Port: ${provider.callbackPort}
            </button>
          </div>
        </div>
        <div class="oauth-provider-body">
          ${hasCredentials ? `
            <div class="oauth-credentials-list">
              ${credentialsList.map(cred => `
                <div class="oauth-credential-item" data-provider="${providerId}" data-credential="${cred.id}">
                  <div class="oauth-credential-info">
                    <span class="oauth-credential-email">${cred.email}</span>
                    <span class="oauth-credential-status ${cred.status.toLowerCase()}">${cred.status}</span>
                    <span class="oauth-credential-expiry">Expires: ${cred.expiryDate}</span>
                  </div>
                  <div class="oauth-credential-actions">
                    <button class="btn btn-secondary btn-small export-btn" data-provider="${providerId}" data-credential="${cred.id}" title="Export to .env">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                      </svg>
                    </button>
                    <button class="btn btn-danger btn-small delete-cred-btn" data-provider="${providerId}" data-credential="${cred.id}" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="no-credentials">No credentials configured. Click "Authenticate" to add a credential.</p>'}
        </div>
      `

      oauthProvidersContainer.appendChild(providerCard)
    }

    setupOAuthEventListeners()
  } catch (error) {
    oauthProvidersContainer.innerHTML = `<div class="error-message">Failed to load OAuth providers: ${error.message}</div>`
  }
}

function setupOAuthEventListeners() {
  const authButtons = oauthProvidersContainer.querySelectorAll('.auth-btn')
  const exportButtons = oauthProvidersContainer.querySelectorAll('.export-btn')
  const deleteButtons = oauthProvidersContainer.querySelectorAll('.delete-cred-btn')
  const portButtons = oauthProvidersContainer.querySelectorAll('.config-port-btn')

  authButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      console.log('🔵 AUTHENTICATE BUTTON CLICKED!')

      const providerId = btn.dataset.provider
      console.log('Provider ID:', providerId)

      btn.disabled = true
      btn.innerHTML = '<span class="spinner-small"></span> Authenticating...'

      try {
        console.log('📞 Calling startOAuthAuth...')
        addLog('info', `Starting OAuth authentication for ${providerId}...`)

        const result = await window.electronAPI.startOAuthAuth(providerId)
        console.log('📥 Received result:', result)

        if (result.success) {
          addLog('info', `Authentication completed for ${providerId}`)
          await loadOAuthProviders()
        } else {
          addLog('error', `Authentication failed for ${providerId}: ${result.error}`)
          btn.disabled = false
          btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            🔧 Start Auth [NEW]
          `
        }
      } catch (error) {
        console.error('❌ ERROR in authenticate handler:', error)
        addLog('error', `Authentication error: ${error.message}`)
        btn.disabled = false
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          🔧 Start Auth [NEW]
        `
      }
    })
  })

  exportButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.provider
      const credentialId = btn.dataset.credential

      try {
        const result = await window.electronAPI.exportOAuthEnv(providerId, credentialId)

        if (result.success) {
          navigator.clipboard.writeText(result.content)
          addLog('info', `Exported ${providerId} credential to clipboard`)
          alert('Exported to clipboard! Paste into your .env file.')
        } else {
          addLog('error', `Export failed: ${result.error}`)
        }
      } catch (error) {
        addLog('error', `Export error: ${error.message}`)
      }
    })
  })

  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.provider
      const credentialId = btn.dataset.credential

      if (!confirm(`Are you sure you want to delete this credential?`)) {
        return
      }

      try {
        const result = await window.electronAPI.deleteOAuthCredential(providerId, credentialId)

        if (result.success) {
          addLog('info', `Deleted credential ${credentialId}`)
          await loadOAuthProviders()
        } else {
          addLog('error', `Delete failed: ${result.error}`)
        }
      } catch (error) {
        addLog('error', `Delete error: ${error.message}`)
      }
    })
  })

  portButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const providerId = btn.dataset.provider
      const currentPort = parseInt(btn.textContent.match(/\d+/)[0])

      const newPort = prompt(`Enter OAuth callback port for ${providerId}:`, currentPort)

      if (newPort && !isNaN(newPort)) {
        const portNum = parseInt(newPort)
        if (portNum > 0 && portNum < 65536) {
          btn.textContent = `Port: ${portNum}`
          addLog('info', `OAuth callback port for ${providerId} set to ${portNum}`)
        } else {
          alert('Please enter a valid port number (1-65535)')
        }
      }
    })
  })
}

window.electronAPI.onOAuthStatus((data) => {
  switch (data.type) {
    case 'starting':
      addLog('info', `🔄 ${data.message}`)
      break
    case 'log':
      addLog('info', data.message)
      break
    case 'error':
      addLog('error', `❌ ${data.message}`)
      break
    case 'success':
      addLog('info', `✅ ${data.message}`)
      break
    case 'failed':
      addLog('error', `❌ ${data.message}`)
      break
    case 'browser_opened':
      addLog('info', `🌐 Browser opened for ${data.provider} authentication`)
      addLog('info', `URL: ${data.url}`)
      break
    default:
      addLog('info', JSON.stringify(data))
  }
})

refreshOAuthBtn.addEventListener('click', () => {
  loadOAuthProviders()
})

loadOAuthProviders()
