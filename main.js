const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs').promises
const Store = require('electron-store')

const store = new Store()

let mainWindow = null
let proxyProcess = null
let tray = null
let oauthProcess = null

const OAUTH_PROVIDERS = {
  gemini_cli: {
    name: 'Gemini CLI',
    description: 'Google OAuth2 - Cloud platform, caching, tool handling',
    callbackPort: 51120
  },
  antigravity: {
    name: 'Antigravity',
    description: 'Google OAuth2 - Cloud platform, cclog, experiments, Claude access',
    callbackPort: 51121
  },
  qwen_code: {
    name: 'Qwen Code',
    description: 'Qwen OAuth2 - openid, profile, email, model.completion',
    callbackPort: 11451
  },
  iflow: {
    name: 'iFlow',
    description: 'Custom OAuth2 - API key + OAuth support',
    callbackPort: 11451
  }
}

try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true
  })
} catch (_) {}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icon.svg'),
    show: false
  })

  mainWindow.loadFile('renderer/index.html')

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.svg')
  const trayIcon = nativeImage.createFromPath(iconPath)

  if (trayIcon.isEmpty()) {
    const buffer = Buffer.from('<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" rx="2" fill="#0078D4"/><circle cx="8" cy="8" r="6" fill="white"/><circle cx="8" cy="8" r="2" fill="#0078D4"/></svg>')
    tray = new Tray(nativeImage.createFromBuffer(buffer))
  } else {
    tray = new Tray(trayIcon)
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Start Proxy',
      click: () => {
        startProxy()
      }
    },
    {
      label: 'Stop Proxy',
      click: () => {
        stopProxy()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        stopProxy()
        app.quit()
      }
    }
  ])

  tray.setToolTip('LLM API Key Proxy')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

function startProxy() {
  if (proxyProcess) {
    sendProxyStatus('running', 'Proxy is already running')
    return
  }

  const pythonPath = store.get('pythonPath', 'python')
  const proxyScript = store.get('proxyScript', 'main.py')
  const workingDir = store.get('workingDir', '.')

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: process.env.PYTHONPATH ? `${workingDir}${path.delimiter}${process.env.PYTHONPATH}` : workingDir
  }

  proxyProcess = spawn(pythonPath, [proxyScript], {
    cwd: workingDir,
    shell: true,
    env
  })

  proxyProcess.stdout.on('data', (data) => {
    const log = data.toString()
    sendProxyLog('stdout', log)
    sendProxyStatus('running', 'Proxy started successfully')
  })

  proxyProcess.stderr.on('data', (data) => {
    const log = data.toString()
    sendProxyLog('stderr', log)
  })

  proxyProcess.on('close', (code) => {
    sendProxyStatus('stopped', `Proxy exited with code ${code}`)
    proxyProcess = null
  })

  proxyProcess.on('error', (error) => {
    sendProxyStatus('error', `Proxy error: ${error.message}`)
    sendProxyLog('error', error.message)
    proxyProcess = null
  })

  sendProxyStatus('starting', 'Starting proxy...')
}

function stopProxy() {
  if (!proxyProcess) {
    sendProxyStatus('stopped', 'Proxy is not running')
    return
  }

  proxyProcess.kill('SIGTERM')

  setTimeout(() => {
    if (proxyProcess) {
      proxyProcess.kill('SIGKILL')
    }
  }, 5000)
}

function sendProxyStatus(status, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('proxy-status', { status, message })
  }
}

function sendProxyLog(type, log) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('proxy-log', { type, log })
  }
}

function getProxyStatus() {
  if (proxyProcess) {
    return { status: 'running', pid: proxyProcess.pid }
  }
  return { status: 'stopped' }
}

