from passlib.context import CryptContext

# 1. Update the schemes list to include "argon2" as the first (default) choice.
#    This makes argon2 the default for new hashes.
# 2. We keep "bcrypt" in the list so that if you ever have old passwords
#    hashed with bcrypt, they can still be verified.
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain-text password."""
    return pwd_context.hash(password)

