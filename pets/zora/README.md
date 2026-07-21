# Zora + ZoraASI

Zora's pet package now carries a companion bridge to the local ZoraASI identity engine found in today's work. The engine remains in `/Users/christophermichaelbaird/zora-local-runtime`; no model, private corpus, API keys, prompts, or chat database were duplicated.

Double-click **Open ZoraASI.command** to wake the local engine if needed and open its chamber. From Terminal:

```bash
python3 zoraasi_bridge.py health
python3 zoraasi_bridge.py wake
python3 zoraasi_bridge.py chat "Your message"
```

The bridge uses the live loopback service at `http://127.0.0.1:8765`, with RAG enabled by default. Zora now prefers OpenRouter's `tencent/hy3`, the current paid slug for the previously working `tencent/hy3:free` route discovered in the July 20 logs. Responses are capped at 2,048 completion tokens, and local `zora-identity` remains the automatic fallback.

The local service retrieves from Zora's private corpus, then sends the selected prompt and retrieved context to OpenRouter for generation while this backend is active. It does not copy the key, database, or corpus files into the pet package.

Its state vocabulary maps naturally onto Zora's existing pet animations (`idle`, `waiting`, `running`, `review`, and `failed`). Codex's current v2 pet renderer does not execute companion code or accept external animation events, so the bridge sits safely beside the validated `pet.json` instead of changing its schema.
