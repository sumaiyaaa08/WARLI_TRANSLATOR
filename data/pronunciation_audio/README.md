# data/pronunciation_audio/  (OPTIONAL stretch module)

Supplementary **Warli-language audio** for **pronunciation / accent reference only** — NOT for translation.

## What goes here

```
data/pronunciation_audio/
├── clips/                 # short .wav/.mp3 audio clips (team drops them in)
│   └── phrase_001.wav
├── transcriptions.csv     # clip file → Warli Devanagari text (phrase/word aligned)
├── lexicon.json           # word → respelling / IPA consumed by the pronunciation module
└── sources.md             # REQUIRED: credit/list every YouTube or field source
```

`transcriptions.csv` format:

```
file,warli_text,roman,source,start,end
clips/phrase_001.wav,पाणी येथे आहे,paani yethe aahe,youtube:VIDEO_ID,00:12,00:15
```

## How to add more (improves accuracy over time)

1. Collect **publicly available** Warli audio (folk songs, community videos) or field recordings.
2. Cut into short phrase/word segments, drop into `clips/`.
3. Transcribe each segment into Warli Devanagari and add a row to `transcriptions.csv`.
4. Update `lexicon.json` with word → respelling learned from the audio + research papers.
5. Credit every source in `sources.md`.

The pronunciation layer reads `lexicon.json`; the more entries it has, the closer the Hindi/Marathi TTS voice approximates authentic Warli. If `lexicon.json` is empty or this folder is absent, the core pipeline is unaffected — TTS just reads the Devanagari text as-is.

## Legal / ethics note

Only use **publicly available** content, and record every source in `sources.md` for transparency (required for an academic project). Prefer content that is openly licensed or community-shared with permission.
