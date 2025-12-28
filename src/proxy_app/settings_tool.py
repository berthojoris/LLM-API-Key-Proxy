"""
Settings tool for the LLM API Key Proxy.
Provides interactive configuration for advanced settings.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Callable
from rich.console import Console
from rich.prompt import Prompt, IntPrompt, Confirm
from rich.panel import Panel
from rich.text import Text
from dotenv import load_dotenv, set_key


console = Console()


def clear_screen():
    """Cross-platform terminal clear"""
    import os
    os.system("cls" if os.name == "nt" else "clear")


# Define provider-specific settings
PROVIDER_SETTINGS_MAP: Dict[str, Dict[str, Any]] = {
    "antigravity": {
        "ANTIGRAVITY_PROJECT_ID": {
            "type": "str",
            "prompt": "Enter your Antigravity project ID",
            "default": None,
        },
        "ANTIGRAVITY_API_BASE": {
            "type": "str",
            "prompt": "Enter custom Antigravity API base URL (or press Enter for default)",
            "default": None,
        },
    },
    "gemini_cli": {
        "GEMINI_CLI_PROJECT_ID": {
            "type": "str",
            "prompt": "Enter your Gemini CLI project ID",
            "default": None,
        },
        "GEMINI_CLI_API_BASE": {
            "type": "str",
            "prompt": "Enter custom Gemini CLI API base URL (or press Enter for default)",
            "default": None,
        },
    },
    "qwen_code": {
        "QWEN_CODE_API_BASE": {
            "type": "str",
            "prompt": "Enter custom Qwen Code API base URL (or press Enter for default)",
            "default": "https://portal.qwen.ai/v1",
        },
    },
    # Add other providers as needed
}


def load_env_file() -> Dict[str, str]:
    """Load environment variables from .env file"""
    env_file = Path.cwd() / ".env"
    env_dict = {}
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, _, value = line.partition("=")
                        key, value = key.strip(), value.strip()
                        if value and value[0] in ('"', "'") and value[-1] == value[0]:
                            value = value[1:-1]
                        env_dict[key] = value
        except (IOError, OSError):
            pass
    return env_dict


def save_to_env(key: str, value: str):
    """Save a key-value pair to .env file"""
    env_file = Path.cwd() / ".env"
    set_key(str(env_file), key, str(value))
    load_dotenv(dotenv_path=env_file, override=True)


def get_setting_value(key: str, setting_def: Dict[str, Any]) -> str:
    """Get a setting value via interactive prompt"""
    setting_type = setting_def["type"]
    prompt_text = setting_def["prompt"]
    default = setting_def["default"]
    
    if setting_type == "str":
        if default is not None:
            value = Prompt.ask(prompt_text, default=str(default))
        else:
            value = Prompt.ask(prompt_text)
        return value
    elif setting_type == "int":
        if default is not None:
            value = IntPrompt.ask(prompt_text, default=int(default))
        else:
            value = IntPrompt.ask(prompt_text)
        return str(value)
    elif setting_type == "bool":
        if default is not None:
            value = Confirm.ask(prompt_text, default=bool(default))
        else:
            value = Confirm.ask(prompt_text)
        return "true" if value else "false"
    else:
        raise ValueError(f"Unsupported setting type: {setting_type}")


def configure_provider_settings(provider: str):
    """Configure settings for a specific provider"""
    if provider not in PROVIDER_SETTINGS_MAP:
        console.print(f"[red]Unknown provider: {provider}[/red]")
        return
    
    settings = PROVIDER_SETTINGS_MAP[provider]
    env_values = load_env_file()
    
    console.print(f"\n[bold cyan]Configuring {provider.replace('_', ' ').title()} Settings[/bold cyan]\n")
    
    for key, definition in settings.items():
        current_value = env_values.get(key, definition.get("default"))
        console.print(f"Current {key}: [yellow]{current_value}[/yellow]")
        
        change = Confirm.ask(f"Change {key}?", default=False)
        if change:
            new_value = get_setting_value(key, definition)
            save_to_env(key, new_value)
            console.print(f"[green]✓ {key} updated to: {new_value}[/green]")
        console.print()


def run_settings_tool():
    """Main entry point for the settings tool"""
    clear_screen()
    
    console.print(
        Panel(
            "[bold cyan]🔧 LLM API Key Proxy - Settings Configuration Tool[/bold cyan]",
            border_style="cyan"
        )
    )
    
    console.print("\n[bold]Available Providers:[/bold]")
    for i, provider in enumerate(PROVIDER_SETTINGS_MAP.keys(), 1):
        display_name = provider.replace("_", " ").title()
        console.print(f"  {i}. {display_name}")
    
    console.print(f"  {len(PROVIDER_SETTINGS_MAP) + 1}. Exit")
    
    while True:
        try:
            choice = IntPrompt.ask(
                f"\nSelect provider (1-{len(PROVIDER_SETTINGS_MAP) + 1})",
                choices=[str(i) for i in range(1, len(PROVIDER_SETTINGS_MAP) + 2)]
            )
            
            if choice == len(PROVIDER_SETTINGS_MAP) + 1:
                console.print("\n[green]Settings configuration complete![/green]")
                break
            
            provider = list(PROVIDER_SETTINGS_MAP.keys())[choice - 1]
            configure_provider_settings(provider)
            
            continue_editing = Confirm.ask("\nConfigure another provider?", default=False)
            if not continue_editing:
                console.print("\n[green]Settings configuration complete![/green]")
                break
                
        except KeyboardInterrupt:
            console.print("\n[yellow]Settings configuration cancelled.[/yellow]")
            break
        except Exception as e:
            console.print(f"\n[red]Error: {e}[/red]")


if __name__ == "__main__":
    run_settings_tool()
