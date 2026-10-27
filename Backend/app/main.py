
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import JSONResponse

from app.core.config import settings

from app.api.v1.router import api_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("=" * 60)
    logger.info(
        "%s v%s started",
        settings.PROJECT_NAME,
        settings.VERSION,
    )
    logger.info(
        "API Documentation: http://127.0.0.1:8000/docs"
    )
    logger.info("=" * 60)

    yield

    logger.info("=" * 60)
    logger.info(
        "%s application stopped",
        settings.PROJECT_NAME,
    )
    logger.info("=" * 60)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "A collaborative multi-tenant platform for "
        "organization management, event management, "
        "resource booking, and role-based access control."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
):
    code = getattr(exc, "code", None)
    if not code:
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            500: "INTERNAL_SERVER_ERROR",
        }
        code = code_map.get(exc.status_code, "API_ERROR")

    detail_msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "detail": detail_msg,
            "message": detail_msg,
            "error": {
                "code": code,
                "message": detail_msg,
            },
        },
        headers=exc.headers,
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    errors = exc.errors()
    safe_errors = []

    for error in errors:
        safe_errors.append(
            {
                "type": error.get("type"),
                "loc": error.get("loc"),
                "msg": error.get("msg"),
            }
        )

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "detail": "Request validation failed",
            "message": "Request validation failed",
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "errors": safe_errors,
            },
            "errors": safe_errors,
        },
    )

@app.get(
    "/health",
    tags=["Health"],
)
def health_check():
    return {
        "status": "healthy",
        "application": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }

@app.get(
    "/",
    tags=["Root"],
)
def root():
    return {
        "message": (
            "Welcome to the Collaborative Event "
            "and Resource Booking Platform API"
        ),
        "version": settings.VERSION,
        "documentation": "/docs",
        "docs": "/docs",
        "health_check": "/health",
        "health": "/health",
        "api_prefix": settings.API_V1_PREFIX,
    }

app.include_router(
    api_router,
    prefix=settings.API_V1_PREFIX,
)
app.include_router(
    api_router,
    prefix="/api",
)

logger.info(
    "FastAPI application initialized successfully"
)
