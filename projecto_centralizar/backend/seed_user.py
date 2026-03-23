from sqlalchemy import text
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.auth import get_password_hash

async def seed():
    async with AsyncSessionLocal() as session:
        # Check if user already exists
        result = await session.execute(
            text("SELECT id FROM users WHERE email = 'prueba@gmail.com'")
        )

        if result.scalar_one_or_none():
            print("User already exists.")
            return

        user = User(
            email="prueba@gmail.com",
            password_hash=get_password_hash("abc123")
        )
        session.add(user)
        await session.commit()
        print("Test user created successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
