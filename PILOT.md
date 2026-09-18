# Linguify classroom pilot kit (weekend, 10 kids, 1 phone)

Goal: produce ONE honest number for the SIH deck — *"X/10 children recalled 5+
Warli words after a 15-minute session"* — plus completion data from `/teacher`.

## 0. Ethics first (read to the teacher/parent, get a yes)
> "We are students testing a free mother-tongue learning app. No names, photos,
> or personal data leave this phone — the app stores only a display name, stars
> and lesson progress. You can stop anytime."
EN/HI/MR as needed. Display names only (e.g. "Aarav-1"), never full names.

## 1. Setup (5 min, needs internet once — then airplane mode is fine)
1. Open the deployed app (or `localhost:8000` offline build).
2. Create one account per child: Login → Sign up (`kid01`…`kid10`, password shared
   with teacher, display name = first name + number).
3. Set instruction language to the child's strongest (EN/हिंदी/मराठी toggle).

## 2. Protocol per child (15 min)
| Min | Do |
|---|---|
| 0–2 | **Pre-test** (paper, below): point at each of the 10 printed words, ask meaning. Mark ✓/✗. Do NOT teach. |
| 2–12 | Child plays **Greetings + Numbers 1–5** on the app (audio on). Helper only taps; never answers. |
| 12–15 | **Post-test**: same 10 words, shuffled order. Mark ✓/✗. Note time-to-complete + smiles/complaints. |

## 3. Word list (print big, with the emoji from the app)
| # | English | Warli | Hindi |
|---|---|---|---|
| 1 | hello | नमस्कार | नमस्ते |
| 2 | water | पाणी | पानी |
| 3 | one | एक | एक |
| 4 | two | दोन | दो |
| 5 | hand | हात | हाथ |
| 6 | cow | गाय | गाय |
| 7 | red | लाल | लाल |
| 8 | come here | इकडे ये | यहाँ आओ |
| 9 | thank you | धन्यवाद | धन्यवाद |
| 10 | dog | कुत्रा | कुत्ता |

## 4. Score sheet (copy per child)
Child (display name): ______  Date: ______  Helper: ______
Pre-test score: __/10   Post-test score: __/10   Gain: __
Lesson completed? (check `/teacher` → Registered learners): Y / N
Observed (1 line): _________________________________________

## 5. Report (paste into the deck)
- **Completion**: n/10 finished both lessons (from `/teacher`).
- **Word gain**: mean(post − pre) across 10 kids + "n/10 recalled 5+ words".
- **Quote**: one child/teacher sentence (with permission).
- Honest limits to state alongside: n=10, single session, no control group —
  judges respect this more than inflated claims.
