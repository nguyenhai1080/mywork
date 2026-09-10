# PR04 — Project Core

Branch: feature/pr04-project-core. Migration: NONE. Do not run setupMyWorkV1 on the existing workbook.

## Delivered
- Live Projects list and Dashboard project overview replace demo data.
- Create/Edit Project: name, description, objective, expected output, owner, sponsor, priority, start/target dates. Header validation, read-back, audit and compensating rollback.
- Project WBS: create task/subtask, open existing Task drawer for result updates, move parent, edit relative weight and sort order.
- Task create validates project/parent inside its existing lock; prevents cross-project parents and adding to terminal parents/projects. WBS edits prevent cycles.
- Weight is positive, defaults to 1. At each level: sum(child progress × child weight) / sum(child weight). Parent's manually entered progress is not counted if it has children. Empty project = 0. Cancelled/archived items excluded; their active children become roots. Completed leaves = 100.
- API returns calculated Project.Progress and WBS CalculatedProgress from current task data. Existing 20_PROJECTS.Progress is not a maintained snapshot in this phase; do not use that cell as the live aggregate. Project lifecycle/health automation, milestones and project reports remain later scope.
- Project task still participates in Tasks/My Work using PR03 behavior.

## Files changed
Config.gs, TaskService.gs, AppJS.html, Styles.html, README.md.
New: ProjectRepository.gs, ProjectService.gs, ProjectApi.gs, tests/pr04-project.test.cjs, tests/pr04-parent-ui.test.cjs, tests/RESULTS_PR04.txt, CHANGELOG_PR04.md, PR04_LIVE_ACCEPTANCE.md.

## Validation
53 automated checks PASS, including Project Core, H01/PR03 regression, syntax and completed-parent UI guard. DEV v10 live acceptance PASS: real Sheet audit, project create/edit, weighted nested WBS, valid reparent both directions, cycle rejection, reload and My Work context. See PR04_LIVE_ACCEPTANCE.md for evidence.

## DEV checklist
1. Create project with owner, Start Date 09/09/2026, Target Date 30/09/2026. Verify 20_PROJECTS and CREATE audit. Reload retains project.
2. Edit project name/target date; verify before/after audit. Earlier target date is rejected.
3. Add top-level tasks A (weight 1), B (weight 3). Verify ProjectID/SourceType=PROJECT in 10_TASKS.
4. Update A to Completed via Task drawer with final result. Project progress becomes 25%; reload retains 25%.
5. Add children under a nonterminal parent. Parent WBS progress follows weighted children without double counting its own Progress.
6. Structure: change weight/order/parent; verify UPDATE_WBS audit, WBS numbering and recalculation.
7. Try moving a parent under its descendant: error, task row unchanged.
8. Project task due today appears in My Work with project name; Update Result still works; H01 dates still persist.

Do not merge develop until DEV acceptance passes. Rollback Web App to v8 if needed; no data deletion/migration required.

## DEV follow-up 2026-09-10
Live acceptance and audit evidence: PR04_LIVE_ACCEPTANCE.md. Added UI guard to prevent completed parent selection from silently becoming a top-level task. 53 automated checks pass.
