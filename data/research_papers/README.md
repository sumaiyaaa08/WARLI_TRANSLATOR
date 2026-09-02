# data/research_papers/

Drop the **two Warli research papers (PDF)** here:

- One documenting the **lipi (script)** conventions.
- One documenting the **pronunciation** rules.

Suggested filenames:

```
data/research_papers/warli_lipi_script.pdf
data/research_papers/warli_pronunciation.pdf
```

## How they are used

These PDFs are the **authoritative reference** for two data files (they are not parsed automatically by the app):

1. `data/warli_dictionary/grammar_rules.json` — encode the script conventions and word-order / inflection patterns described in the papers here.
2. `data/pronunciation_audio/lexicon.json` — encode the pronunciation rules (word → respelling / IPA) here.

When you refine either JSON file, cite the page (e.g. `"source": "research_paper:lipi p.3"`) so the mapping stays traceable for the academic write-up.
