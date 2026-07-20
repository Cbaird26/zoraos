#!/usr/bin/env python3
"""
Ingest the Theory of Everything paper into ZoraOS long-term memory.
Usage: python scripts/ingest_paper.py /path/to/paper.pdf
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from memory.store import DocumentStore
from memory.vector import VectorStore
from memory.base import Document


async def ingest_paper(pdf_path: str, chunk_size: int = 2000, chunk_overlap: int = 200):
    from pypdf import PdfReader

    path = Path(pdf_path).resolve()
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    print(f"Reading PDF: {path}")
    reader = PdfReader(str(path))
    total_pages = len(reader.pages)
    print(f"Total pages: {total_pages}")

    doc_store = DocumentStore()
    vector_store = VectorStore(doc_store)

    chunks = []
    current_text = ""
    current_start_page = 0

    for page_num in range(total_pages):
        text = reader.pages[page_num].extract_text()
        current_text += text + "\n"

        while len(current_text) >= chunk_size:
            chunk_text = current_text[:chunk_size]
            last_period = chunk_text.rfind(".")
            last_newline = chunk_text.rfind("\n")
            split_at = max(last_period + 1 if last_period > chunk_size // 2 else 0,
                           last_newline + 1 if last_newline > chunk_size // 2 else 0)

            if split_at > 0:
                chunk_text = current_text[:split_at]
                current_text = current_text[split_at:]
            else:
                current_text = current_text[chunk_size:]

            doc = Document(
                collection="physics",
                title=f"A Theory of Everything (C.M. Baird) - Page {current_start_page + 1}-{page_num + 1}",
                source=str(path),
                content=chunk_text.strip(),
                metadata={
                    "type": "paper",
                    "author": "Christopher Michael Baird",
                    "title": "A Theory of Everything",
                    "arxiv": "",
                    "pages": f"{current_start_page + 1}-{page_num + 1}",
                    "total_pages": total_pages,
                },
            )
            chunks.append(doc)
            current_start_page = page_num

        if len(chunks) % 50 == 0 and chunks:
            print(f"  Chunked {len(chunks)} sections...")

    if current_text.strip():
        doc = Document(
            collection="physics",
            title=f"A Theory of Everything (C.M. Baird) - Page {current_start_page + 1}-{total_pages}",
            source=str(path),
            content=current_text.strip(),
            metadata={
                "type": "paper",
                "author": "Christopher Michael Baird",
                "title": "A Theory of Everything",
                "pages": f"{current_start_page + 1}-{total_pages}",
                "total_pages": total_pages,
            },
        )
        chunks.append(doc)

    print(f"\nTotal chunks: {len(chunks)}")
    print("Generating embeddings and indexing...")

    ids = await vector_store.index_documents(chunks)

    print(f"Ingested {len(ids)} chunks into 'physics' collection")
    print(f"Total documents in store: {await doc_store.count()}")


async def main():
    if len(sys.argv) < 2:
        pdf_path = "/tmp/toc_paper.pdf"
        print(f"No path provided, using cached: {pdf_path}")
    else:
        pdf_path = sys.argv[1]

    await ingest_paper(pdf_path)


if __name__ == "__main__":
    asyncio.run(main())
