# data/warli_dictionary/

The translation engine reads **all** dictionary and grammar data from this folder at runtime — nothing is hardcoded in Python.

```
data/warli_dictionary/
├── warli_dictionary.json   # English/Hindi/Marathi -> Warli (Devanagari) lookup table
├── grammar_rules.json      # word-order, inflection, postpositions
└── raw/                    # OPTIONAL: unprocessed source exports (csv/xlsx/txt)
```

## Current status

`warli_dictionary.json` holds a **working research lexicon (~2,183 entries)**:
everyday vocabulary, high-frequency verbs/adjectives/adverbs, irregular
plurals, phrases and sentences, in Devanagari (Palghar dialect).

It is **not** a published standard dictionary — Warli (Varli, ISO 639-3 `vav`)
is an unwritten language with Davar / Dungar / Palghar dialect variation, so
treat every entry as *field-validation pending* until a native speaker confirms
it. The engine flags unmatched words in the UI (`no match` chips) instead of
guessing, so gaps are visible rather than silently wrong.

## Entry schema

Each entry needs at least `warli`. Add `en` and/or `hi` as source-language
keys, plus optional `mr` (Marathi gloss — many entries resolve Marathi through
the shared Warli-headword vocabulary instead), `roman`, `pos`, `tags`,
`example`. Unknown/extra fields are ignored by the loader
(`backend/app/services/translation.py`); missing `roman`/`pos` default safely.

## Research grounding

Word choices and sound patterns follow the sources listed in
`data/research_papers/README.md` — principally Abraham & Abraham's SIL
*Varli Phonology and Grammar Sketches* (split-ergative SOV grammar, nasalised
vowels), the Linguistic Survey of India Dadra & Nagar Haveli volume
(400+ term comparative lexicon), Ghatage's *Warli of Thana*, Save's *The
Warlis*, and Garud's Warli teaching materials. See
`data/pronunciation_audio/sources.md` for the sound-pattern table.

## Adding / correcting words

1. Edit `warli_dictionary.json` (keep the `_meta` block, add entries).
2. No code change needed — call `POST /api/admin/reload` on a running
   instance, or commit + push to redeploy.
3. For spelling fixes rather than new words, use
   `data/voice_recording/corrections.json` instead.
