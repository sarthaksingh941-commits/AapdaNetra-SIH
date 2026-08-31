from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core import security
from app.core.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token

settings = get_settings()
router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
        
    if user_in.role in ["RESPONDER", "ADMIN"]:
        if user_in.admin_code != settings.ADMIN_SECRET_KEY:
            raise HTTPException(
                status_code=403,
                detail="Invalid Admin Authorization Code. Cannot register as Command Center.",
            )
    user = User(
        email=user_in.email,
        name=user_in.name,
        password_hash=security.get_password_hash(user_in.password),
        role=user_in.role,
        phone=user_in.phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not security.verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=400, detail="Incorrect email or password"
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
