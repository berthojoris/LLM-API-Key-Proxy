# src/rotator_library/utils/headless_detection.py

import os
import sys


def is_headless_environment() -> bool:
    """
    Detects if running in a headless environment where GUI operations are not possible.
    
    Returns:
        True if in headless environment, False otherwise
    """
    # Check if running in CI/CD environment
    if os.getenv("CI") or os.getenv("CONTINUOUS_INTEGRATION"):
        return True
    
    # Check for common headless indicators
    if os.getenv("HEADLESS") or os.getenv("PHANTOMJS") or os.getenv("NO_GUI"):
        return True
    
    # On Unix-like systems, check if DISPLAY is set
    if hasattr(os, 'uname'):
        if os.getenv("DISPLAY") is None and sys.platform != "win32":
            return True
    
    # Check for specific Python environments
    if os.getenv("PYTHONIOENCODING") == "utf-8" and os.getenv("TERM") == "dumb":
        return True
    
    # For Windows, we assume GUI is available unless specifically in headless mode
    # This is a conservative check that can be extended based on specific needs
    if sys.platform == "win32":
        # Check if running in Windows service context (simplified)
        if os.getenv("SESSIONNAME", "").startswith("Services"):
            return True
    
    return False
