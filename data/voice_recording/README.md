# data/voice_recording/

The **annotated audio recording** where incorrect Warli spellings are marked alongside their correct spelling.

> This is a **correction / validation dataset**, NOT raw ASR training audio. We do not train a speech model on it. Its only job is to populate the spelling-correction table applied after dictionary lookup.

```
data/voice_recording/
├── corrections.json        # wrong -> correct Warli pairs consumed by the engine  [REPLACE/EXTEND]
├── annotated_recording.*    # drop the original annotated audio + notes here
└── raw_annotations.csv     # OPTIONAL: your transcription sheet before conversion
```

## Building the correction table

Convert the annotations into `corrections.json` (keep `_meta`, replace `pairs`):

```
{ "wrong": "पानी", "correct": "पाणी", "source": "voice_recording:00:14", "note": "..." }
```

- `source` should point at the timestamp/segment in the recording so every fix is traceable.
- The engine applies these as exact-token replacements (and optional normalization) after lookup — see `backend/app/services/translation.py` → `SpellingCorrector`.
