from app.services.conversation_service import derive_title
from app.services.model_service import build_model_list


def test_derive_title_uses_user_text():
    assert derive_title("  ") == "New conversation"
    assert derive_title("explain transformers in ml") == "Explain transformers in ml"


def test_build_model_list_orders_fast_models_first():
    raw_models = [
        {"name": "big-model:70b", "details": {"parameter_size": "70B"}},
        {"name": "small-model:1b", "details": {"parameter_size": "1B"}},
    ]

    models = build_model_list(raw_models)

    assert [model.id for model in models] == ["small-model:1b", "big-model:70b"]

