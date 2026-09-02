# data/warli_dictionary/

The translation engine reads **all** dictionary and grammar data from this folder at runtime — nothing is hardcoded in Python.

```
data/warli_dictionary/
├── warli_dictionary.json   # English/Hindi -> Warli (Devanagari) lookup table  [REPLACE with real data]
├── grammar_rules.json      # word-order, inflection, postpositions             [refine from research papers]
└── raw/                    # OPTIONAL: unprocessed manuscript OCR exports (csv/xlsx/txt)
```

## Replacing the seed with your real dictionary

The seed `entries` in `warli_dictionary.json` is **example data** so the app runs immediately. To use the team's compiled dictionary (`warli_dictionary.*`):

1. Convert your source (xlsx/csv/OCR text) into the same JSON schema — keep the `_meta` block, replace `entries`.
2. Each entry needs at least `warli`; add `en` and/or `hi` as the source-language keys, plus optional `roman`, `pos`, `tags`, `example`.
3. Save and restart the backend (or call `POST /admin/reload`).

The loader (`backend/app/services/translation.py`) is tolerant: unknown/extra fields are ignored, missing `roman`/`pos` default safely.
