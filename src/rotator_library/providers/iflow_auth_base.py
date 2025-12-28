# src/rotator_library/providers/iflow_auth_base.py

import json
import time
import asyncio
import logging
import os
from pathlib import Path
from typing import Dict, Any, Tuple, Union, Optional
import httpx


lib_logger = logging.getLogger("rotator_library")


class IFlowAuthBase:
    def __init__(self):
        pass

    async def initialize_token(self, creds_or_path: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """
        Initialize OAuth token for iFlow provider.
        """
        lib_logger.info("Initializing iFlow OAuth token")
        if isinstance(creds_or_path, str):
            # Load from file if path provided
            with open(creds_or_path, 'r') as f:
                creds = json.load(f)
        else:
            creds = creds_or_path
        
        return creds

    async def get_api_details(self, credential_identifier: str) -> Tuple[str, str]:
        """
        Returns the API base URL and access token for iFlow.
        """
        # Implementation would go here
        if os.path.isfile(credential_identifier):
            lib_logger.debug(f"Using OAuth credentials from file: {credential_identifier}")
            base_url = "https://api.kilocode.ai/v1"
            # Load and return access token from file
            with open(credential_identifier, 'r') as f:
                creds = json.load(f)
            access_token = creds.get("access_token", "")
        else:
            base_url = "https://api.kilocode.ai/v1"
            access_token = credential_identifier
            
        return base_url, access_token

    async def get_user_info(self, creds_or_path: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """
        Retrieves user info for the iFlow provider.
        """
        if isinstance(creds_or_path, str):
            with open(creds_or_path, 'r') as f:
                creds = json.load(f)
        else:
            creds = creds_or_path
            
        email = creds.get("_proxy_metadata", {}).get("email") or creds.get("email")
        return {"email": email}
