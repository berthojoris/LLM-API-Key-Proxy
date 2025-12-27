# LLM API Key Proxy - Windows Desktop Application

A modern, user-friendly Windows desktop application for managing the LLM API Key Proxy. This Electron-based GUI wraps the original [LLM API Key Proxy](https://github.com/Mirrowel/LLM-API-Key-Proxy) with a professional Windows interface, eliminating the need for manual terminal operations.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- **Proxy Control**: Start and stop the LLM API proxy with a single click
- **Terminal Management**: All terminal operations handled internally - no manual command line needed
- **Credential Management**: Manage multiple LLM API keys and OAuth credentials
- **Load Balancing**: Configure automatic request distribution across multiple accounts
- **Real-time Logs**: View proxy activity and error logs in real-time
- **System Tray Integration**: Minimize to system tray with quick access controls
- **Persistent Configuration**: Settings are saved and restored automatically
- **Auto-reload Development**: Changes to source files automatically reload during development
- **Modern Windows UI**: Native-looking interface with Windows design language

## Requirements

- **Operating System**: Windows 10 or later (x64)
- **Python 3.8+**: Required to run the underlying proxy server
- **Node.js 18+**: Required for Electron application runtime
- **npm or yarn**: Package manager for Node.js dependencies

## Installation

### Option 1: Using Pre-built Installer (Recommended for End Users)

1. Download the latest installer from the [Releases](https://github.com/Mirrowel/LLM-API-Key-Proxy/releases) page
2. Run the `LLM-API-Key-Proxy-Setup.exe` installer
3. Follow the installation wizard
4. Launch the application from Start Menu or desktop shortcut

### Option 2: Building from Source (For Developers)

1. Clone the repository:
```bash
git clone https://github.com/Mirrowel/LLM-API-Key-Proxy-Windows.git
cd LLM-API-Key-Proxy-Windows
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies for the proxy:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
npm start
```

## Usage

### Starting the Proxy

1. Launch the application
2. Configure your proxy settings (first time only):
   - **Python Path**: Path to your Python executable (e.g., `python` or `C:\Python39\python.exe`)
   - **Proxy Script**: Path to the proxy script (default: `main.py`)
   - **Working Directory**: Directory where the proxy script is located
3. Click the **Start Proxy** button
4. The proxy status indicator will turn green when running

### Stopping the Proxy

1. Click the **Stop Proxy** button
2. The proxy will gracefully shut down
3. Status indicator will return to gray

### System Tray Controls

When minimized to system tray:
- **Double-click**: Show/hide the application window
- **Right-click**: Access context menu with:
  - Show App
  - Start Proxy
  - Stop Proxy
  - Quit

### Configuring Load Balancing

1. Navigate to the **Load Balancing Configuration** panel
2. Set the following parameters:
   - **Max Retries**: Maximum number of retry attempts (1-10, default: 3)
   - **Cooldown (ms)**: Delay between retries in milliseconds (1000-60000, default: 5000)
   - **Timeout (ms)**: Request timeout in milliseconds (1000-120000, default: 30000)
3. Click **Save Configuration**

### Managing Credentials

The application automatically discovers credentials from:
- Environment variables
- Local configuration files
- OAuth token files

Supported providers:
- OpenAI API Key
- Anthropic API Key
- Google OAuth
- And more...

View credential status in the **Credential Management** panel.

## Configuration

### Application Settings

Settings are stored in `userData` directory:
- Windows: `%APPDATA%/llm-api-key-proxy-windows/`

Configuration includes:
- Proxy settings (Python path, script path, working directory)
- Load balancing parameters
- Window size and position
- Last proxy status

### Proxy Configuration

The underlying proxy uses `.env` files for configuration. Create a `.env` file in your working directory:

```env
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

### Environment Variables

You can also configure the proxy using environment variables:

- `OPENAI_API_KEY`: Your OpenAI API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Google OAuth credentials
- `PROXY_PORT`: Port for the proxy server (default: 8000)
- `PROXY_HOST`: Host address for the proxy server (default: 127.0.0.1)

## Building for Distribution

### Build Windows Installer

```bash
npm run build
```

This creates an NSIS installer in the `dist` directory:
- `LLM API Key Proxy Setup 1.0.0.exe`

### Build without Publishing

```bash
npm run dist
```

### Build Configuration

The `package.json` includes electron-builder configuration for Windows:
- **Target**: NSIS installer (x64)
- **Application ID**: `com.llmproxy.windows`
- **One-click Install**: Disabled (allows custom installation directory)
- **Shortcuts**: Desktop and Start Menu shortcuts created

## Development

### Development Server with Auto-Reload

The application includes `electron-reloader` for automatic reloading:

```bash
npm start
```

Any changes to:
- `main.js` - Main process
- `preload.js` - Preload script
- `renderer/` - Renderer process (HTML, CSS, JS)

Will automatically reload the application.

### Project Structure

```
LLM-API-Key-Proxy-Windows/
├── main.js                 # Electron main process
├── preload.js              # Preload script (IPC bridge)
├── package.json             # Project configuration
├── assets/                 # Application assets
│   └── icon.svg            # Application icon
├── renderer/              # Renderer process files
│   ├── index.html          # Main HTML structure
│   ├── app.js              # Renderer JavaScript
│   └── styles.css          # Application styles
└── README.md               # This file
```

### Architecture

The application follows Electron's multi-process architecture:

- **Main Process**: Handles window management, proxy process spawning, system tray, and IPC
- **Preload Script**: Securely exposes IPC APIs to the renderer using `contextBridge`
- **Renderer Process**: UI rendering and user interaction

### IPC Communication

The application uses secure IPC patterns:

```javascript
// Renderer process (via contextBridge)
const startProxy = window.electronAPI.startProxy()
const stopProxy = window.electronAPI.stopProxy()
const getStatus = window.electronAPI.getProxyStatus()

// Main process (ipcMain)
ipcMain.handle('start-proxy', async () => { /* ... */ })
ipcMain.handle('stop-proxy', async () => { /* ... */ })
ipcMain.handle('get-proxy-status', async () => { /* ... */ })
```

## Troubleshooting

### Proxy Won't Start

1. **Check Python Path**: Ensure the Python path is correct and accessible
2. **Verify Script Location**: Make sure `main.py` exists in the specified working directory
3. **Check Dependencies**: Ensure all Python dependencies are installed
4. **View Logs**: Check the Proxy Logs panel for error messages

### Application Won't Launch

1. **Node.js Version**: Ensure Node.js 18+ is installed
2. **Dependencies**: Run `npm install` to install all dependencies
3. **Anti-virus**: Some anti-virus software may block Electron applications

### Proxy Stops Unexpectedly

1. **Check Logs**: Review the Proxy Logs for error messages
2. **Python Process**: Ensure Python is not terminated by another application
3. **Port Conflicts**: Check if port 8000 (or custom port) is in use

### Configuration Not Saved

1. **Write Permissions**: Ensure the application has write access to `%APPDATA%`
2. **Disk Space**: Check available disk space
3. **File Locks**: Close other instances of the application

### Logs Not Appearing

1. **Check PYTHONUNBUFFERED**: Ensure Python output is unbuffered (set by default)
2. **Refresh**: Try stopping and starting the proxy again
3. **Clear Logs**: Use the Clear button in the Proxy Logs panel

## Advanced Usage

### Running Multiple Instances

While not officially supported, you can run multiple instances by:
1. Copying the application to different directories
2. Using different working directories for each instance
3. Configuring different ports in each instance's settings

### Custom Proxy Scripts

You can use custom proxy scripts:
1. Place your script in the working directory
2. Update the **Proxy Script** setting in the application
3. Ensure your script is compatible with the original proxy API

### Integration with Other Applications

The proxy exposes OpenAI-compatible endpoints. Configure your applications to use:
- **Host**: `127.0.0.1` (or custom host)
- **Port**: `8000` (or custom port)
- **API Key**: Your configured OpenAI API key

Example with curl:
```bash
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Security Considerations

- **Context Isolation**: Enabled by default for security
- **Node Integration**: Disabled in renderer process
- **Sandbox**: Configurable (disabled for proxy functionality)
- **Credential Storage**: Uses `electron-store` for secure local storage
- **IPC Validation**: All IPC communications are validated

Never share your API keys or configuration files with others.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow the existing code style
- Use clear, descriptive variable and function names
- Add comments for complex logic
- Test thoroughly before submitting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original [LLM API Key Proxy](https://github.com/Mirrowel/LLM-API-Key-Proxy) by Mirrowel
- [Electron](https://www.electronjs.org/) framework
- [electron-builder](https://www.electron.build/) for packaging

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the original proxy documentation

## Changelog

### Version 1.0.0 (Current)
- Initial Windows desktop application release
- Proxy ON/OFF control
- Terminal management
- Credential management UI
- Load balancing configuration
- System tray integration
- Auto-reload development support
- Modern Windows UI

## Roadmap

- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Advanced log filtering and search
- [ ] Proxy statistics dashboard
- [ ] Credential import/export
- [ ] Auto-update functionality
- [ ] Linux and macOS support

---

Made with ❤️ using Electron.js
