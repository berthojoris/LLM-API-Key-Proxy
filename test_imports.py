import sys
import os

# Add the src directory to Python path to test imports
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, 'src')
sys.path.insert(0, src_dir)

print("Testing imports...")

try:
    from rotator_library.provider_factory import get_provider_auth_class
    print("+ Successfully imported provider_factory")
    
    # Test Qwen provider specifically
    auth_class = get_provider_auth_class("qwen_code")
    print(f"+ Successfully got QwenAuthBase class: {auth_class}")
    
    # Try to instantiate
    qwen_auth = auth_class()
    print(f"+ Successfully instantiated QwenAuthBase: {qwen_auth}")
    
    print("All imports successful!")
    
except ImportError as e:
    print(f"- Import error: {e}")
    import traceback
    traceback.print_exc()
except Exception as e:
    print(f"- Other error: {e}")
    import traceback
    traceback.print_exc()
