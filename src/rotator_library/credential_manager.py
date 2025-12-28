"""
Credential Manager for the Rotating Client.

Handles discovery and preparation of API keys and OAuth credentials.
"""

import os
import json
from pathlib import Path
from typing import Dict, List


class CredentialManager:
    """
    Manages discovery and preparation of API keys and OAuth credentials.
    """
    
    def __init__(self, environment: Dict[str, str]):
        self.environment = environment
        self.base_dir = Path.cwd()
        self.oauth_base_dir = self.base_dir / "oauth_creds"
        
    def discover_and_prepare(self) -> Dict[str, List[str]]:
        """
        Discover all available credentials (API keys and OAuth files).
        
        Returns:
            Dictionary mapping provider names to lists of credential paths/files
        """
        credentials = {}
        
        # Discover API keys from environment variables
        api_credentials = self._discover_api_keys()
        for provider, keys in api_credentials.items():
            if provider not in credentials:
                credentials[provider] = []
            credentials[provider].extend(keys)
        
        # Discover OAuth credentials from files
        oauth_credentials = self._discover_oauth_credentials()
        for provider, files in oauth_credentials.items():
            if provider not in credentials:
                credentials[provider] = []
            credentials[provider].extend(files)
            
        return credentials
        
    def _discover_api_keys(self) -> Dict[str, List[str]]:
        """
        Discover API keys from environment variables.
        
        Returns:
            Dictionary mapping provider names to lists of credential identifiers
        """
        credentials = {}
        
        for key, value in self.environment.items():
            if "_API_KEY" in key and key != "PROXY_API_KEY":
                # Extract provider name from env var (e.g., GEMINI_API_KEY -> gemini)
                provider = key.replace("_API_KEY", "").lower()
                
                if provider not in credentials:
                    credentials[provider] = []
                
                # For API keys, we store the env var key as the identifier
                # The actual value will be retrieved from the environment when needed
                credentials[provider].append(f"env://{key}")
                
        return credentials
    
    def _discover_oauth_credentials(self) -> Dict[str, List[str]]:
        """
        Discover OAuth credentials from JSON files in the oauth_creds directory.
        
        Returns:
            Dictionary mapping provider names to lists of file paths
        """
        credentials = {}
        
        if not self.oauth_base_dir.exists():
            return credentials
            
        # Find all OAuth credential files
        for file_path in self.oauth_base_dir.glob("*_oauth_*.json"):
            # Extract provider name from filename (e.g., gemini_cli_oauth_1.json -> gemini_cli)
            provider = file_path.name.split("_oauth_")[0]
            
            if provider not in credentials:
                credentials[provider] = []
                
            credentials[provider].append(str(file_path))
            
        return credentials
