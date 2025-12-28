# OAuth Authentication Troubleshooting Guide

## Quick Start - Testing the Fix

1. **Start the Electron App**
   ```bash
   npm start
   ```

2. **Navigate to OAuth Tab**
   - Click on the "OAuth" tab in the application
   - You should see the providers: Gemini CLI, Antigravity, Qwen Code, iFlow

3. **Test Qwen Code Authentication**
   - Click the "Authenticate" button on the Qwen Code card
   - Watch the console output for debugging information
   - A browser window should open automatically
   - Complete the authentication in the browser
   - Return to the Electron app - it should show success

## What to Check in Console Output

When you click "Authenticate", you should see:

```
OAuth Auth Debug:
  Working Dir: .
  Src Dir: C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src
  Python Path: C:\laragon\bin\python\python-3.13\python.exe
  Existing PYTHONPATH: undefined
  Final PYTHONPATH: C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src
OAuth stdout: Starting authentication for qwen_code...
OAuth stdout: Callback port: 11451
OAuth stdout: Credential file path: ...
OAuth stdout: OAUTH_URL:https://chat.qwen.ai/...
Opening OAuth URL: https://chat.qwen.ai/...
OAuth stdout: Please authenticate in the browser that just opened...
OAuth stdout: Waiting for authorization... (5s elapsed)
OAuth stdout: Waiting for authorization... (10s elapsed)
OAuth stdout: Token received successfully!
OAuth stdout: Authentication successful for qwen_code!
OAuth stdout: AUTHENTICATION_SUCCESS
```

## Common Issues and Solutions

### Issue 1: "Failed to import authentication modules"

**Symptoms:**
```
OAuth stderr: Failed to import authentication modules: ...
```

**Solutions:**
1. Check if `httpx` is installed:
   ```bash
   pip install httpx
   ```
2. Verify the working directory is set correctly in Settings
3. Ensure the `src` directory exists at the working directory path

### Issue 2: Browser doesn't open

**Symptoms:**
- No browser window opens
- URL appears in console but nothing happens

**Solutions:**
1. Check if `shell.openExternal()` is being called (look for "Opening OAuth URL:" in console)
2. Manually copy the URL from console and paste it in a browser
3. Check Windows default browser settings

### Issue 3: "PYTHONPATH" errors

**Symptoms:**
```
ModuleNotFoundError: No module named 'rotator_library'
```

**Solutions:**
1. Verify the `src` directory path in Settings → Proxy Settings → Working Directory
2. Ensure the directory structure is:
   ```
   LLM-API-Key-Proxy-Windows/
   ├── src/
   │   ├── rotator_library/
   │   │   ├── providers/
   │   │   │   ├── qwen_auth_base.py
   │   │   │   └── ...
   │   │   └── ...
   │   └── proxy_app/
   └── ...
   ```

### Issue 4: Timeout during authentication

**Symptoms:**
```
OAuth device flow timed out. Please try again.
```

**Solutions:**
1. Try again - the authentication window has a time limit
2. Complete the authentication faster
3. Check if Qwen's service is accessible from your network

### Issue 5: Credentials not saved

**Symptoms:**
- Authentication succeeds but credential doesn't appear in UI
- File not created in `oauth_creds/` directory

**Solutions:**
1. Check file permissions on the working directory
2. Verify `oauth_creds/` directory exists and is writable
3. Look for error messages in console
4. Click "Refresh" button on OAuth tab

## Debugging Steps

### 1. Enable Maximum Logging

In the Electron console (Ctrl+Shift+I in the app), run:
```javascript
console.log('Debugging enabled')
```

### 2. Check Python Environment

In a terminal, verify Python and dependencies:
```bash
# Check Python version
python --version

# Check if httpx is installed
python -c "import httpx; print(httpx.__version__)"

# Check if rotator_library is accessible
cd C:\DEKSTOP\LLM-API-Key-Proxy-Windows
set PYTHONPATH=C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src
python -c "from rotator_library.provider_factory import get_provider_auth_class; print('OK')"
```

### 3. Manual OAuth Test

Test the OAuth flow directly from Python:
```bash
cd C:\DEKSTOP\LLM-API-Key-Proxy-Windows
set PYTHONPATH=C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src
python
```

Then in Python:
```python
import asyncio
from rotator_library.provider_factory import get_provider_auth_class

async def test():
    auth = get_provider_auth_class('qwen_code')()
    creds = {"_proxy_metadata": {"provider_name": "qwen_code"}}
    result = await auth.initialize_token(creds)
    print(result)

asyncio.run(test())
```

### 4. Check File Creation

After authentication, verify the credential file exists:
```bash
dir C:\DEKSTOP\LLM-API-Key-Proxy-Windows\oauth_creds\qwen_code_oauth_*.json
```

### 5. Inspect Credential File

View the saved credential:
```bash
type C:\DEKSTOP\LLM-API-Key-Proxy-Windows\oauth_creds\qwen_code_oauth_1.json
```

It should contain:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expiry_date": 1234567890000,
  "resource_url": "https://portal.qwen.ai/v1",
  "_proxy_metadata": {
    "provider_name": "qwen_code",
    "display_name": "Qwen Code",
    "email": "user@example.com",
    "last_check_timestamp": 1234567890.123
  }
}
```

## Expected Console Output (Success Case)

```
OAuth Auth Debug:
  Working Dir: .
  Src Dir: C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src
  Python Path: C:\laragon\bin\python\python-3.13\python.exe
  Existing PYTHONPATH: undefined
  Final PYTHONPATH: C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src
OAuth stdout: Starting authentication for qwen_code...
OAuth stdout: Callback port: 11451
OAuth stdout: Credential file path: C:\DEKSTOP\LLM-API-Key-Proxy-Windows\oauth_creds\qwen_code_oauth_1.json
OAuth stdout: OAUTH_URL:https://chat.qwen.ai/api/v1/oauth2/device/authorize?...
Opening OAuth URL: https://chat.qwen.ai/api/v1/oauth2/device/authorize?...
OAuth stdout: Please authenticate in the browser that just opened...
OAuth stdout: Waiting for authorization... (5s elapsed)
OAuth stdout: Waiting for authorization... (10s elapsed)
OAuth stdout: Waiting for authorization... (15s elapsed)
OAuth stdout: Token received successfully!
OAuth stdout: Authentication successful for qwen_code!
OAuth stdout: AUTHENTICATION_SUCCESS
```

## Still Having Issues?

1. **Check the Python script output directly**: The temporary Python script is in `C:\Users\[username]\AppData\Local\Temp\oauth_qwen_code_*.py`
2. **Review the main.js file**: Ensure lines 310-480 match the fixed version
3. **Check qwen_auth_base.py**: Ensure lines 763-780 include Electron mode detection
4. **Restart the Electron app**: Sometimes a fresh start helps
5. **Clear old credentials**: Delete files in `oauth_creds/` and try again
6. **Check network connectivity**: Ensure you can access https://chat.qwen.ai

## Success Indicators

✅ Browser opens automatically with Qwen authentication page  
✅ Console shows "Opening OAuth URL: ..." message  
✅ Console shows "AUTHENTICATION_SUCCESS" after browser auth  
✅ Credential file appears in `oauth_creds/` directory  
✅ OAuth UI updates to show the new credential  
✅ Credential shows "Active" status with expiry date
