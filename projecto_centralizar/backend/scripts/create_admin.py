import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.auth import get_password_hash

ADMIN_EMAIL = "administrador@gmail.com"
ADMIN_PASSWORD = "abc123."

async def create_admin():
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        # 1. Comprobar si ya existe
        result = await session.execute(
            select(User).where(User.email == ADMIN_EMAIL)
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print(f"Admin user ({ADMIN_EMAIL}) already exists")
            return

        # 2. Crear usuario
        user = User(
            email=ADMIN_EMAIL,
            password_hash=get_password_hash(ADMIN_PASSWORD),
            role="admin",
            is_active=True,
        )

        session.add(user)
        try:
            await session.commit()
            print(f"Admin user ({ADMIN_EMAIL}) created successfully")
        except Exception as e:
            await session.rollback()
            print(f"Error creating admin user: {e}")

if __name__ == "__main__":
    asyncio.run(create_admin())
