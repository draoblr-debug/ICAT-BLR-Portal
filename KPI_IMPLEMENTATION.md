# KRA/KPI Implementation Reference

This document lists every KPI computed by the tracking layer built across Phases 1–5,
its backing entity/entities, how it is computed, and — per the task's explicit
instruction to be honest about gaps rather than report false coverage — every place
where a target, a denominator, or a whole KPI is a judgment call rather than a number
given by the original brief.

All KPI-producing functions return the shared `KpiResult` shape (`types.ts`):

```ts
interface KpiResult {
  kpiId: string;
  label: string;
  actual: number;
  target: number;
  unit: 'percent' | 'count' | 'rating';
  status: 'On Track' | 'At Risk' | 'Off Track' | 'No Data';
  period: string;
}
```

`status: 'No Data'` is used whenever the backing entity has zero relevant records,
rather than fabricating a 0% or 100% that would misrepresent "nothing tracked yet" as
"tracked and failing/passing."

Three role-scoped aggregator functions live in `kpiService.ts` and are the primary
consumers of everything below:

- `calculateModuleTutorKpis(tutorId, bag)` — 16 KPIs, itemized by name in the task.
- `calculateHodOnlyKpis(hodId, bag)` — 11 KPIs, itemized only as category phrases in the
  task. HODs also see the same 16 tutor KPIs (via `calculateModuleTutorKpis(hodId, bag)`)
  for modules they personally teach, rendered as a visually separate "As Module Tutor"
  section per the task's explicit instruction that the two sets must not overwrite each
  other — 27 KPI tiles total on `HodDashboard.tsx`'s KPIs tab.
- `calculateVicePrincipalKpis(bag)` — 19 KPIs, given only as 6 category phrases plus a
  total count of 19.

All three take a `KraDataBag` — effectively the app's whole live-data context — since
they are dashboard aggregators, not narrow single-purpose calculators.

---

## 1. Module Tutor KPIs (16)

| # | kpiId | Label | Backing entity | Computation |
|---|-------|-------|-----------------|-------------|
| 1 | `tutor-timely-delivery` | Timely Delivery | `LessonPlan`, `AIClassModule`, `SemesterPlanEntry` (via existing `calculateLessonTracking`) | Average `chunkProgress` (sessions delivered vs. sessions expected to date) across the tutor's Core modules. Reuses a pre-existing analytics function rather than a new one. |
| 2 | `tutor-outcomes-defined` | Learning Outcomes Defined | `AssignmentBrief.learningOutcomes` | % of the tutor's *active* (current-semester) modules with a brief that has ≥1 learning outcome. |
| 3 | `tutor-briefs-aligned` | Briefs Aligned to Outcomes | `AssignmentBrief.weeklySchedule` | % of active modules whose Published brief has outcomes **and** every weekly milestone's `topic`/`description` filled in (`hasQualityBrief` helper — same structural check `calculateDepartmentPerformance` uses). |
| 4 | `tutor-weekly-feedback` | Dedicated Weekly Feedback per Module | `ModuleFeedbackSession` | `conductedPercent` from `calculateFeedbackCompliance` (Phase 1) — sessions marked `conducted` vs. sessions expected. |
| 5 | `tutor-feedback-documented` | Feedback Documented | `ModuleFeedbackSession.documentationComplete` | `documentedPercent` from `calculateFeedbackCompliance`. |
| 6 | `tutor-feedback-reaching-students` | Documented Feedback Reaching Students | `FeedbackRecord.feedbackEmailSent` | % of the tutor's individual per-student `FeedbackRecord`s with `feedbackEmailSent = true`. Deliberately distinct from KPI 7: this is per-student record delivery, not session-level. |
| 7 | `tutor-feedback-emails-sent` | Feedback Emails Sent | `ModuleFeedbackSession.emailSent` | `emailedPercent` from `calculateFeedbackCompliance` — session-level confirmation, manually ticked (no real email dispatch exists in this build, per the task's Phase 1 instruction). |
| 8 | `tutor-at-risk-actioned` | At-Risk Students Identified & Actioned | `AttendanceRecord` (via `calculateRollingAttendance`) + `AttendanceActionPlan` | % of the tutor's watchlist students (rolling attendance `warningLevel !== 'On Track'`) who have at least one `AttendanceActionPlan`. |
| 9 | `tutor-attendance-recording` | Daily Attendance Recording | `AttendanceRecord`, `Holiday` | % of scheduled teaching days (Mon–Fri since semester start, minus holidays) on which at least one attendance record exists for one of the tutor's modules. |
| 10 | `tutor-attendance-threshold` | Students at or Above 75% Attendance | `AttendanceRecord` (via `calculateRollingAttendance`) | % of (student, module) rows for the tutor's modules with `warningLevel !== 'Critical'` (the ICAT-internal 75% floor from Phase 2, not the university's). |
| 11 | `tutor-industry-experts` | ≥2 Industry Experts per Module | `IndustryEngagement` | `calculateIndustryEngagementCoverage` restricted to the tutor's active modules — % of those modules with ≥2 engagements that reached a "delivered" pipeline stage (Student Exposure / Document Outcome / Maintain Relationship), not just any logged contact. |
| 12 | `tutor-pass-rate` | 100% Pass | `Submission.grade.numericScore` | % of graded submissions in the tutor's modules with score ≥ 40 (the existing "Poor" cutoff from `GRADE_RANGES` in `TutorDashboard.tsx`, reused rather than inventing a new pass mark). |
| 13 | `tutor-above-60` | ≥50% Students Above 60% | `Submission.grade.numericScore` | % of graded submissions ≥ 60, target 50%. |
| 14 | `tutor-above-80` | ≥20% Students Above 80% | `Submission.grade.numericScore` | % of graded submissions ≥ 80, target 20%. |
| 15 | `tutor-weekly-report-hod` | Weekly Report to HOD | *(none)* | **No Data.** No entity in the codebase tracks tutor→HOD status-report submission. See Gaps below. |
| 16 | `tutor-student-posts` | ≥25% Students Posting ≥10 Module Posts | *(none)* | **No Data.** No discussion/posting feature exists anywhere in the app. See Gaps below. |

