import asyncio
import sys
import os
import json
from pathlib import Path

# CRITICAL: Disable automatic browser opening in Python
# The Electron app will handle opening the browser
os.environ['ELECTRON_OAUTH_MODE'] = '1'

# Add the src directory to the Python path to ensure imports work
sys.path.insert(0, r"C:\DEKSTOP\LLM-API-Key-Proxy-Windows\src")

print("=== Testing OAuth Import ===", flush=True)

try:
    print("Importing provider_factory...", flush=True)
    from rotator_library.provider_factory import get_provider_auth_class
    print("✓ Import successful", flush=True)
    
    print("\nImporting required modules...", flush=True)
    import httpx
    import secrets
    import hashlib
    import base64
    import time
    print("✓ All modules imported", flush=True)
    
    print("\n=== Testing Qwen Auth Class ===", flush=True)
    auth_class = get_provider_auth_class("qwen_code")
    print(f"✓ Got auth class: {auth_class}", flush=True)
    
    auth_instance = auth_class()
    print(f"✓ Created auth instance: {auth_instance}", flush=True)
    
    print("\n=== Testing OAuth Device Flow ===", flush=True)
    
    async def test_oauth():
        # Generate code verifier and challenge for PKCE
        code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8").rstrip("=")
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode("utf-8")).digest()
        ).decode("utf-8").rstrip("=")
        
        CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
        SCOPE = "openid profile email model.completion"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        }
        
        print("Requesting device code...", flush=True)
        async with httpx.AsyncClient() as client:
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
            
            print(f"✓ Device code received", flush=True)
            print(f"✓ Verification URL: {dev_data['verification_uri_complete']}", flush=True)
            print(f"\nOAUTH_URL:{dev_data['verification_uri_complete']}", flush=True)
            
            print("\n=== Test Complete ===", flush=True)
            print("This is where the browser would open and polling would start.", flush=True)
            print("AUTHENTICATION_TEST_SUCCESS", flush=True)
    
    asyncio.run(test_oauth())
    
except ImportError as e:
    print(f"❌ Import error: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
