import os
from typing import Optional

from fastapi import Request
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from dotenv import load_dotenv

load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
SESSION_SECRET = os.getenv("SESSION_SECRET")

serializer = URLSafeTimedSerializer(SESSION_SECRET)
COOKIE_NAME = "session_token"


def create_session_token(email: str) -> str:
    """Create a signed token for the session."""
    return serializer.dumps({"email": email})


def verify_session_token(token: str) -> Optional[str]:
    """Verify the signed token and return the email if valid."""
    try:
        # Max age is 24 hours (86400 seconds)
        data = serializer.loads(token, max_age=86400)
        return data.get("email")
    except (SignatureExpired, BadSignature):
        return None


def get_current_user_from_cookie(request: Request) -> Optional[str]:
    """Extract and verify the user session from the request cookies."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return verify_session_token(token)
