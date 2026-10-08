# data/research_papers/ — sources behind the dictionary and grammar

Drop reference PDFs here when you have them (they are **not** parsed by the
app — they are the academic basis for the JSON data files):

```
data/research_papers/warli_lipi_script.pdf
data/research_papers/warli_pronunciation.pdf
```

When you refine `grammar_rules.json` or `pronunciation_audio/lexicon.json`
from a paper, cite the page in the entry (e.g. `"source":
"research_paper:pronunciation p.4"`) so the mapping stays traceable.

## Public sources consulted for this build

| # | Source | What it supports |
|---|---|---|
| 1 | G. Abraham & H. Abraham, *Varli Phonology and Grammar Sketches* (SIL, 2012) — split-ergative SOV grammar, nasalised vowels, agreement, interlinear texts | `grammar_rules.json` structure; ergative `-nĩ/-hĩ` documentation |
| 2 | *Linguistic Survey of India: Dadra and Nagar Haveli*, Office of the Registrar General (2002; survey from 1988) — Varli phonology/morphology/syntax chapters + 400+ term comparative lexicon (Davar/Dungar Varli vs Gujarati/Marathi) | dictionary entries; dialect note |
| 3 | A. M. Ghatage, *Warli of Thana*, A Survey of Marathi Dialects Vol. 7 (1969) | classification as Marathi-family; historical forms |
| 4 | K. J. Save, *The Warlis* (1945), ch. "Dialect" pp. 186–201 | sound substitutions (`a→o`, `en→an`, `sh→s`, `ha→ya`) used in `pronunciation_audio/lexicon.json` |
| 5 | S. Patil, "Warli", *People's Linguistic Survey of India: Languages of Maharashtra* Vol. 17(2) (2017) | phonology summary; classification |
| 6 | R. Garud, *Teaching Learning Aids for Local Tribal Warli Language* (Palghar school materials) — Warli–Marathi classroom vocabulary | everyday words; bridging forms |
| 7 | Global Recordings Network, Varli audio Bible/stories (`vav`) + Jesus Film in Varli | candidate listening reference for future transcription into `pronunciation_audio/` |
| 8 | ASJP wordlist "WARLI"; Wiktionary Category:Varli; Wikipedia "Varli language" (ISO `vav`, Glottolog `varl1238`) | background; speaker-population figures (~390k census / ~600k est.) |

## A note on YouTube

Most "Warli" videos on YouTube teach **Warli painting**, not the language.
Usable speech clips are rare (e.g. Prasar Bharati's tribal documentaries and
community uploads under "Warli bhasha" / "वारली भाषा"). Before using any clip:
confirm the speaker's dialect (Palghar vs Davar/Dungar), transcribe exact
words into `pronunciation_audio/transcriptions.csv`, and credit it in
`pronunciation_audio/sources.md` with a timestamp.