---

## 2. HOD-Only KPIs (11)

Scoped to the HOD's department(s) via `getHodDepartments(hodId)` (the hardcoded
staff-ID→department map in `data.ts`), falling back to all curriculum modules if the id
isn't mapped — same convention used everywhere else in the app.

| # | kpiId | Label | Backing entity | Computation |
|---|-------|-------|-----------------|-------------|
| 1 | `hod-quality-control` | Departmental Quality Control | `AssignmentBrief` | % of the department's active modules with a quality (outcomes + complete weekly schedule) Published brief. |
| 2 | `hod-rvj-audit` | RVJ Quality Audit | `RvjAssessment.auditedByHod` | % of the department's RVJ assessments the HOD has audited. |
| 3 | `hod-attendance-monitoring` | Daily Attendance Monitoring | `AttendanceRecord` | % of scheduled teaching days with a recorded session, across all department modules (same scheduled-days logic as tutor KPI 9, department-wide). |
| 4 | `hod-industry-alumni` | Industry & Alumni Engagement | `IndustryEngagement` | Same ≥2/module coverage calc as tutor KPI 11, department-wide. *(Alumni engagement has no dedicated tracking entity — see Gaps; this KPI currently measures the industry half only.)* |
| 5 | `hod-cross-dept` | Cross-Department Collaboration | `FinalYearProject.crossDepartmentCollaboration` | % of department final-year projects flagged cross-department. **Target 20% is an informal default, not given by the task — flagged for DRAO replacement.** |
| 6 | `hod-sdg-projects` | SDG / Social-Impact Projects | `FinalYearProject.sdgLinkage` | % of department projects with a non-empty SDG/social-impact linkage. **Target 20% is an informal default.** |
| 7 | `hod-award-pipeline` | Award Pipeline (≥1 Submitted Externally) | `FinalYearProject.submittedExternally` | Binary (100/0): does the department have ≥1 project submitted externally this year? Via `calculateAwardPipelineStatus`. |
| 8 | `hod-entrepreneurial` | Entrepreneurial Potential Identified | `FinalYearProject.entrepreneurialPotential` | % of department projects rated Medium or High. **Target 30% is an informal default.** |
| 9 | `hod-portfolio-reviews` | Portfolio Reviews (Tracked Final-Year Students) | `PortfolioReview`, `FinalYearProject`, `PlacementReadinessStatus` | % of the department's *tracked* final-year students (those with a `FinalYearProject` or `PlacementReadinessStatus` record — see denominator note below) who have ≥1 `PortfolioReview`. |
| 10 | `hod-placement-readiness` | Tracked Final-Year Students Placed or on a Documented Track | `PlacementReadinessStatus` | Reused verbatim from Phase 4's `calculatePlacementReadinessRate` via the `rekey` helper (see Design Notes) — % Placed or with a non-empty `documentedTrack`, department-scoped. |
| 11 | `hod-social-media` | Social Media Engagement | *(none)* | **No Data.** No entity tracks social-media activity. See Gaps below. |

