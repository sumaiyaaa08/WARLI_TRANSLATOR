"""Ol Chiki -> Devanagari script transliteration (for the Santali voice).

There is no Santali TTS voice, so Santali speech is produced by transliterating
Ol Chiki into Devanagari and reading it with the existing Marathi gTTS voice —
a DOUBLE approximation, flagged as such in API responses and the UI.

The mapping follows Wikipedia's Ol Chiki letter table (Deva. column) plus the
convention used by the official UDHR Santali Devanagari rendering: Ol Chiki is
a true alphabet, but Devanagari is an abugida, so a vowel letter after a
consonant becomes a *matra* (ᱞᱮ -> ले), while ᱚ after a consonant behaves
like the inherent vowel and drops (ᱡᱚᱛᱚ -> जत). Aspirated digraphs (C + ᱷ)
collapse to the aspirated Devanagari consonant (ᱛᱷ -> थ).

Source for letter values: https://en.wikipedia.org/wiki/Ol_Chiki_script
(letter table: ALA-LC / Zide / Deva. columns).
"""
from __future__ import annotations

# Consonants -> base Devanagari letter (matra attaches to these).
_CONSONANTS = {
    "ᱠ": "क", "ᱜ": "ग", "ᱝ": "ं", "ᱪ": "च", "ᱡ": "ज",
    "ᱧ": "ञ", "ᱴ": "ट", "ᱰ": "ड", "ᱬ": "ण", "ᱛ": "त",
    "ᱫ": "द", "ᱱ": "न", "ᱯ": "प", "ᱵ": "ब", "ᱢ": "म",
    "ᱭ": "य", "ᱞ": "ल", "ᱨ": "र", "ᱣ": "व", "ᱥ": "स",
    "ᱦ": "ह", "ᱲ": "ड़", "ᱶ": "वं",
}

# Vowels -> (matra after consonant, standalone form).
_VOWELS = {
    "ᱚ": ("", "अ"),
    "ᱟ": ("ा", "आ"),
    "ᱤ": ("ि", "इ"),
    "ᱩ": ("ु", "उ"),
    "ᱮ": ("े", "ए"),
    "ᱳ": ("ो", "ओ"),
}

# C + ᱷ (oh) aspirate digraphs -> single aspirated consonant.
_ASPIRATED = {
    "क": "ख", "ग": "घ", "च": "छ", "ज": "झ", "ट": "ठ",
    "ड": "ढ", "त": "थ", "द": "ध", "प": "फ", "ब": "भ",
    "ड़": "ढ़", "स": "श",
}

_DIGITS = {
    "᱐": "०", "᱑": "१", "᱒": "२", "᱓": "३",
    "᱔": "४", "᱕": "५", "᱖": "६", "᱗": "७", "᱘": "८", "᱙": "९",
}

_MARKS = {
    "ᱸ": "ं",    # nasalization -> anusvara
    "ᱹ": "",     # extended-vowel dot -> drop (base vowel kept)
    "ᱺ": "ं",
    "ᱻ": "",     # prolongation -> drop
    "ᱼ": "",     # glottal protector -> drop
    "ᱽ": "",     # ahad deglottalizer -> drop
    "᱾": "।",
    "᱿": "॥",
}

_OL_START, _OL_END = 0x1C50, 0x1C7F


def contains_olchiki(text: str) -> bool:
    """True if any char is in the Ol Chiki Unicode block."""
    return any(_OL_START <= ord(c) <= _OL_END for c in (text or ""))


def transliterate_olchiki(text: str) -> str:
    """Transliterate Ol Chiki script to Devanagari. Non-Ol-Chiki chars pass through."""
    out: list[str] = []
    prev_was_bare_consonant = False
    for ch in text or "":
        if ch in _CONSONANTS:
            out.append(_CONSONANTS[ch])
            prev_was_bare_consonant = True
        elif ch == "ᱷ":
            # Aspirate digraph: merge into previous bare consonant when possible.
            if prev_was_bare_consonant and out:
                base = out[-1]
                out[-1] = _ASPIRATED.get(base, base + "ह")
            else:
                out.append("ह")
            prev_was_bare_consonant = False
        elif ch in _VOWELS:
            matra, standalone = _VOWELS[ch]
            out.append(matra if prev_was_bare_consonant else standalone)
            prev_was_bare_consonant = False
        elif ch in _DIGITS:
            out.append(_DIGITS[ch])
            prev_was_bare_consonant = False
        elif ch in _MARKS:
            out.append(_MARKS[ch])
            # nasal anusvara keeps consonant "bare" for a following matra
            prev_was_bare_consonant = prev_was_bare_consonant and ch == "ᱸ"
        else:
            out.append(ch)
            prev_was_bare_consonant = False
    return "".join(out)
