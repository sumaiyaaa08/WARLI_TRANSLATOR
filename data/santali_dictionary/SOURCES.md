# Santali dictionary — sources & licence

Seed pack (744 entries, `{en, santali, pos}`) merged from two open sources.
Same caveat as the rest of `data/`: **seed content, needs native-speaker
validation** before any real evaluation.

## 1. kbaske/dictionary — Santali-English Dictionary (`sat-en.json`)
- URL: https://github.com/kbaske/dictionary
- Licence: **CC-BY-SA-4.0** — credit: kbaske / Santals tools community.
- Used: all 24 entries (preferred on English-headword collisions).

## 2. kaikki.org Santali dictionary (Wiktionary extraction)
- URL: https://kaikki.org/dictionary/Santali/
- Upstream: English Wiktionary (**CC-BY-SA**) via wiktextract
  (Tatu Ylonen, LREC 2022 — please cite in academic work).
- Used: single-word Ol Chiki headwords with short English glosses (~720 entries).
- Filter: kept glosses of 1–3 plain lowercase words; dropped parenthetical/
  multi-meaning entries; English-headword deduped.

## Licence note
Both upstreams are **CC-BY-SA** — this seed file inherits the same terms:
credit the sources above when redistributing, share adaptations alike.
