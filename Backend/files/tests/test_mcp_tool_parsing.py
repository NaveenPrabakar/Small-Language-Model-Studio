from app.services.chat_service import _tool_request_from_text


def test_tool_request_parser_accepts_json_only_payload():
    text = '{"tool_calls":[{"server_id":"abc","tool":"read_file","arguments":{"path":"x"}}]}'
    assert _tool_request_from_text(text) == [
        {"server_id": "abc", "tool": "read_file", "arguments": {"path": "x"}}
    ]


def test_tool_request_parser_rejects_normal_text():
    assert _tool_request_from_text("just answer normally") is None

