const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron')
const path = require('path')
const os = require('os')
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
} catch (_) { }

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

  // Open DevTools automatically for debugging
  mainWindow.webContents.openDevTools()

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
  const srcDir = path.join(workingDir, 'src')

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: process.env.PYTHONPATH ? `${srcDir}${path.delimiter}${process.env.PYTHONPATH}` : srcDir
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

  let workingDir = store.get('workingDir', '.')
  const pythonPath = store.get('pythonPath', 'python')
  const port = customPort || provider.callbackPort

  // Need to use require here to get the sync version of fs
  const fsSync = require('fs');

  // Get the current directory and check for src directory there
  const currentDir = process.cwd();
  const currentSrcDir = path.join(currentDir, 'src');
  const storedSrcDir = path.join(workingDir, 'src');

  let srcDir;

  // Use current directory's src if it exists, otherwise use stored directory's src
  // If neither exists, default to current directory
  if (fsSync.existsSync(currentSrcDir)) {
    console.log('Using src directory from current working directory')
    workingDir = '.'
    srcDir = currentSrcDir
  } else if (fsSync.existsSync(storedSrcDir)) {
    console.log('Using src directory from stored working directory')
    srcDir = storedSrcDir
  } else {
    console.log('Warning: src directory not found in current or stored directory, using current directory')
    workingDir = '.'
    srcDir = currentSrcDir
  }

  console.log('OAuth Auth Debug:')
  console.log('  Working Dir:', workingDir)
  console.log('  Src Dir:', srcDir)
  console.log('  Python Path:', pythonPath)
  console.log('  Existing PYTHONPATH:', process.env.PYTHONPATH)

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: process.env.PYTHONPATH ? `${srcDir}${path.delimiter}${process.env.PYTHONPATH}` : srcDir
  }

  console.log('  Final PYTHONPATH:', env.PYTHONPATH)

  try {
    // Create display name from provider ID (convert to title case)
    const displayName = providerId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    console.log('Display name:', displayName)

    // Create a temporary Python script to run authentication directly
    const tempScriptPath = path.join(os.tmpdir(), `oauth_${providerId}_${Date.now()}.py`)
    const tempScriptContent = `
import asyncio
import sys
import os
import json
from pathlib import Path
import webbrowser

# CRITICAL: Disable automatic browser opening in Python
# The Electron app will handle opening the browser
os.environ['ELECTRON_OAUTH_MODE'] = '1'

# Add the src directory to the Python path to ensure imports work
sys.path.insert(0, r"${srcDir}")

try:
    from rotator_library.provider_factory import get_provider_auth_class
    import httpx
    import secrets
    import hashlib
    import base64
    import time
    
    async def run_authentication():
        try:
            # Get the authentication class for the provider
            auth_class = get_provider_auth_class("${providerId}")
            auth_instance = auth_class()
            
            # Set the callback port for providers that support it
            if hasattr(auth_instance, 'CALLBACK_PORT'):
                auth_instance.CALLBACK_PORT = ${port}
            
            # Create the oauth_creds directory if it doesn't exist
            oauth_base_dir = Path.cwd() / "oauth_creds"
            oauth_base_dir.mkdir(exist_ok=True)
            
            # Determine appropriate file name based on provider
            existing_files = list(oauth_base_dir.glob("${providerId}_oauth_*.json"))
            next_num = 1
            if existing_files:
                nums = []
                for f in existing_files:
                    match = __import__('re').search(r'_oauth_(\\\\d+)\\\\.json$', f.name)
                    if match:
                        nums.append(int(match.group(1)))
                if nums:
                    next_num = max(nums) + 1
            
            cred_file_path = oauth_base_dir / f"${providerId}_oauth_{next_num}.json"
            
            print(f"Starting authentication for ${providerId}...", flush=True)
            print(f"Callback port: ${port}", flush=True)
            print(f"Credential file path: {cred_file_path}", flush=True)
            
            # For Qwen provider, manually perform the OAuth flow without browser auto-open
            if "${providerId}" == "qwen_code":
                # Generate code verifier and challenge for PKCE
                code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8").rstrip("=")
                code_challenge = base64.urlsafe_b64encode(
                    hashlib.sha256(code_verifier.encode("utf-8")).digest()
                ).decode("utf-8").rstrip("=")
                
                CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
                SCOPE = "openid profile email model.completion"
                TOKEN_ENDPOINT = "https://chat.qwen.ai/api/v1/oauth2/token"
                
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                }
                
                async with httpx.AsyncClient() as client:
                    # Request device code
                    dev_response = await client.post(
                        "https://chat.qwen.ai/api/v1/oauth2/device/code",
                        headers=headers,
                        data={
                            "client_id": CLIENT_ID,
                            "scope": SCOPE,
                            "code_challenge": code_challenge,
                            "code_challenge_method": "S256",
                        },
                    )
                    dev_response.raise_for_status()
                    dev_data = dev_response.json()
                    
                    verification_url = dev_data["verification_uri_complete"]
                    
                    # Output URL for Electron to capture and open
                    print(f"OAUTH_URL:{verification_url}", flush=True)
                    print(f"Please authenticate in the browser that just opened...", flush=True)
                    
                    # Poll for token
                    token_data = None
                    start_time = time.time()
                    interval = dev_data.get("interval", 5)
                    
                    while time.time() - start_time < dev_data["expires_in"]:
                        await asyncio.sleep(interval)
                        
                        poll_response = await client.post(
                            TOKEN_ENDPOINT,
                            headers=headers,
                            data={
                                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                                "device_code": dev_data["device_code"],
                                "client_id": CLIENT_ID,
                                "code_verifier": code_verifier,
                            },
                        )
                        
                        if poll_response.status_code == 200:
                            token_data = poll_response.json()
                            print("Token received successfully!", flush=True)
                            break
                        elif poll_response.status_code == 400:
                            poll_data = poll_response.json()
                            error_type = poll_data.get("error")
                            if error_type == "authorization_pending":
                                print(f"Waiting for authorization... ({int(time.time() - start_time)}s elapsed)", flush=True)
                            elif error_type == "slow_down":
                                interval = int(interval * 1.5)
                                if interval > 10:
                                    interval = 10
                            else:
                                raise ValueError(f"Token polling failed: {poll_data.get('error_description', error_type)}")
                        else:
                            poll_response.raise_for_status()
                    
                    if not token_data:
                        raise TimeoutError("OAuth device flow timed out. Please try again.")
                    
                    # Save credentials
                    creds = {
                        "access_token": token_data["access_token"],
                        "refresh_token": token_data.get("refresh_token"),
                        "expiry_date": (time.time() + token_data["expires_in"]) * 1000,
                        "resource_url": token_data.get("resource_url", "https://portal.qwen.ai/v1"),
                        "_proxy_metadata": {
                            "provider_name": "${providerId}",
                            "display_name": "Qwen Code",
                            "email": "user@example.com",
                            "last_check_timestamp": time.time(),
                        }
                    }
                    
                    with open(str(cred_file_path), 'w') as f:
                        json.dump(creds, f, indent=2)
                    
                    print(f"Authentication successful for ${providerId}!", flush=True)
                    print("AUTHENTICATION_SUCCESS", flush=True)
            else:
                # For other providers, use the standard initialize_token flow
                temp_creds = {
                    "_proxy_metadata": {
                        "provider_name": "${providerId}",
                        "display_name": "${displayName}"
                    }
                }
                
                # Call initialize_token - it should handle URL output
                initialized_creds = await auth_instance.initialize_token(temp_creds)
                
                # Save the initialized credentials
                with open(str(cred_file_path), 'w') as f:
                    json.dump(initialized_creds, f, indent=2)
                
                print(f"Authentication successful for ${providerId}!", flush=True)
                print("AUTHENTICATION_SUCCESS", flush=True)
                
                # Print user info for confirmation
                user_info = await auth_instance.get_user_info(initialized_creds)
                email = user_info.get("email", "unknown")
                print(f"User: {email}", flush=True)
            
        except Exception as e:
            print(f"Authentication failed: {str(e)}", file=sys.stderr, flush=True)
            print("AUTHENTICATION_FAILED", file=sys.stderr, flush=True)
            import traceback
            traceback.print_exc()
            sys.exit(1)
    
    # Run the authentication
    asyncio.run(run_authentication())
    
except ImportError as e:
    print(f"Failed to import authentication modules: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error during authentication: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
`

    // Write the temporary script
    const fs = require('fs').promises;
    await fs.writeFile(tempScriptPath, tempScriptContent)
    console.log('✅ Temporary OAuth script created at:', tempScriptPath)
    console.log('📝 Script size:', tempScriptContent.length, 'bytes')

    // Spawn the Python process to run the temporary script
    console.log('🐍 Spawning Python process...')
    console.log('   Command:', pythonPath)
    console.log('   Script:', tempScriptPath)
    console.log('   Working Dir:', workingDir)

    oauthProcess = spawn(pythonPath, [tempScriptPath], {
      cwd: workingDir,
      shell: true,
      env
    })

    console.log('✅ Python process spawned with PID:', oauthProcess.pid)

    let completed = false
    let stderrOutput = ''
    let stdoutOutput = ''

    // Send initial status to UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth-status', {
        type: 'starting',
        provider: providerId,
        message: `Starting OAuth flow for ${providerId}...`
      })
    }

    oauthProcess.stdout.on('data', (data) => {
      const output = data.toString()
      stdoutOutput += output
      console.log('OAuth stdout:', output)

      // Send stdout to UI for visibility
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('oauth-status', {
          type: 'log',
          provider: providerId,
          message: output.trim()
        })
      }

      // Check for authentication success
      if (output.includes('AUTHENTICATION_SUCCESS')) {
        completed = true
      }

      // Check for OAUTH_URL: prefix (new format for better parsing)
      const oauthUrlMatch = output.match(/OAUTH_URL:(https?:\/\/[^\s\n]+)/i)
      if (oauthUrlMatch) {
        const authUrl = oauthUrlMatch[1]
        console.log('Opening OAuth URL:', authUrl)
        shell.openExternal(authUrl)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth-status', {
            type: 'browser_opened',
            provider: providerId,
            url: authUrl
          })
        }
      } else {
        // Fallback: Check for URL without prefix
        const urlMatch = output.match(/https?:\/\/[^\s\n]+/i)
        if (urlMatch) {
          const authUrl = urlMatch[0]
          console.log('Opening URL (fallback):', authUrl)
          shell.openExternal(authUrl)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('oauth-status', {
              type: 'browser_opened',
              provider: providerId,
              url: authUrl
            })
          }
        }
      }
    })

    oauthProcess.stderr.on('data', (data) => {
      const output = data.toString()
      stderrOutput += output
      console.error('OAuth stderr:', output)

      // Send errors to UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('oauth-status', {
          type: 'error',
          provider: providerId,
          message: output.trim()
        })
      }

      // Check for authentication success in stderr as well
      if (output.includes('AUTHENTICATION_SUCCESS')) {
        completed = true
      }
    })

    return new Promise((resolve) => {
      oauthProcess.on('close', async (code) => {
        oauthProcess = null

        // Clean up the temporary script
        try {
          await fs.unlink(tempScriptPath)
        } catch (cleanupErr) {
          console.error('Failed to clean up temporary script:', cleanupErr)
        }

        if (completed || stderrOutput.includes('AUTHENTICATION_SUCCESS')) {
          console.log('✅ OAuth authentication completed successfully')
          // Wait a moment for the file to be written completely
          await new Promise(resolve => setTimeout(resolve, 1000))
          const creds = await getOAuthCredentials()

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('oauth-status', {
              type: 'success',
              provider: providerId,
              message: 'Authentication completed successfully!'
            })
          }

          resolve({ success: true, credentials: creds })
        } else {
          console.error('❌ OAuth authentication failed')
          console.error('Exit code:', code)
          console.error('Stderr output:', stderrOutput)
          console.error('Stdout output:', stdoutOutput)

          const errorMsg = stderrOutput.trim() || stdoutOutput.trim() || `Authentication failed with exit code ${code}`

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('oauth-status', {
              type: 'failed',
              provider: providerId,
              message: `Authentication failed: ${errorMsg.substring(0, 200)}`
            })
          }

          resolve({ success: false, error: errorMsg })
        }
      })

      oauthProcess.on('error', (error) => {
        console.error('❌ Python process error:', error)
        console.error('   Error code:', error.code)
        console.error('   Error message:', error.message)

        oauthProcess = null

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth-status', {
            type: 'failed',
            provider: providerId,
            message: `Failed to start Python process: ${error.message}`
          })
        }

        // Clean up the temporary script
        fs.unlink(tempScriptPath).catch(err => console.error('Failed to clean up temporary script:', err))
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
