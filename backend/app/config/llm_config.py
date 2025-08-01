# Simplified LLM Configuration
"""
Configuration settings for LLM providers.
Supports OpenAI and JPMC LLM services only.
"""

import os
from typing import Dict, Any


class LLMConfig:
    """Configuration class for LLM providers"""
    
    # Default provider settings
    DEFAULT_PROVIDER = "openai"
    DEFAULT_MODELS = {
        "openai": "gpt-4",
        "jpmcllm": "jpmc-llm-v1",
    }
    
    @classmethod
    def get_provider(cls) -> str:
        """Get the configured LLM provider"""
        return os.getenv('LLM_PROVIDER', cls.DEFAULT_PROVIDER).lower()
    
    @classmethod
    def get_model(cls, provider: str = None) -> str:
        """Get the configured model for a provider"""
        provider = provider or cls.get_provider()
        
        # Check for provider-specific model override
        model_env_var = f'{provider.upper()}_MODEL'
        if os.getenv(model_env_var):
            return os.getenv(model_env_var)
        
        # Check for general model override
        if os.getenv('LLM_MODEL'):
            return os.getenv('LLM_MODEL')
        
        # Fall back to default
        return cls.DEFAULT_MODELS.get(provider, cls.DEFAULT_MODELS[cls.DEFAULT_PROVIDER])
    
    @classmethod
    def get_provider_config(cls, provider: str = None) -> Dict[str, Any]:
        """Get full configuration for a provider"""
        provider = provider or cls.get_provider()
        
        config = {
            "provider": provider,
            "model": cls.get_model(provider),
        }
        
        # Add provider-specific settings
        if provider == "openai":
            config.update({
                "api_key": os.getenv('OPENAI_API_KEY'),
                "temperature": float(os.getenv('OPENAI_TEMPERATURE', '0.3')),
                "max_tokens": int(os.getenv('OPENAI_MAX_TOKENS', '2000')),
            })
        elif provider == "jpmcllm":
            config.update({
                "api_url": os.getenv('JPMC_LLM_URL', 'http://localhost:8080'),
                "temperature": float(os.getenv('JPMC_LLM_TEMPERATURE', '0.3')),
                "max_tokens": int(os.getenv('JPMC_LLM_MAX_TOKENS', '2000')),
                "timeout": int(os.getenv('JPMC_LLM_TIMEOUT', '30')),
            })
        
        return config
    
    @classmethod
    def is_provider_configured(cls, provider: str) -> bool:
        """Check if a provider is properly configured"""
        config = cls.get_provider_config(provider)
        
        if provider == "openai":
            return bool(config.get("api_key"))
        elif provider == "jpmcllm":
            return bool(config.get("api_url"))
        
        return False
    
    @classmethod
    def get_available_providers(cls) -> list:
        """Get list of configured providers"""
        available = []
        for provider in cls.DEFAULT_MODELS.keys():
            if cls.is_provider_configured(provider):
                available.append(provider)
        return available


# Environment variable configurations:
"""
# To use OpenAI (default):
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4  # Optional, defaults to gpt-4
OPENAI_TEMPERATURE=0.3  # Optional
OPENAI_MAX_TOKENS=2000  # Optional

# To use JPMC LLM (internal service, no API key needed):
LLM_PROVIDER=jpmcllm
JPMC_LLM_URL=http://localhost:8080  # Internal JPMC LLM service endpoint
# JPMC LLM uses simplified JSON format:
# Request: {"Message": "combined_message_string"}
# Response: {"Message": "ai_response", ...other_details}
JPMC_LLM_MODEL=jpmc-llm-v1  # Optional, defaults to jpmc-llm-v1
JPMC_LLM_TEMPERATURE=0.3  # Optional
JPMC_LLM_MAX_TOKENS=2000  # Optional
JPMC_LLM_TIMEOUT=30  # Optional, request timeout in seconds

# General settings (applies to current provider):
LLM_MODEL=custom-model  # Override model for any provider
"""