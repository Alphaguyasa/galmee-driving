# DESIGN.md: Galmee Driving School

Change this file first, then the code.

## Brief

- **Subject:** a driving school in Shashamane. A learner car with a red L on the roof, a dusty practice yard with cones, a registrar's ledger of who has paid and when the transport office exam is.
- **Audience:** the registrar at the desk (one thumb, a queue of students), instructors between lessons, the owner (who wants to know who still owes).
- **Primary job:** see every student's lessons, payments and exam date on one screen.

## Colour

| Token | Hex | Role |
| --- | --- | --- |
| `--asphalt` | `#1E2226` | Dominant. Header, primary action, text. White on it is 16:1. |
| `--concrete` | `#EEEFF1` | Page background. |
| `--rule` | `#D3D6DA` | Borders and hairlines. |
| `--lane` | `#F2B705` | The dashed road line. Used only for lesson progress. |
| `--l-red` | `#B3261E` | The learner plate, money owed, errors. 6.5:1 on white. |
| `--sign-blue` | `#0B5CAD` | Exam dates, focus ring. 6.3:1 on white. |

Status is never colour alone: lessons and exams always carry a word, and money owed always says "owes".

## Type

- **Overpass** (English and Afaan Oromo): drawn from highway sign lettering, open and legible at a glance in sunlight. Numbers use tabular figures (`.num`).
- **Noto Sans Ethiopic** for Amharic, 400/600.
- Self-hosted with `next/font/local`.
- Scale: 14 / 16 / 20 / 24.

## The one bold thing

The **road line**: an asphalt strip with a lane-yellow dashed line that grows as lessons are attended. It is on every student row and at the top of the student card. Everything else stays quiet.

## Layout (360 px first)

```
+----------------------------+
| [L] School name  [lang][x] |  asphalt header
+----------------------------+
| [ search name or phone  ]  |
| All | Owes | Exam soon     |
+----------------------------+
| Hawi Tufa            12/25 |
| ==== ==== ====------------ |  road line
| owes ETB 3,000   Exam Hedar 12 |
+----------------------------+
| [ Register student       ] |  sticky, within thumb reach
+----------------------------+
| Students Schedule Exams Setup |
```

Checked against the generic defaults: no cream and terracotta, no gradient washes, no identical rounded shadow cards, no all-caps eyebrow labels.
