# Warli (Varli, ISO 639-3 `vav`) — research sources behind this app

Dialect standardized on: **Palghar / North Konkan Varli (Davari-leaning)**,
written in **Devanagari**. Other dialects (Dungar/Dogri, Eastern/Western Nihiri)
differ 7–39% in vocabulary — field-check with local speakers before evaluation.

## 1. Core linguistic facts used in the engine
- Family: Indo-European › Indo-Aryan › Southern Zone › Marathi–Konkani › Varli.
  Usually classified as a Marathi dialect (60% lexical similarity with Marathi,
  ~40% with Gujarati, ~65% with Kukna). Source: Ethnologue `vav`, Glottolog
  `varl1238`, Wikipedia "Varli language".
- Word order: predominantly **SOV**; **split-ergative** (past/perfective =
  ergative–absolutive, other tenses = nominative–accusative); postpositions, not
  prepositions; verb agrees in person/number/gender; nasalised vowels +
  homorganic nasal–plosive sequences.
  Source: Abraham & Abraham, *Varli Phonology and Grammar Sketches* (SIL, 2012),
  https://www.sil.org/resources/publications/entry/50903
- Comparative lexicon (400+ terms: Davar vs Dungar Varli vs Dhodia vs Kokna vs
  Gujarati vs Marathi) + phonology/morphology/syntax sketch:
  Ahirwal (2003) / LSI Special Studies *Dadra and Nagar Haveli*,
  via https://ruralindiaonline.org/library/resource/linguistic-survey-of-india---dadra-and-nagar-haveli/
- Sociolinguistics: ~390,000 speakers (2011 census) / ~600,000 (earlier SIL
  estimate); Devanagari (MH) + Gujarati script (GJ); UNESCO "potentially
  vulnerable"; not taught in schools. Teaching-bridge work in Palghar/Mokhada:
  Bhalchandra Dhangare (PARI Endangered Languages Project) and Rajan Garud's
  Warli teaching materials (SRISTI).

## 2. Audio — what is real vs approximated
- REAL native Warli audio (listen + transcribe for the pronunciation lexicon):
  Global Recordings Network, language `vav` — "Good News", "Meeting the Creator
  God", "Words of Life" + MP3/ZIP downloads,
  https://globalrecordings.net/en/language/vav and YouTube playlist
  `PL-5yEg0Ecc2ipEvWOwr9Z3TqFBYsHZGph`; Jesus Film in Varli,
  https://www.jesusfilm.org/watch/jesus.html/varli.html
- YouTube honesty note (Oct 2026): searching "Warli language learning" returns
  almost entirely **Warli painting tutorials**, not spoken-language lessons.
  There is no Warli course channel to "learn from" the way Hindi/Marathi has.
  The PARI teacher video (Dhangare, Mokhada) is the closest classroom footage.
- APPROXIMATION in this app: no public Warli TTS or Warli ASR corpus exists, so
  input speech is transcribed by Whisper (en/hi/mr) and output speech is a
  **Marathi gTTS voice** (closest to Warli, keeps ळ/ण) reading Devanagari,
  nudged by `data/pronunciation_audio/lexicon.json`. Every API response and the
  UI footer flag this.

## 3. Sound patterns encoded (validate in field)
From Save (1945) via Patil (2017, People's Linguistic Survey of India):
final -a→-o (पैसा→पैसो, घोडा→घोडो, आंबा→आंबो), plural -e→-a, -en→-an
(सोनं→सोनान), s for Marathi sh, case markers (subject -u/-o/-a, object -la,
instrumental -an). Lexicon entries carrying these are tagged
"needs field validation".

## 4. How to extend accurately
1. Pick a dialect village (e.g. Mokhada, Palghar) and record 50–100 prompted
   words with consent → clip into `data/pronunciation_audio/clips/`.
2. Transcribe into `transcriptions.csv`, add respellings to `lexicon.json`,
   credit in `sources.md`.
3. Add dictionary entries with `mr` + `hi` + `en` keys and `tags: ["verified",
   "field:palghar"]`; run `python smoke_test.py`; then `POST /api/admin/reload`.
