# LLM Configuration
"""
Configuration settings for LLM providers.
This file makes it easy to switch between different LLM providers and models.
"""

import os
from typing import Dict, Any


class LLMConfig:
    """Configuration class for LLM providers"""
    
    # Default provider settings
    DEFAULT_PROVIDER = "openai"
    DEFAULT_MODELS = {
        "openai": "gpt-4",
        "anthropic": "claude-3-sonnet-20240229", 
        "gemini": "gemini-pro",
        # Add more providers and their default models here
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
        elif provider == "anthropic":
            config.update({
                "api_key": os.getenv('ANTHROPIC_API_KEY'),
                "temperature": float(os.getenv('ANTHROPIC_TEMPERATURE', '0.3')),
                "max_tokens": int(os.getenv('ANTHROPIC_MAX_TOKENS', '2000')),
            })
        elif provider == "gemini":
            config.update({
                "api_key": os.getenv('GOOGLE_API_KEY'),
                "temperature": float(os.getenv('GEMINI_TEMPERATURE', '0.3')),
                "max_tokens": int(os.getenv('GEMINI_MAX_TOKENS', '2000')),
            })
        
        return config
    
    @classmethod
    def is_provider_configured(cls, provider: str) -> bool:
        """Check if a provider is properly configured"""
        config = cls.get_provider_config(provider)
        
        if provider == "openai":
            return bool(config.get("api_key"))
        elif provider == "anthropic":
            return bool(config.get("api_key"))
        elif provider == "gemini":
            return bool(config.get("api_key"))
        
        return False
    
    @classmethod
    def get_available_providers(cls) -> list:
        """Get list of configured providers"""
        available = []
        for provider in cls.DEFAULT_MODELS.keys():
            if cls.is_provider_configured(provider):
                available.append(provider)
        return available


# Example environment variable configurations:
"""
# To use OpenAI (default):
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4  # Optional, defaults to gpt-4

# To use Anthropic:
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229  # Optional

# General settings (applies to current provider):
LLM_MODEL=gpt-3.5-turbo  # Override model for any provider
"""