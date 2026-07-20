from __future__ import annotations

from pathlib import Path
from typing import Any

from pypdf import PdfReader

from tools.base import Tool, ToolResult


class PDFReaderTool(Tool):
    name = "pdf_reader"
    description = "Read PDF files and extract text content"
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute path to the PDF file"},
            "max_pages": {"type": "integer", "description": "Maximum pages to extract", "default": 100},
            "start_page": {"type": "integer", "description": "Starting page (0-indexed)", "default": 0},
        },
        "required": ["path"],
    }

    async def execute(self, path: str, max_pages: int = 100, start_page: int = 0, **kwargs: Any) -> ToolResult:
        try:
            p = Path(path).resolve()
            if not p.exists():
                return ToolResult(success=False, error=f"PDF not found: {path}")
            if p.suffix.lower() not in (".pdf",):
                return ToolResult(success=False, error=f"Not a PDF file: {path}")

            reader = PdfReader(str(p))
            total_pages = len(reader.pages)
            end_page = min(start_page + max_pages, total_pages)

            pages_text = []
            for i in range(start_page, end_page):
                page = reader.pages[i]
                text = page.extract_text()
                if text.strip():
                    pages_text.append({"page": i + 1, "content": text.strip()})

            output = {
                "file": str(p),
                "total_pages": total_pages,
                "extracted_pages": len(pages_text),
                "pages": pages_text,
            }
            return ToolResult(success=True, output=output)
        except Exception as e:
            return ToolResult(success=False, error=f"PDF read error: {e}")
