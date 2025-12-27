const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  startProxy: () => ipcRenderer.invoke('start-proxy'),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  getProxyStatus: () => ipcRenderer.invoke('get-proxy-status'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveProxySettings: (settings) => ipcRenderer.invoke('save-proxy-settings', settings),
  loadProxySettings: () => ipcRenderer.invoke('load-proxy-settings'),
  onProxyStatus: (callback) => {
    const subscription = (_event, data) => callback(data)
    ipcRenderer.on('proxy-status', subscription)
    return () => ipcRenderer.removeListener('proxy-status', subscription)
  },
  onProxyLog: (callback) => {
    const subscription = (_event, data) => callback(data)
    ipcRenderer.on('proxy-log', subscription)
    return () => ipcRenderer.removeListener('proxy-log', subscription)
  },
  getOAuthProviders: () => ipcRenderer.invoke('get-oauth-providers'),
  getOAuthCredentials: () => ipcRenderer.invoke('get-oauth-credentials'),
  startOAuthAuth: (providerId, customPort) => ipcRenderer.invoke('start-oauth-auth', providerId, customPort),
  exportOAuthEnv: (providerId, credentialId) => ipcRenderer.invoke('export-oauth-env', providerId, credentialId),
  deleteOAuthCredential: (providerId, credentialId) => ipcRenderer.invoke('delete-oauth-credential', providerId, credentialId),
  onOAuthStatus: (callback) => {
    const subscription = (_event, data) => callback(data)
    ipcRenderer.on('oauth-status', subscription)
    return () => ipcRenderer.removeListener('oauth-status', subscription)
  }
})
