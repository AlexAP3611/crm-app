import logging
import httpx
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

class WebhookClient:
    def __init__(self, timeout: int = 30, max_retries: int = 3):
        self.timeout = timeout
        self.max_retries = max_retries

    async def send_payload(self, url: str, payload: dict[str, Any], tool_key: str) -> httpx.Response:
        """
        Sends a POST payload to a webhook URL with retry logic for transient 5xx errors.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            attempt = 0
            last_response = None

            while attempt < self.max_retries:
                try:
                    logger.info(f"Webhook [{tool_key}]: Sending request to {url} (Attempt {attempt + 1}/{self.max_retries})")
                    response = await client.post(url, json=payload)
                    last_response = response

                    if response.is_success:
                        logger.info(f"Webhook [{tool_key}]: Success! Status: {response.status_code}")
                        return response

                    # Retry only on 5xx (Server Error)
                    if response.is_server_error:
                        logger.warning(f"Webhook [{tool_key}]: Server error {response.status_code}. Retrying...")
                        attempt += 1
                        if attempt < self.max_retries:
                            await asyncio.sleep(2 ** attempt) # Exponential backoff
                            continue
                    
                    # For 4xx or redirected, we stop and let the service handle it
                    logger.error(f"Webhook [{tool_key}]: Failed with status {response.status_code}")
                    return response

                except (httpx.ConnectError, httpx.TimeoutException) as exc:
                    logger.error(f"Webhook [{tool_key}]: Connection/Timeout error: {type(exc).__name__}")
                    attempt += 1
                    if attempt < self.max_retries:
                        await asyncio.sleep(2 ** attempt)
                    else:
                        raise exc
            
            return last_response

webhook_client = WebhookClient()
