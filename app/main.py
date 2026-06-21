import os
from fastapi import FastAPI, Request, Form, Response, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.ai import generate_answer_stream

from app.auth import (
    ADMIN_EMAIL, 
    ADMIN_PASSWORD, 
    create_session_token, 
    get_current_user_from_cookie, 
    COOKIE_NAME
)

app = FastAPI()

# Mount static files (served from the root static/ directory)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount templates (served from the root templates/ directory)
templates = Jinja2Templates(directory="templates")


@app.middleware("http")
async def require_auth(request: Request, call_next):
    """
    Global middleware to redirect unauthenticated traffic to /login.
    Exceptions:
      - Static files (/static)
      - Login endpoint (/login)
      - API docs (/docs, /openapi.json)
    """
    # Allow static assets, login route, and docs
    if (
        request.url.path.startswith("/static") 
        or request.url.path in ["/login", "/docs", "/openapi.json", "/health"]
    ):
        return await call_next(request)
    
    user = get_current_user_from_cookie(request)
    if not user:
        return RedirectResponse(url="/login", status_code=303)
        
    # Store user in state so route handlers can access it
    request.state.user = user
    return await call_next(request)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main application UI."""
    return templates.TemplateResponse(
        request=request, 
        name="index.html", 
        context={"user": request.state.user}
    )


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = None):
    """Serve the login page. (Create a login.html in your templates directory)"""
    return templates.TemplateResponse(
        request=request, 
        name="login.html", 
        context={"error": error}
    )


from fastapi import HTTPException

@app.post("/api/ask")
async def ask_question(question: str = Form(default="")):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Empty question provided.")
        
    # Returns a StreamingResponse that yields tokens as they come in
    return StreamingResponse(
        generate_answer_stream(question), 
        media_type="text/plain"
    )

@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration/monitoring."""
    return {"status": "healthy"}


@app.post("/login")
async def login(
    email: str = Form(...),
    password: str = Form(...)
):
    """Handle login form submissions."""
    if email == ADMIN_EMAIL and password == ADMIN_PASSWORD:
        token = create_session_token(email)
        response = RedirectResponse(url="/", status_code=303)
        # Set HttpOnly cookie
        response.set_cookie(
            key=COOKIE_NAME, 
            value=token, 
            httponly=True, 
            max_age=86400, # 24 hours
            samesite="lax"
        )
        return response
    
    return RedirectResponse(url="/login?error=Invalid credentials", status_code=303)


@app.get("/logout")
async def logout():
    """Handle logout by deleting the session cookie."""
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie(COOKIE_NAME)
    return response