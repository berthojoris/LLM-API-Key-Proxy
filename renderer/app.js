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
