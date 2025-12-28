"""Provider URL mappings for the LLM API Key Proxy"""

# Standard provider URL mapping
PROVIDER_URL_MAP = {
    # OpenAI
    "openai": "https://api.openai.com/v1",
    
    # Anthropic
    "anthropic": "https://api.anthropic.com/v1",
    
    # Google (Gemini)
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "gemini_cli": "https://generativelanguage.googleapis.com/v1beta",
    "antigravity": "https://generativelanguage.googleapis.com/v1beta",
    
    # Mistral AI
    "mistral": "https://api.mistral.ai/v1",
    
    # Cohere
    "cohere": "https://api.cohere.ai/v1",
    
    # OpenRouter
    "openrouter": "https://openrouter.ai/api/v1",
    
    # Together AI
    "together": "https://api.together.xyz/v1",
    
    # Fireworks AI
    "fireworks": "https://api.fireworks.ai/inference/v1",
    
    # Perplexity
    "perplexity": "https://api.perplexity.ai/chat/completions",
    
    # Groq
    "groq": "https://api.groq.com/openai/v1",
    
    # DeepInfra
    "deepinfra": "https://api.deepinfra.com/v1/openai",
    
    # Novita AI
    "novita": "https://api.novita.ai/v3/openai",
    
    # Ai21
    "ai21": "https://api.ai21.com/studio/v1",
    
    # Azure OpenAI (placeholder - requires specific deployment setup)
    "azure": None,
    
    # Qwen
    "qwen_code": "https://portal.qwen.ai/v1",
    
    # Custom providers would go here as well
    # They are typically defined in environment variables
}

# Reverse mapping for easy lookup
URL_PROVIDER_MAP = {v: k for k, v in PROVIDER_URL_MAP.items() if v is not None}
