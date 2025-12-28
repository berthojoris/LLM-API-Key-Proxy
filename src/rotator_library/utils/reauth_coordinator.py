# src/rotator_library/utils/reauth_coordinator.py

import asyncio
import logging
from typing import Callable, Any, Dict
from pathlib import Path

lib_logger = logging.getLogger("rotator_library")


class ReauthCoordinator:
    """
    Coordinates re-authentication flows to ensure only one interactive OAuth flow
    runs at a time across all providers. This prevents multiple browser windows
    or console prompts from appearing simultaneously.
    """
    
    def __init__(self):
        self._active_reauth_lock = asyncio.Lock()
        self._active_reauth_tasks: Dict[str, asyncio.Task] = {}
        
    async def execute_reauth(
        self, 
        credential_path: str, 
        provider_name: str, 
        reauth_func: Callable[[], Any],
        timeout: float = 300.0  # 5 minute default timeout
    ) -> Any:
        """
        Execute a re-authentication function with coordination to ensure only one
        interactive flow runs at a time.
        
        Args:
            credential_path: Path to the credential file (for identification)
            provider_name: Name of the provider (for logging)
            reauth_func: Async function to execute for re-authentication
            timeout: Timeout in seconds for the re-authentication process
            
        Returns:
            Result of the re-authentication function
        """
        # Create a unique identifier for this re-auth request
        credential_id = str(Path(credential_path).name) if credential_path else "unknown"
        reauth_id = f"{provider_name}:{credential_id}"
        
        lib_logger.info(f"Attempting to start re-authentication for {reauth_id}")
        
        # Wait for any active re-auth to complete before starting this one
        async with self._active_reauth_lock:
            lib_logger.info(f"Re-auth lock acquired for {reauth_id}")
            
            # Check if there's already an active task for this credential
            if reauth_id in self._active_reauth_tasks:
                active_task = self._active_reauth_tasks[reauth_id]
                if not active_task.done():
                    lib_logger.info(f"Re-auth already in progress for {reauth_id}, waiting...")
                    try:
                        # Wait for the existing task to complete
                        result = await asyncio.wait_for(active_task, timeout=timeout)
                        return result
                    except asyncio.TimeoutError:
                        lib_logger.warning(f"Existing re-auth task timed out for {reauth_id}")
                        # Cancel the existing task and continue with new one
                        active_task.cancel()
                        try:
                            await active_task
                        except asyncio.CancelledError:
                            pass
            
            # Create a new task for this re-auth
            task = asyncio.create_task(self._execute_single_reauth(reauth_func, timeout))
            self._active_reauth_tasks[reauth_id] = task
            
            try:
                result = await asyncio.wait_for(task, timeout=timeout)
                lib_logger.info(f"Re-authentication completed successfully for {reauth_id}")
                return result
            except asyncio.TimeoutError:
                lib_logger.error(f"Re-authentication timed out for {reauth_id}")
                raise
            except Exception as e:
                lib_logger.error(f"Re-authentication failed for {reauth_id}: {e}")
                raise
            finally:
                # Clean up the task reference
                self._active_reauth_tasks.pop(reauth_id, None)
    
    async def _execute_single_reauth(self, reauth_func: Callable[[], Any], timeout: float):
        """Execute a single re-authentication function with timeout."""
        try:
            result = await asyncio.wait_for(reauth_func(), timeout=timeout)
            return result
        except asyncio.TimeoutError:
            raise
        except Exception as e:
            raise e


# Global singleton instance
_coordinator = ReauthCoordinator()


def get_reauth_coordinator() -> ReauthCoordinator:
    """
    Get the global re-authentication coordinator instance.
    
    Returns:
        ReauthCoordinator instance
    """
    return _coordinator
