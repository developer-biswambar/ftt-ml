# LLM Service - Pluggable architecture for different LLM providers
"""
Pluggable LLM service architecture that supports multiple providers.
Currently supports OpenAI, but can be extended to support other providers.
"""

import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    """Standardized message format for LLM interactions"""
    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMResponse:
    """Standardized response format from LLM providers"""
    content: str
    provider: str
    model: str
    success: bool
    error: Optional[str] = None


class LLMServiceInterface(ABC):
    """Abstract base class for LLM service providers"""
    
    @abstractmethod
    def generate_text(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.3,
        max_tokens: int = 2000,
        **kwargs
    ) -> LLMResponse:
        """Generate text response from the LLM provider"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM provider is available and configured"""
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the name of the LLM provider"""
        pass
    
    @abstractmethod
    def get_model_name(self) -> str:
        """Get the current model name being used"""
        pass


class OpenAILLMService(LLMServiceInterface):
    """OpenAI implementation of the LLM service"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        self.model = model
        self._client = None
        
        if self.api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
                logger.info(f"OpenAI LLM service initialized with model: {self.model}")
            except ImportError:
                logger.error("OpenAI package not installed. Install with: pip install openai")
                self._client = None
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
                self._client = None
    
    def generate_text(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.3,
        max_tokens: int = 2000,
        **kwargs
    ) -> LLMResponse:
        """Generate text using OpenAI API"""
        if not self.is_available():
            return LLMResponse(
                content="",
                provider="openai",
                model=self.model,
                success=False,
                error="OpenAI service not available"
            )
        
        try:
            # Convert our message format to OpenAI format
            openai_messages = [
                {"role": msg.role, "content": msg.content} 
                for msg in messages
            ]
            
            response = self._client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            content = response.choices[0].message.content.strip()
            
            return LLMResponse(
                content=content,
                provider="openai",
                model=self.model,
                success=True
            )
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return LLMResponse(
                content="",
                provider="openai",
                model=self.model,
                success=False,
                error=str(e)
            )
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        return self._client is not None and self.api_key is not None
    
    def get_provider_name(self) -> str:
        return "openai"
    
    def get_model_name(self) -> str:
        return self.model


class AnthropicLLMService(LLMServiceInterface):
    """Anthropic Claude implementation of the LLM service (example for future use)"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-sonnet-20240229"):
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        self.model = model
        self._client = None
        
        if self.api_key:
            try:
                # Import would be: from anthropic import Anthropic
                # self._client = Anthropic(api_key=self.api_key)
                logger.info(f"Anthropic LLM service would be initialized with model: {self.model}")
            except ImportError:
                logger.error("Anthropic package not installed")
                self._client = None
    
    def generate_text(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.3,
        max_tokens: int = 2000,
        **kwargs
    ) -> LLMResponse:
        """Generate text using Anthropic API"""
        # This is a placeholder implementation
        return LLMResponse(
            content="",
            provider="anthropic",
            model=self.model,
            success=False,
            error="Anthropic service not implemented yet"
        )
    
    def is_available(self) -> bool:
        return False  # Not implemented yet
    
    def get_provider_name(self) -> str:
        return "anthropic"
    
    def get_model_name(self) -> str:
        return self.model


class GeminiLLMService(LLMServiceInterface):
    """Google Gemini implementation of the LLM service (example for future use)"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-pro"):
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        self.model = model
        self._client = None
        
        if self.api_key:
            try:
                # Import would be: import google.generativeai as genai
                # genai.configure(api_key=self.api_key)
                # self._client = genai.GenerativeModel(self.model)
                logger.info(f"Gemini LLM service would be initialized with model: {self.model}")
            except ImportError:
                logger.error("Google GenerativeAI package not installed")
                self._client = None
    
    def generate_text(
        self, 
        messages: List[LLMMessage], 
        temperature: float = 0.3,
        max_tokens: int = 2000,
        **kwargs
    ) -> LLMResponse:
        """Generate text using Google Gemini API"""
        # This is a placeholder implementation
        return LLMResponse(
            content="",
            provider="gemini",
            model=self.model,
            success=False,
            error="Gemini service not implemented yet"
        )
    
    def is_available(self) -> bool:
        return False  # Not implemented yet
    
    def get_provider_name(self) -> str:
        return "gemini"
    
    def get_model_name(self) -> str:
        return self.model


class LLMServiceFactory:
    """Factory class to create and manage LLM service instances"""
    
    _providers = {
        "openai": OpenAILLMService,
        "anthropic": AnthropicLLMService,
        "gemini": GeminiLLMService,
        # Add more providers here as they're implemented
    }
    
    @classmethod
    def create_service(
        self, 
        provider: str = "openai", 
        **kwargs
    ) -> LLMServiceInterface:
        """Create an LLM service instance for the specified provider"""
        
        provider = provider.lower()
        
        if provider not in self._providers:
            available_providers = ", ".join(self._providers.keys())
            raise ValueError(f"Unknown LLM provider: {provider}. Available: {available_providers}")
        
        service_class = self._providers[provider]
        
        # Filter kwargs to only pass constructor arguments
        # Remove generation parameters that should go to generate_text()
        constructor_kwargs = {k: v for k, v in kwargs.items() 
                            if k in ['api_key', 'model']}
        
        service = service_class(**constructor_kwargs)
        
        if not service.is_available():
            logger.warning(f"LLM provider '{provider}' is not available. Check configuration.")
        
        return service
    
    @classmethod
    def get_available_providers(cls) -> List[str]:
        """Get list of all available provider names"""
        return list(cls._providers.keys())
    
    @classmethod
    def get_default_service(cls) -> LLMServiceInterface:
        """Get the default LLM service (tries providers in order of preference)"""
        
        # Try providers in order of preference
        preferred_order = ["openai", "anthropic"]
        
        for provider in preferred_order:
            try:
                service = cls.create_service(provider)
                if service.is_available():
                    logger.info(f"Using LLM provider: {provider}")
                    return service
            except Exception as e:
                logger.warning(f"Failed to initialize {provider}: {e}")
                continue
        
        # If no providers are available, return a dummy service that will fail gracefully
        logger.error("No LLM providers are available")
        return cls.create_service("openai")  # Will return unavailable service


# Global service instance - can be configured at startup
_llm_service: Optional[LLMServiceInterface] = None


def get_llm_service() -> LLMServiceInterface:
    """Get the configured LLM service instance"""
    global _llm_service
    
    if _llm_service is None:
        # Import config here to avoid circular imports
        try:
            from app.config.llm_config import LLMConfig
            config = LLMConfig.get_provider_config()
            
            logger.info(f"Initializing LLM service: {config['provider']} with model {config['model']}")
            _llm_service = LLMServiceFactory.create_service(
                provider=config.get('provider'),
                api_key=config.get('api_key'),
                model=config.get('model')
            )
        except Exception as e:
            logger.error(f"Failed to load LLM config: {e}")
            # Fallback to basic OpenAI configuration
            _llm_service = LLMServiceFactory.create_service(provider="openai")
    
    return _llm_service


def set_llm_service(service: LLMServiceInterface):
    """Set a specific LLM service instance (useful for testing or custom configurations)"""
    global _llm_service
    _llm_service = service
    logger.info(f"LLM service set to: {service.get_provider_name()} ({service.get_model_name()})")


def get_llm_generation_params() -> dict:
    """Get the LLM generation parameters from config"""
    try:
        from app.config.llm_config import LLMConfig
        config = LLMConfig.get_provider_config()
        
        # Return only generation parameters
        return {
            'temperature': config.get('temperature', 0.3),
            'max_tokens': config.get('max_tokens', 2000)
        }
    except Exception:
        # Fallback defaults
        return {
            'temperature': 0.3,
            'max_tokens': 2000
        }


def reset_llm_service():
    """Reset the LLM service (will be re-initialized on next get_llm_service() call)"""
    global _llm_service
    _llm_service = None