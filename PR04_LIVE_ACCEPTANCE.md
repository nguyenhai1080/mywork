# PR04 live acceptance — 2026-09-10

Environment: DEV v9; browser interactions and real 90_AUDIT_LOG inspected. Follow-up UI guard tested automatically and included in next DEV version.

Test data retained: PRJ0001 ([PR04 TEST] Weighted progress acceptance); TSK000010 A, TSK000011 B, TSK000012 C. No existing user task was changed.

PASS: create project and reload; create project tasks with correct ProjectID/SourceType; completed A at weight 1 with B weight 3 yields 25%, reload preserves it; B weight 3→2 and SortOrder 0→1 yields 33.33%; child C at 50% gives parent B 50% and project 66.67%, reopening Web preserves 66.67%; cycle B→C rejected; My Work shows C with project name and Next Action; Edit Project TargetDate 30 Sep→1 Oct persists.

Audit evidence: AUD0000053 Project CREATE; AUD0000054/64/69 task CREATE; AUD0000065–68 A result; AUD0000070/71 Weight and SortOrder share OP-20260909-230829-618824; AUD0000072–76 C result; AUD0000077/78 Project Description and TargetDate share OP-20260910-082809-9F4022. No ParentTaskID change recorded for rejected cycle.

Automated regression: 53 tests PASS (19 Project backend, 18 My Work, 14 H01 backend/syntax, 1 H01 UI, 1 completed-parent UI guard).

Limits: valid reparent to a different parent has not been exercised in live UI; cross-project rejection/rollback failure injection covered by mocks. Project.Progress is calculated on reads; Sheet progress snapshot remains out of scope. Project lifecycle/health/milestones remain later scope. Not merged to develop.