async function getOAuthCredentials() {
  const workingDir = store.get('workingDir', '.')
  const oauthCredsPath = path.join(workingDir, 'oauth_creds')
  const credentials = {}

  for (const provider of Object.keys(OAUTH_PROVIDERS)) {
    credentials[provider] = []
  }

  try {
    await fs.access(oauthCredsPath)
    const files = await fs.readdir(oauthCredsPath)

    for (const provider of Object.keys(OAUTH_PROVIDERS)) {
      const providerFiles = files.filter(f => f.startsWith(`${provider}_oauth_`) && f.endsWith('.json'))

      for (const file of providerFiles) {
        try {
          const filePath = path.join(oauthCredsPath, file)
          const data = await fs.readFile(filePath, 'utf-8')
          const credential = JSON.parse(data)

          const numMatch = file.match(/oauth_(\d+)\.json$/)
          const credentialNum = numMatch ? parseInt(numMatch[1]) : 1

          const metadata = credential._proxy_metadata || {}
          const email = metadata.email || credential.email || 'Unknown'
          const expiryDate = credential.expiry_date || credential.expiry

          credentials[provider].push({
            id: file,
            number: credentialNum,
            email: email,
            status: expiryDate && Date.now() / 1000 < expiryDate ? 'Active' : 'Expired',
            expiryDate: expiryDate ? new Date(expiryDate * 1000).toLocaleString() : 'N/A'
          })
        } catch (err) {
          console.error(`Error reading credential file ${file}:`, err)
        }
      }

      credentials[provider].sort((a, b) => a.number - b.number)
    }
  } catch (err) {
    console.log('oauth_creds directory does not exist yet')
  }

  return credentials
}

async function startOAuthAuthentication(providerId, customPort) {
  const provider = OAUTH_PROVIDERS[providerId]
  if (!provider) {
    return { success: false, error: 'Unknown provider' }
  }

  const workingDir = store.get('workingDir', '.')
  const pythonPath = store.get('pythonPath', 'python')
  const port = customPort || provider.callbackPort

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: process.env.PYTHONPATH ? `${workingDir}${path.delimiter}${process.env.PYTHONPATH}` : workingDir
  }

  try {
    oauthProcess = spawn(pythonPath, ['-m', 'rotator_library.credential_tool', '--oauth', providerId, '--port', port.toString()], {
      cwd: workingDir,
      shell: true,
      env
    })

    let authUrl = null
    let completed = false
    let stderrOutput = ''

    oauthProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('OAuth stdout:', output)

      const urlMatch = output.match(/https?:\/\/[^\s\n]+/i)
      if (urlMatch && !authUrl) {
        authUrl = urlMatch[0]
        shell.openExternal(authUrl)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth-status', {
            type: 'browser_opened',
            provider: providerId,
            url: authUrl
          })
        }
      }

      if (output.toLowerCase().includes('success') || output.toLowerCase().includes('authenticated')) {
        completed = true
      }
    })

    oauthProcess.stderr.on('data', (data) => {
      const output = data.toString()
      stderrOutput += output
      console.log('OAuth stderr:', output)

      const urlMatch = output.match(/https?:\/\/[^\s\n]+/i)
      if (urlMatch && !authUrl) {
        authUrl = urlMatch[0]
        shell.openExternal(authUrl)
      }

      if (output.toLowerCase().includes('success') || output.toLowerCase().includes('authenticated')) {
        completed = true
      }
    })

    return new Promise((resolve) => {
      oauthProcess.on('close', (code) => {
        oauthProcess = null

        if (completed || code === 0) {
          getOAuthCredentials().then(creds => {
            resolve({ success: true, credentials: creds })
          })
        } else {
          const errorMsg = stderrOutput.trim() || `Authentication failed with code ${code}`
          resolve({ success: false, error: errorMsg })
        }
      })

      oauthProcess.on('error', (error) => {
        oauthProcess = null
        resolve({ success: false, error: error.message })
      })
    })
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function exportOAuthToEnv(providerId, credentialId) {
  const workingDir = store.get('workingDir', '.')
  const oauthCredsPath = path.join(workingDir, 'oauth_creds')
  const filePath = path.join(oauthCredsPath, credentialId)

  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const credential = JSON.parse(data)

    const provider = OAUTH_PROVIDERS[providerId]
    const prefix = providerId.toUpperCase()
    const numMatch = credentialId.match(/oauth_(\d+)\.json$/)
    const num = numMatch ? numMatch[1] : '1'

    const envContent = `# ${provider.name} Credential #${num}
# Exported from: ${credentialId}
# Generated at: ${new Date().toISOString()}

${prefix}_${num}_ACCESS_TOKEN=${credential.access_token || ''}
${prefix}_${num}_REFRESH_TOKEN=${credential.refresh_token || ''}
${prefix}_${num}_CLIENT_ID=${credential.client_id || ''}
${prefix}_${num}_CLIENT_SECRET=${credential.client_secret || ''}
${prefix}_${num}_TOKEN_URI=${credential.token_uri || 'https://oauth2.googleapis.com/token'}
${prefix}_${num}_SCOPE=${credential.scope || ''}
${prefix}_${num}_TOKEN_TYPE=${credential.token_type || 'Bearer'}
${prefix}_${num}_ID_TOKEN=${credential.id_token || ''}
${prefix}_${num}_EXPIRY_DATE=${credential.expiry_date || credential.expiry || 0}
${prefix}_${num}_EMAIL=${credential._proxy_metadata?.email || credential.email || ''}
${prefix}_${num}_UNIVERSE_DOMAIN=${credential.universe_domain || 'googleapis.com'}
`

    return { success: true, content: envContent }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function deleteOAuthCredential(providerId, credentialId) {
  const workingDir = store.get('workingDir', '.')
  const oauthCredsPath = path.join(workingDir, 'oauth_creds')
  const filePath = path.join(oauthCredsPath, credentialId)

  try {
    await fs.unlink(filePath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

app.whenReady().then(() => {
  ipcMain.handle('start-proxy', async () => {
    startProxy()
    return { success: true }
  })

  ipcMain.handle('stop-proxy', async () => {
    stopProxy()
    return { success: true }
  })

  ipcMain.handle('get-proxy-status', async () => {
    return getProxyStatus()
  })

  ipcMain.handle('save-config', async (event, config) => {
    store.set('config', config)
    return { success: true }
  })

  ipcMain.handle('load-config', async () => {
    return store.get('config', {})
  })

  ipcMain.handle('save-proxy-settings', async (event, settings) => {
    if (settings.pythonPath) store.set('pythonPath', settings.pythonPath)
    if (settings.proxyScript) store.set('proxyScript', settings.proxyScript)
    if (settings.workingDir) store.set('workingDir', settings.workingDir)
    return { success: true }
  })

  ipcMain.handle('load-proxy-settings', async () => {
    return {
      pythonPath: store.get('pythonPath', 'python'),
      proxyScript: store.get('proxyScript', 'main.py'),
      workingDir: store.get('workingDir', '.')
    }
  })

  ipcMain.handle('get-oauth-providers', async () => {
    return OAUTH_PROVIDERS
  })

  ipcMain.handle('get-oauth-credentials', async () => {
    return await getOAuthCredentials()
  })

  ipcMain.handle('start-oauth-auth', async (event, providerId, customPort) => {
    return await startOAuthAuthentication(providerId, customPort)
  })

  ipcMain.handle('export-oauth-env', async (event, providerId, credentialId) => {
    return await exportOAuthToEnv(providerId, credentialId)
  })

  ipcMain.handle('delete-oauth-credential', async (event, providerId, credentialId) => {
    return await deleteOAuthCredential(providerId, credentialId)
  })

  ipcMain.handle('open-path-in-explorer', async (event, filePath) => {
    try {
      if (!filePath) {
        return { success: false, error: 'No path provided' }
      }

      let pathToOpen = filePath

      if (process.platform === 'win32') {
        if (pathToOpen.includes('.exe') || pathToOpen.includes('python') || pathToOpen.includes('python3')) {
          pathToOpen = path.dirname(pathToOpen)
        }
        const { exec } = require('child_process')
        await new Promise((resolve, reject) => {
          exec(`explorer "${pathToOpen}"`, (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      } else {
        shell.openPath(pathToOpen)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('browse-for-file', async (event, options = {}) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options.title || 'Select Python Executable',
        defaultPath: options.defaultPath || app.getPath('home'),
        buttonLabel: 'Select',
        filters: options.filters || [
          { name: 'Python Executables', extensions: ['exe'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile'],
        ...options
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      return { success: true, canceled: false, filePath: result.filePaths[0] }
    } catch (error) {
      return { success: false, canceled: false, error: error.message }
    }
  })

  ipcMain.handle('browse-for-directory', async (event, options = {}) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options.title || 'Select Directory',
        defaultPath: options.defaultPath || app.getPath('home'),
        buttonLabel: 'Select',
        properties: ['openDirectory', 'createDirectory'],
        ...options
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      return { success: true, canceled: false, filePath: result.filePaths[0] }
    } catch (error) {
      return { success: false, canceled: false, error: error.message }
    }
  })

  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  stopProxy()
})
