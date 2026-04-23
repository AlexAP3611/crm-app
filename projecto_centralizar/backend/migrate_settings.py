import asyncio
import json
import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.setting import Setting

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

async def migrate_settings():
    async with AsyncSessionLocal() as db:
        logger.info("Starting settings migration...")
        
        # Fetch all external configurations
        stmt = select(Setting).where(Setting.key.like("ext_config_%"))
        result = await db.execute(stmt)
        settings = result.scalars().all()
        
        migrated_count = 0
        
        for setting in settings:
            val = setting.value
            if not isinstance(val, dict):
                logger.warning(f"Setting {setting.key} is not a valid JSON object. Skipping.")
                continue
            
            # If we have apiKey (legacy URL) but no webhook_url (new standard)
            if "apiKey" in val and "webhook_url" not in val:
                legacy_url = val["apiKey"]
                new_val = {
                    "webhook_url": legacy_url,
                    "auth_type": "none",
                    "last_migrated": True,
                    "legacy_apiKey": legacy_url # Keep original for safety
                }
                # Keep other fields like 'tool' if they exist
                for k, v in val.items():
                    if k not in new_val:
                        new_val[k] = v
                
                setting.value = new_val
                logger.info(f"Migrated {setting.key}: {legacy_url} -> webhook_url")
                migrated_count += 1
        
        if migrated_count > 0:
            await db.commit()
            logger.info(f"Migration completed. {migrated_count} settings updated.")
        else:
            logger.info("No settings required migration.")

if __name__ == "__main__":
    asyncio.run(migrate_settings())
