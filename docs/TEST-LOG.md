# Test log

The owner fills this in after each manual test. Result is pass, fail or partly.

| Date | Day | Test | Result | Notes |
|---|---|---|---|---|
| 2026-11-01 | 0 | Replit credits reach a separate service (curl from laptop) | pass | Claude Code called POST /api/test twice from outside Replit with the owner's page 2 image. Both returned 200 with a transcription. The owner confirmed on the usage page that the calls were charged to Replit credits. First call took 93 s, second 24 s (speed still to fix). The endpoint has no sign-in and no rate limit yet (to fix). |
| 2026-11-01 | 0 | Supabase free-tier limits written down | skipped | Owner decided not to check. |
| 2026-11-01 | 0 | School terms on storing papers | skipped | Owner decided not to check. |
| 2026-11-01 | 0 | Gemini can locate handwritten lines | pass | Claude Code called POST /api/locate on the owner's page 2 (9.9 s). 17 lines returned, one per handwritten line, in reading order. Overlay saved as docs/img/locate-overlay-page2.png. Every box sat on the right line. Small flaws: boxes 7 and 8 overlap vertically because of stacked fractions, and box 11 clips the right edge slightly. One page only. FINDING: the locate text silently corrected the student's sign slip (lines 12, 13, 15 and 17 show -3 ln, the page says +3 ln). The earlier /api/test kept the sign as written. The transcription prompt must say copy exactly and never correct. |
| 2026-11-01 | 0 | Re-measure transcription time on the real page 2 after Agent's speed changes (published app) | pass | Claude Code made two calls to the republished app. 5.3 s and 3.9 s, down from 24 s. The transcription was still faithful and kept the sign as written. Single page, two calls only. Transcription step only, not full marking. |
| 2026-11-02 | 3 | Page 2 marked by the new marking-service with `AI_PROVIDER=google` (two live runs, Claude Code) | partly | Question was a made-up render of the question text, answer was the owner's page 2. Model from `.env` (reported as gemini-3.5-flash-lite). Run 1: first error line 12 (the sign slip, as expected), later lines `follows_from_error`, but status `unsure` because two solves were written differently ("x(8-3 ln x)^(1/3)" and a cube root form) and the text comparison called them different. Fixed with a model equivalence check. Run 2: status `marked`, answer judged wrong, label "Not verified", but first error placed at line 10, not 12. The transcription of line 10 changed between runs: run 1 read `-ln|x|`, run 2 read `ln|x|` (the minus lost). Then line 11 `-3 ln` looked inconsistent and was blamed. Time 31.5 s and 32.3 s per marking, no progress display (plan says fail over 30 s). Cost not measured. Same page, same input, different first error: not stable. |
| | 0 | Endpoint has sign-in and rate limit | | Not yet. |
| | 1 | Tablet to laptop sync | | |
| | 2 | Question blocks from PDF and from paste | | |
| | 3 | Pages 1, 2 and 4 marked as expected | | |
| | 3 | Cost per marking | | |
| | 4 | Different-route test (correct work with different steps) | | |
| | 5 | PDF export on tablet, phone and laptop | | |
| | 6 | Two-account bank test | | |
| | 7 | Friend test (3 people) | | |
| | 8 | Deployed demo on tablet, no AI calls | | |

## Facts to record

- Model used by the Replit test service, as reported by Replit Agent on 2026-11-01: gemini-3.8-flash, described as a fast non-thinking Flash model. Not verified by us. The name and whether it is current are unchecked. Measured 24 s per call, so check for hidden thinking, image size and integration delay.
- Canvas library chosen and its licence:
- Supabase free-tier limits (storage, rows, bandwidth, idle pausing):
- Confirmations needed to reach "confirmed":
- Cost per marking and the unit:
