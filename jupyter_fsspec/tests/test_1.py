import httpx
import pytest


@pytest.mark.asyncio
async def test_simple(server_app):
    async for u in server_app:
        url = u
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
    print(r)