**Denominator note (KPI 9 and the equivalent VP KPI):** there is no reliable signal
anywhere in `Module`/`User` for how many years a given program runs, so "final-year
student" cannot be auto-detected. Rather than guess and risk a silently wrong
denominator, the denominator is *students staff have actually started tracking* — i.e.
who already have a `FinalYearProject` or `PlacementReadinessStatus` record. This
under-counts true coverage until staff begin tracking a given cohort, but never
overstates it.

---

## 3. Vice Principal KPIs (19)

The task gave these only as 6 category phrases (attendance oversight; bi-monthly cycle
completion; action-point closure ≥90%; satisfaction improvement; quality audits; HOD
accountability; placement oversight — 7 phrases, one of which folds placement in with
the others) plus a total count of 19. The breakdown into 19 named, individually
computed KPIs below is my own decomposition and should be reviewed by the VP/DRAO
against actual institutional practice.

### Attendance oversight (3)
| kpiId | Label | Computation |
|---|---|---|
| `vp-campus-attendance` | Campus-Wide Attendance | Average rolling attendance % across every tracked (student, batch) row campus-wide. Target 85% — the ICAT-internal threshold from Phase 2. |
| `vp-attendance-above-critical` | Students at or Above Critical Attendance | % of tracked students not in the `Critical` band. |
| `vp-systemic-alerts-resolved` | Systemic Attendance Alerts Resolved | % of `SystemicAttendanceAlert` records with `status = 'Resolved'`. |

### Bi-monthly cycle completion (3)
| kpiId | Label | Computation |
|---|---|---|
| `vp-cycle-response-coverage` | Latest Cycle Response Coverage | % of all students who submitted a survey in the most recent `FeedbackCycle`. |
| `vp-cycle-cadence` | Feedback Cycles Opened (Last 12 Months) | Count of `FeedbackCycle`s started in the trailing 12 months, target **6** — a direct reading of "bi-monthly" (12 ÷ 2), not a number stated separately in the task. |
| `vp-dept-representation` | Departments Represented in Latest Cycle | % of HOD-mapped departments with ≥1 survey response in the latest cycle. |

### Action-point closure (2)
| kpiId | Label | Computation |
|---|---|---|
| `vp-action-closure` | Action Points Closed Within Timeline | Reused verbatim (via `rekey`) from Phase 3's `calculateActionPointClosureRate` — the task's own explicit ≥90%-on-time KPI, with its own bespoke status rule (see Design Notes). |
| `vp-action-not-escalated` | Action Points Not Escalated | % of `ActionPoint`s not in `Escalated` status. |

### Satisfaction improvement (2)
| kpiId | Label | Computation |
|---|---|---|
| `vp-satisfaction-trend` | Satisfaction Trend (Latest vs. Prior Cycle) | Latest cycle's average `SurveyResponse.rating` vs. the prior cycle's, unit `rating` (out of 5). |
| `vp-categories-improving` | Feedback Categories Improving Cycle-on-Cycle | Of the 13 `CYCLE_FEEDBACK_CATEGORIES` with data in both the latest and prior cycle, % whose average rating did not decrease. |

### Quality audits (3)
| kpiId | Label | Computation |
|---|---|---|
| `vp-rvj-audit-coverage` | RVJ Audit Coverage (Campus) | % of all `RvjAssessment`s audited by an HOD or the VP (`auditedByHod \|\| auditedByVp`). |
| `vp-portfolio-review-coverage` | Portfolio Review Coverage (Campus) | Same tracked-student-denominator logic as HOD KPI 9, campus-wide. |
| `vp-feedback-doc-compliance` | Weekly Feedback Documentation Compliance (Campus) | Campus-wide sessions documented ÷ sessions conducted, from `calculateFeedbackCompliance`. |

### HOD accountability (3)
| kpiId | Label | Computation |
|---|---|---|
| `vp-hod-feedback-compliance` | HOD-Taught Module Feedback Compliance | Average `conductedPercent` across HODs, from their own feedback-compliance rows — i.e. HODs are held to the same weekly-feedback standard as tutors on modules they personally teach, with **no exemption**, per the task's explicit instruction. |
| `vp-hod-attendance` | HOD-Taught Module Attendance ≥75% | % of (student, HOD-taught-module) rows not in the `Critical` attendance band. |
| `vp-hods-meeting-own-target` | HODs Meeting Their Own Tutor-Standard Target | % of teaching HODs whose own `conductedPercent` (weekly feedback) is 100%. |

### Placement oversight (3)
| kpiId | Label | Computation |
|---|---|---|
| `vp-placement-oversight` | Tracked Final-Year Students Placed or on a Documented Track | Reused verbatim (via `rekey`) from `calculatePlacementReadinessRate`, campus-wide. |
| `vp-award-mentoring` | Projects Identified for Extra Award Mentoring | Reused verbatim (via `rekey`) from `calculateAwardPipelineStatus.mentoringKpi` — campus-wide count vs. the task's stated target of ≥3. |
| `vp-dept-award-target` | Departments Meeting Award Submission Target | % of departments (derived from `FinalYearProject.batch`) with ≥1 project submitted externally this year — the task's ≥1/department/year target. |

---

## 4. Design Notes

**`KraDataBag`.** All three aggregator functions take one broad context object rather
than a long parameter list, because they are dashboard aggregators pulling from ~20
collections, not narrow calculators. Each dashboard component passes its entire
`useApp()` return value directly; TypeScript's structural typing accepts the extra
fields (event handlers, setters) that `KraDataBag` doesn't declare, since excess-property
checks only apply to object literals, not variables.

**Reused-KPI status preservation (`rekey`).** Four KPIs above (`hod-placement-readiness`,
`vp-action-closure`, `vp-placement-oversight`, `vp-award-mentoring`) are computed by
calling straight into an existing Phase 1–4 function rather than recomputing the number
from scratch. Each of those functions has its own hand-tuned `status` rule — e.g.
`calculateActionPointClosureRate` uses an absolute 15-point margin for "At Risk";
`calculateAwardPipelineStatus`'s mentoring KPI treats *any* count ≥1 as "At Risk" even
far below target, because identifying even one mentoring-worthy project is meaningfully
different from identifying zero. Phase 5 introduces its own generic ratio-based status
rule (`kpiStatus`: ≥100% of target → On Track, ≥70% → At Risk, else Off Track) for its
*own* new KPIs. Piping a reused KPI back through that generic rule would silently
override the original function's own logic — this was caught during synthetic-data
testing (`vp-award-mentoring` with actual=1, target=3 was showing "Off Track" under the
generic 70%-ratio rule, when the original logic says "At Risk" for any count ≥1). The
`rekey` helper fixes this by copying the reused `KpiResult` and only replacing its
`kpiId`, leaving `status` exactly as the original function computed it.

**File placement.** `kpiService.ts` grew to ~710 lines with the Phase 5 additions,
past the ~600-line soft threshold the task set for splitting analytics work into a
dedicated KPI file. It was kept as one file rather than split further: the three
aggregator functions and their Phase 5 helpers (`makeKpi`, `kpiStatus`, `pct`,
`hasQualityBrief`, `isModuleInDepartments`, `scheduledTeachingDays`,
`attendanceRecordingRate`, `gradesForModules`, `activeModulesFor`,
`departmentStudentsFor`) share enough internal state and helpers that splitting further
would mean exporting implementation details across files for no real decoupling
benefit.

---

## 5. Known Gaps (No Data by design)

These KPIs return `status: 'No Data'` because no entity anywhere in the codebase
tracks the underlying activity. They are not bugs — inventing a number here would be
worse than admitting the gap.

| KPI | What's missing | What would close the gap |
|---|---|---|
| `tutor-weekly-report-hod` (Weekly Report to HOD) | No entity records tutor→HOD status-report submission. | A `TutorWeeklyReport` (or similar) entity with `tutorId`, `weekNumber`, `submittedAt`, `hodAcknowledgedAt`, plus a submission UI on `TutorDashboard.tsx` and an inbox on `HodDashboard.tsx`. |
| `tutor-student-posts` (≥25% Students Posting ≥10 Module Posts) | No discussion/posting feature exists in the app at all. | A module-level discussion/post feature (new entity + UI), or, if this KPI refers to an external LMS/forum, an integration or manual-import path to bring that count in. |
| `hod-social-media` (Social Media Engagement) | No entity tracks social-media activity (posts, reach, engagement). | A lightweight `SocialMediaActivity` entity (platform, postCount, engagementMetric, period) with manual logging, since there's no realistic in-app way to measure real social platforms without an external API integration. |
| `hod-industry-alumni` (alumni half only) | `AlumniRecord` (added Phase 4) has no field linking an alumnus back to an *engagement event* — it captures who they are (institutionally-appropriate fields only, per the task's explicit "do not add personal data beyond this"), not what they did with the department this period. | Either an `AlumniEngagement` join entity (alumniId, type, date, moduleCode) analogous to `IndustryEngagement`, or extending `IndustryEngagement` with an optional `alumniId` so alumni-led sessions are already counted there. |

---

## 6. Judgment Calls Requiring DRAO/Institutional Review

Summarized here for convenience; each is also flagged in-line as a code comment at the
point it's made in `kpiService.ts`.

1. **VP's 19-KPI breakdown** (§3 above) is my own decomposition of 6-7 category phrases
   into named KPIs — not given item-by-item by the task. The category groupings,
   individual KPI definitions, and which entity backs each are all judgment calls.
2. **HOD's 11-KPI breakdown** — same situation, one level down: the task gave 11
   category phrases, not named items.
3. **Bi-monthly cadence read as 6 cycles/year** (`vp-cycle-cadence`) — a literal reading
   of "bi-monthly," not a number stated separately.
4. **Informal HOD targets**: cross-department collaboration (20%), SDG/social-impact
   projects (20%), entrepreneurial potential identified (30%) — none of these numeric
   targets were given by the task; they're reasonable defaults pending real
   institutional figures.
5. **"Tracked final-year student" denominator** (portfolio review and placement KPIs,
   both HOD and VP grain) — defined as "has a `FinalYearProject` or
   `PlacementReadinessStatus` record" rather than an auto-detected final-year cohort,
   since no reliable per-program year-count signal exists. This under-counts true
   coverage until staff begin tracking a cohort.
6. **Action-point "due for measurement" definition** (`calculateActionPointClosureRate`,
   Phase 3) — an action point counts toward the ≥90% closure KPI once it's Closed,
   Escalated, or past its deadline while still open; points not yet at their deadline
   are excluded as not yet measurable. "Closed on time" uses `updatedAt` as the closure
   timestamp.
7. **Pass mark for `tutor-pass-rate`/`hod`/`vp` grade-band KPIs** — reused the existing
   `GRADE_RANGES` "Poor" cutoff (score < 40) from `TutorDashboard.tsx` as the pass/fail
   line, rather than inventing a new one.
8. **Reused-KPI status preservation via `rekey`** (Design Notes §4) — a deliberate
   choice to keep four KPIs' bespoke status logic from Phase 1-4 rather than recompute
   them under Phase 5's generic ratio rule. Worth double-checking that the *display*
   (same generic tile styling applied to a differently-computed status) doesn't read as
   inconsistent to an end user, even though the underlying logic is intentional.
9. **Department derivation from `FinalYearProject.batch`** — takes the
   `programTitle` portion of the `"{programTitle} • Year {n}"` batch label as a
   department proxy. This matches the batch-label convention used everywhere else in
   the app, but was never a formally modeled "department" field on the project itself.
