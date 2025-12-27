const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const Store = require('electron-store')

const store = new Store()

let mainWindow = null
let proxyProcess = null
let tray = null

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

  proxyProcess = spawn(pythonPath, [proxyScript], {
    cwd: workingDir,
    shell: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
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
