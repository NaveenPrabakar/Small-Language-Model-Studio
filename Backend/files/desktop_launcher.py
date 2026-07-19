import threading
import time
import webview
import uvicorn

from app.main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

if __name__ == "__main__":
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(1.0)  # give uvicorn a moment to bind

    webview.create_window(
        "SLM Studio",
        "http://127.0.0.1:8000",
        width=1280,
        height=800,
        min_size=(900, 600),
    )
    webview.start()