import logging
import pytest
from unittest.mock import AsyncMock, patch

from app.services import chat_service, mcp_service


class FakeServer:
    def __init__(self, name, url):
        self.name = name
        self.url = url
        self.id = "fake-id"


@pytest.mark.asyncio
async def test_discover_tools_logs_on_failure(caplog):
    server = FakeServer("BrokenServer", "http://unreachable.invalid/mcp")

    with patch.object(
        mcp_service, "list_server_tools", AsyncMock(side_effect=ConnectionError("refused"))
    ):
        with caplog.at_level(logging.WARNING, logger="app.services.chat_service"):
            result = await chat_service._discover_tools([server])

    assert result == []
    assert any(
        "MCP tool discovery failed for server 'BrokenServer'" in record.message
        for record in caplog.records
    )