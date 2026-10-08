# Pronunciation — source credits

Every pronunciation reference used to build `lexicon.json` (and the choice of TTS
voice) is listed here for academic transparency. Only **publicly available**
sources or recordings made with explicit community consent are used.

## Why a Marathi TTS voice

Warli (also written Varli / Warali) is an Indo-Aryan language **usually classified
as a Marathi dialect** and is written here in Devanagari. A Marathi gTTS voice
(`WARLI_TTS_LANG=mr`) therefore reads Warli text noticeably more accurately than
the previous Hindi default — it preserves Marathi retroflexes (ळ/ण) and vowel
lengths that Warli shares. Sources 3 and 4 below support this classification.

## Documented Warli sound patterns (used to seed the lexicon)

| Pattern (Marathi → Warli) | Example | Applied in lexicon |
|---|---|---|
| Final `-a` (आ) → `-o` (ओ) | paisa → **paiso**, ghoda → **ghodo**, amba → **ambo** | पैसा→पैसो, घोडा→घोडो, आंबा→आंबो |
| Final `-en` → `-an` | sonen → **sonan** (gold), rupen → **rupan** (silver) | सोनं→सोनान |
| Plural `-e` (ए) → `-a` (आ) | ambe → amba, ghode → ghoda | (candidate — needs matching dictionary tokens) |
| `sh` → `s`, `ha` → `ya` | — | (candidate — needs field validation) |

## Sources

| # | Source type | Title / Description | URL / Location | License / Permission | Used for |
|---|---|---|---|---|---|
| 1 | Book (secondary) | K. J. Save (1945), *The Warlis*, Padma Publications Ltd., Bombay — Warli sound substitutions & word-formation patterns | cited via source 3 | Academic reference | a→o, en→an, s/sh, ya/ha patterns |
| 2 | Survey chapter (secondary) | Smita Patil (2017), “Warli”, in *The Languages of Maharashtra*, People's Linguistic Survey of India, Vol. 17(2), Orient Blackswan | cited via source 3 | Academic reference | Warli phonology & classification |
| 3 | District culture portal | “Language — Palghar”, The Districts Project (last updated 22 Jul 2025) | https://indiandistricts.in/cultures/maharashtra/palghar/language/ | Public web | Sound-pattern tables, kinship terms, case markers |
| 4 | Encyclopedia | “Varli language”, Wikipedia | https://en.wikipedia.org/wiki/Varli_language | CC BY-SA 3.0 | Confirms Varli/Warli is Indo-Aryan, classified as Marathi |

## Verified native-audio sources (transcribe these first)

These contain REAL spoken Varli (not painting tutorials — YouTube search for
"Warli language" is ~95% painting videos, verified Oct 2026):

- Global Recordings Network, Varli `vav` — "Good News" (41 min), "Meeting the
  Creator God", "Words of Life" + downloadable MP3 ZIPs + YouTube playlist
  `PL-5yEg0Ecc2ipEvWOwr9Z3TqFBYsHZGph` — https://globalrecordings.net/en/language/vav
- Jesus Film in Varli (full feature-length native audio) —
  https://www.jesusfilm.org/watch/jesus.html/varli.html
- PARI Endangered Languages Project: primary teacher Bhalchandra Dhangare
  (Mokhada, Palghar) teaching in Warli — closest classroom footage of the
  Palghar dialect this app standardizes on.

## Candidate audio sources (to review & verify — not yet transcribed)

The respellings above come from published descriptions, not yet from a native
speaker recording. Per the project's practice, verify and refine them against
real Warli speech, then replace the `needs field validation` entries with
speaker-confirmed ones (`source: youtube:<id>@mm:ss` or `field:palghar`).

- “Warli Tribe | Tribes of India” (Prasar Bharati Archives) — https://www.youtube.com/watch?v=s3P3xME-CvI
- Community Warli-language clips on YouTube (search “Warli bhasha” / “वारली भाषा”) — screen for Palghar-dialect speakers before use.

> When you add a clip, transcribe the exact words, credit the source in this
> table, and record the timestamp in the lexicon entry's `source` field.
