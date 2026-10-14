# TargetX Alert Notes

**Current version: 1.1**

A Canvas bookmarklet for Lake Michigan College faculty. With one click, it summarizes each student's performance in a Canvas course and builds a ready-to-paste note for TargetX early alerts. It covers both full-time faculty, who use TargetX Faculty Alerts, and adjunct faculty, who use the Faculty Early Alert Form.

**[Install TargetX Alert Notes](https://jmbenak71.github.io/targetx-alert-notes/)**

---

## What it does

- Lists every active student in the course with their current grade (matching the Canvas Gradebook Total), missing assignments, late submissions, and last Canvas activity.
- Flags students who meet adjustable thresholds: grade below 70%, 2 or more missing assignments, or 7 or more days without Canvas activity.
- Builds a consistent alert note for each student and provides one-click actions:

| Button | What it does |
|---|---|
| **Copy note** | Copies the student's note to the clipboard. |
| **Copy + TargetX** | Copies the note and opens TargetX Faculty Alerts. |
| **Search TargetX** | Copies the note and searches TargetX for the student. |
| **Adjunct Alert** | Copies the note and opens the Faculty Early Alert Form with fields pre-filled. |
| **Copy all flagged notes** | Copies notes for every flagged student. |
| **Download CSV** | Exports the full class summary. |

### Sample note

```
Canvas Academic Update – CIS-113-01 – 10/14/2026
Student: Jane Doe (ID 12345678)
Section: CIS-113-01 (Fall 2026) | Instructor: Jim Benak

Jane has a current grade of 64.2% (D) in CIS-113-01 as of 10/14/2026. Jane has not submitted 3 assignments.

Average on submitted work: 81.7% (excludes missing and zero-graded work)
Missing work timing: 2 in the last 14 days, 1 earlier
By category (graded work): Homework 91% · Exams 52% · Discussions 0%

Last Canvas activity: 10/6/2026 (8 days ago)
Last Canvas submission: 10/6/2026 (8 days ago)
```

## Installing

1. Open the [install page](https://jmbenak71.github.io/targetx-alert-notes/) in a desktop browser.
2. Drag the **TargetX Alert Notes v1.1** button to your bookmarks bar. Delete any older version's bookmark.
3. Open a Canvas course you teach and click the bookmark.

## How it works

The bookmarklet runs inside your logged-in Canvas session and reads course data through the Canvas API with your own permissions. It needs no API token. Student data stays in your browser: it is not stored or sent anywhere. Notes are copied to your clipboard, and links open TargetX or the alert form in a new tab using your existing logins.

### What counts as missing

- Assignments Canvas marks as missing.
- Any assignment with a recorded grade of 0, whether or not something was submitted.
- Excused and 0-point assignments are ignored.

## Limits

- Works one course at a time, in a desktop browser, for teachers, TAs, and admins.
- Cannot open a student's TargetX record directly; you select the student in TargetX.
- Category scores are points-based and may differ slightly from the Gradebook in weighted courses or courses that drop the lowest score.
- Every 0 counts as missing, including any attendance column in the Gradebook.
- The current grade includes grades entered but not yet posted to students.
- Adjunct Alert pre-filling depends on Faculty Early Alert Form settings. Always check the CRN, Student ID, and Alert Category before submitting. The note is also copied, so you can paste it if a field arrives empty.

## Customization

**In the tool:** adjust the flag thresholds and choose whether to show only flagged students.

**In the code:** LMC-specific settings are defined near the top of `src/targetx-alert-notes-v1.1.js`:

| Setting | Purpose |
|---|---|
| `TX_ALERTS` | TargetX Faculty Alerts page |
| `TX_SEARCH` | TargetX search address |
| `ADJ_FORM` | Faculty Early Alert Form address |
| `ADJ_TERM`, `ADJ_CAT` | Form option IDs for Term and Alert Category |

To build a new bookmarklet from edited source, URL-encode the file contents (without the opening comment) and prefix them with `javascript:`, or use any bookmarklet builder.

## Versioning

Every release is numbered. Minor changes (wording, adding or removing a line) increase the decimal, for example 1.1 → 1.2. Major changes (new workflows or data sources) increase the whole number, for example 1.x → 2.0. See [CHANGELOG.md](CHANGELOG.md).

## Support

Questions and feature requests: contact Jim Benak, Lake Michigan College.
