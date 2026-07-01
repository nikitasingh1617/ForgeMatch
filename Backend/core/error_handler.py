"""
Centralized error handling for ForgeMatch API
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# ─── Custom Exception Classes ──────────────────────────────────────

class ForgeMatchError(Exception):
    """Base exception for all ForgeMatch errors"""
    def __init__(
        self, 
        message: str, 
        error_code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        self.timestamp = datetime.utcnow().isoformat()
        super().__init__(message)

class ValidationError(ForgeMatchError):
    """Validation errors (400)"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )

class FileProcessingError(ForgeMatchError):
    """File processing errors (400)"""
    def __init__(self, message: str, filename: Optional[str] = None):
        details = {"filename": filename} if filename else {}
        super().__init__(
            message=message,
            error_code="FILE_PROCESSING_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )

class RankingError(ForgeMatchError):
    """Ranking engine errors (500)"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="RANKING_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details
        )

class ResourceNotFoundError(ForgeMatchError):
    """Resource not found errors (404)"""
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"{resource} with ID '{resource_id}' not found",
            error_code="RESOURCE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource": resource, "resource_id": resource_id}
        )

class RateLimitError(ForgeMatchError):
    """Rate limit errors (429)"""
    def __init__(self, message: str = "Too many requests. Please try again later."):
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )

class AIProviderError(ForgeMatchError):
    """AI service provider errors (503)"""
    def __init__(self, message: str, provider: str = "OpenRouter"):
        super().__init__(
            message=f"AI service ({provider}) unavailable: {message}",
            error_code="AI_SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"provider": provider}
        )

# ─── Error Response Formatter ─────────────────────────────────────

def format_error_response(
    error: Exception,
    include_traceback: bool = False
) -> Dict[str, Any]:
    """
    Format error as consistent JSON response
    """
    if isinstance(error, ForgeMatchError):
        response = {
            "success": False,
            "error": {
                "code": error.error_code,
                "message": error.message,
                "status_code": error.status_code,
                "timestamp": error.timestamp,
            }
        }
        if error.details:
            response["error"]["details"] = error.details
    else:
        # Unknown error
        response = {
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }
    
    # Include traceback in development
    if include_traceback:
        response["error"]["traceback"] = traceback.format_exc()
    
    return response

# ─── Global Exception Handlers ────────────────────────────────────

def setup_error_handlers(app: FastAPI, debug: bool = False):
    """
    Register global exception handlers for the FastAPI app
    """
    
    @app.exception_handler(ForgeMatchError)
    async def forge_match_error_handler(request: Request, exc: ForgeMatchError):
        logger.error(
            f"ForgeMatchError: {exc.error_code} - {exc.message}",
            extra={"error_code": exc.error_code, "details": exc.details}
        )
        response = format_error_response(exc, include_traceback=debug)
        return JSONResponse(
            status_code=exc.status_code,
            content=response
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.warning(f"HTTP {exc.status_code}: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": "HTTP_ERROR",
                    "message": str(exc.detail),
                    "status_code": exc.status_code,
                }
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request data",
                    "details": exc.errors(),
                    "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                }
            }
        )
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled exception: {str(exc)}\n{traceback.format_exc()}"
        )
        response = format_error_response(exc, include_traceback=debug)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response
        )

# ─── Context Manager for Error Logging ───────────────────────────

class ErrorContext:
    """Context manager for capturing error context"""
    
    def __init__(self, operation: str, **kwargs):
        self.operation = operation
        self.context = kwargs
    
    def __enter__(self):
        logger.info(f"Starting: {self.operation}", extra=self.context)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_val:
            logger.error(
                f"Failed: {self.operation} - {str(exc_val)}",
                extra={**self.context, "error": str(exc_val)}
            )
        else:
            logger.info(f"Completed: {self.operation}")
        return False  # Don't suppress exceptions

# ─── Retry Decorator ──────────────────────────────────────────────

def retry_on_error(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """
    Decorator for retrying functions on failure
    """
    import time
    from functools import wraps
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__}: {str(e)}"
                        )
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.error(
                            f"All {max_retries} retries failed for {func.__name__}: {str(e)}"
                        )
            
            raise last_exception
        return wrapper
    return decorator

async def retry_async(
    func,
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """
    Async retry function
    """
    import asyncio
    
    last_exception = None
    current_delay = delay
    
    for attempt in range(max_retries):
        try:
            return await func()
        except exceptions as e:
            last_exception = e
            if attempt < max_retries - 1:
                logger.warning(f"Retry {attempt + 1}/{max_retries}: {str(e)}")
                await asyncio.sleep(current_delay)
                current_delay *= backoff
            else:
                logger.error(f"All {max_retries} retries failed: {str(e)}")
    
    raise last_exception