from __future__ import annotations

import logging
import os
import time
from typing import Any

from tools.base import Tool, ToolResult

logger = logging.getLogger("zoraos.everquest")

KILL_SWITCH_PATH = "/tmp/zoraos_kill"
SANDBOX_ENABLE_ENV = "ZORAOS_DESKTOP_SANDBOX"
CONTROL_ENABLE_ENV = "ZORAOS_DESKTOP_CONTROL_ENABLED"

KEY_MAP = {
    "{enter}": "enter",
    "{return}": "enter",
    "{tab}": "tab",
    "{esc}": "escape",
    "{up}": "up",
    "{down}": "down",
    "{left}": "left",
    "{right}": "right",
    "{space}": "space",
    "{backspace}": "backspace",
    "{del}": "delete",
    "{f1}": "f1",
    "{f2}": "f2",
    "{f3}": "f3",
    "{f4}": "f4",
    "{f5}": "f5",
    "{f6}": "f6",
    "{f7}": "f7",
    "{f8}": "f8",
    "{f9}": "f9",
    "{f10}": "f10",
    "{f11}": "f11",
    "{f12}": "f12",
    "{shift}": "shift",
    "{ctrl}": "ctrl",
    "{alt}": "alt",
    "{cmd}": "command",
    "{win}": "win",
}


def kill_switch_triggered() -> bool:
    return os.path.exists(KILL_SWITCH_PATH)


def sandbox_mode_enabled() -> bool:
    """Require two explicit local flags before desktop tools can run directly.

    Governed API tasks still deny these tools unconditionally. This check is defense in
    depth for callers that instantiate a tool without going through ToolManager.
    """

    return os.environ.get(SANDBOX_ENABLE_ENV) == "1" and os.environ.get(CONTROL_ENABLE_ENV) == "1"


class EQSendKeysTool(Tool):
    name = "eq_send_keys"
    description = "Send keys only inside an explicitly enabled, operator-owned offline sandbox."
    parameters = {
        "type": "object",
        "properties": {
            "keys": {
                "type": "string",
                "description": (
                    "Keystrokes to send. Named keys may use brace syntax, including "
                    "{enter}, {tab}, {esc}, arrows, {space}, and {f1}-{f12}."
                ),
            },
            "humanize": {
                "type": "boolean",
                "description": "Deprecated; evasion-style timing is disabled",
                "default": False,
            },
            "pause_after": {
                "type": "number",
                "description": "Seconds to pause after sending",
                "default": 0.5,
            },
        },
        "required": ["keys"],
    }

    async def execute(
        self,
        keys: str,
        humanize: bool = False,
        pause_after: float = 0.5,
        **kwargs: Any,
    ) -> ToolResult:
        if kill_switch_triggered():
            return ToolResult(success=False, error="Kill switch activated")
        if not sandbox_mode_enabled():
            return ToolResult(success=False, error="Desktop sandbox is not explicitly enabled")
        if humanize:
            return ToolResult(
                success=False,
                error="Human-like timing and detection evasion are disabled",
            )

        try:
            import pyautogui

            pyautogui.FAILSAFE = True

            self._send_keys(keys)

            if pause_after > 0:
                time.sleep(min(pause_after, 5.0))

            return ToolResult(success=True, output={"keys_sent": keys[:200]})
        except Exception as e:
            return ToolResult(success=False, error=f"EQ send keys failed: {e}")

    def _send_keys(self, keys: str) -> None:
        import re

        import pyautogui

        tokens = re.split(r"(\{.*?\})", keys)
        for token in tokens:
            if token in KEY_MAP:
                mapped = KEY_MAP[token]
                pyautogui.press(mapped)
                time.sleep(0.05)
            elif token.startswith("{") and token.endswith("}"):
                key_name = token[1:-1]
                pyautogui.press(key_name)
                time.sleep(0.05)
            else:
                for char in token:
                    if char == "\n":
                        pyautogui.press("enter")
                    else:
                        pyautogui.typewrite(char, interval=0.05)


class ECScreenReaderTool(Tool):
    name = "eq_read_screen"
    description = "Take a screenshot and read text from the game window or a region."
    parameters = {
        "type": "object",
        "properties": {
            "region": {
                "type": "string",
                "description": "Region: full, chat (bottom 40%), or top (top 40%).",
                "default": "full",
            },
            "return_screenshot": {
                "type": "boolean",
                "description": "Return screenshot data (base64)",
                "default": False,
            },
        },
        "required": [],
    }

    async def execute(
        self,
        region: str = "full",
        return_screenshot: bool = False,
        **kwargs: Any,
    ) -> ToolResult:
        if kill_switch_triggered():
            return ToolResult(success=False, error="Kill switch activated")
        if not sandbox_mode_enabled():
            return ToolResult(success=False, error="Desktop sandbox is not explicitly enabled")

        try:
            import base64
            import io

            import Quartz
            from PIL import Image, ImageEnhance, ImageFilter, ImageOps

            display = Quartz.CGMainDisplayID()
            cg_image = Quartz.CGDisplayCreateImage(display)
            if not cg_image:
                return ToolResult(success=False, error="Failed to capture screen")

            width = Quartz.CGImageGetWidth(cg_image)
            height = Quartz.CGImageGetHeight(cg_image)
            data = Quartz.CGDataProviderCopyData(Quartz.CGImageGetDataProvider(cg_image))
            screenshot = Image.frombuffer("RGBA", (width, height), data, "raw", "BGRA", 0, 1)

            crop_map = {
                "full": (0, 0, width, height),
                "chat": (0, int(height * 0.6), width, height),
                "top": (0, 0, width, int(height * 0.4)),
            }
            if region in crop_map:
                screenshot = screenshot.crop(crop_map[region])

            img = screenshot.convert("L")
            img = ImageOps.invert(img)
            img = img.filter(ImageFilter.SHARPEN)
            img = ImageEnhance.Contrast(img).enhance(2)
            img = ImageEnhance.Sharpness(img).enhance(2)

            try:
                import pytesseract

                text = pytesseract.image_to_string(img, config="--psm 6")
            except Exception as ocr_err:
                text = f"[OCR unavailable: {ocr_err}]"

            buf = io.BytesIO()
            screenshot.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            return ToolResult(
                success=True,
                output={
                    "text": text.strip(),
                    "screenshot": b64 if return_screenshot else None,
                },
            )
        except Exception as e:
            return ToolResult(success=False, error=f"Screen capture failed: {e}")


class EQWaitTool(Tool):
    name = "eq_wait"
    description = "Wait for a fixed duration inside an explicitly enabled offline sandbox."
    parameters = {
        "type": "object",
        "properties": {
            "seconds": {
                "type": "number",
                "description": "Seconds to wait (recommended: 0.5-5)",
                "default": 1.0,
            },
            "randomize": {
                "type": "boolean",
                "description": "Deprecated; randomized evasion timing is disabled",
                "default": False,
            },
        },
        "required": [],
    }

    async def execute(
        self,
        seconds: float = 1.0,
        randomize: bool = False,
        **kwargs: Any,
    ) -> ToolResult:
        if kill_switch_triggered():
            return ToolResult(success=False, error="Kill switch activated")
        if not sandbox_mode_enabled():
            return ToolResult(success=False, error="Desktop sandbox is not explicitly enabled")
        if randomize:
            return ToolResult(
                success=False,
                error="Randomized detection-evasion timing is disabled",
            )
        seconds = max(0.0, min(seconds, 5.0))
        time.sleep(seconds)
        return ToolResult(success=True, output={"slept_for": round(seconds, 2)})
