# MyWork V1.0 - PR02A Task Core

Google Apps Script Web App using Google Sheets as the database.

This package builds on PR01B and implements the live Task Core while keeping the PWM-inspired UI style.

## V1.0 scope

Current priority modules:

- Tasks
- Projects

Navigation:

- My Work
- Tasks
- Projects
- Dashboard

PR02A makes the Tasks module live. Projects remain demo UI until PR04.

## PR02A features

### Task backend

- createTask
- listTasks
- getTask
- updateTaskMetadata
- addTaskResult
- completeTask
- reopenTask
- cancelTask
- task result history
- waiting / follow-up fields
- overdue and due-soon calculated flags
- audit log with OperationID
- LockService protection for write operations
- rollback compensation for multi-sheet write failures

### Task UI

- live Task List from `10_TASKS`
- filters: Active, In Progress, Waiting, Overdue, Completed, All
- local search
- New Task modal
- Task Detail page
- Edit Task modal
- Update Result modal
- dynamic Waiting fields
- progress decrease reason
- Complete Task modal
- Reopen Task modal
- Cancel Task modal
- Result History timeline
- responsive PWM-inspired UI

## Files

### Existing files changed in PR02A

- `Config.gs`
- `Db.gs`
- `Setup.gs`
- `Index.html`
- `Styles.html`
- `AppJS.html`
- `README.md`

### New files in PR02A

- `AuditService.gs`
- `TaskRepository.gs`
- `TaskService.gs`
- `TaskApi.gs`

### Unchanged

- `Code.gs`
- `appsscript.json`

## Database sheets

PR02A uses the existing PR01 schema. No new columns are required.

- `00_SETTINGS`
- `01_USERS`
- `10_TASKS`
- `11_TASK_RESULTS`
- `12_TASK_DEPENDENCIES`
- `20_PROJECTS`
- `21_PROJECT_MILESTONES`
- `22_PROJECT_UPDATES`
- `90_AUDIT_LOG`
- `99_COUNTERS`

## Important: existing PR01B workbook

Do NOT run `setupMyWorkV1()` again on an existing workbook with data. That setup function is destructive and clears managed sheets.

After replacing the source files with PR02A, run this safe one-time migration instead:

`migrateMyWorkPR02A()`

It does not clear task data. It only:

1. validates that required sheets exist;
2. stores the bound spreadsheet ID in Script Properties so the Web App can reliably reopen the database;
3. updates `APP_VERSION`;
4. ensures at least one active user exists.

## Fresh DEV workbook

For a brand-new disposable DEV workbook only:

1. Create a Google Spreadsheet.
2. Open Extensions -> Apps Script.
3. add all files in this package;
4. run `setupMyWorkV1()` once;
5. authorize;
6. deploy as Web App.

## Existing DEV workbook upgrade from PR01A/PR01B

1. Back up the Spreadsheet and Apps Script project.
2. Replace/add the files from this package.
3. Do NOT run `setupMyWorkV1()`.
4. Run `migrateMyWorkPR02A()` once.
5. Open `01_USERS` and confirm a user exists.
6. Deploy -> Manage deployments -> Edit -> New version.
7. Open the Web App.
8. Go to Tasks and create the first live task.

## Task business rules

### Status

- `NOT_STARTED`
- `IN_PROGRESS`
- `WAITING`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`

### Progress

- Not Started = 0%
- In Progress = 1-99%
- Waiting = 1-99%
- On Hold = 0-99%
- Completed = 100%
- Cancelled keeps current progress

### Result history

`11_TASK_RESULTS` is append-only from the UI/API. PR02A does not expose edit or delete operations for historical results.

### Waiting

When status is `WAITING`, `WaitingFor` is mandatory. `FollowUpDate` is optional in PR02A and will become a My Work trigger in PR03.

### Progress decrease

If Progress decreases, `ProgressChangeReason` is mandatory.

### Complete

Completing a task:

- forces progress to 100%;
- sets CompletedDate;
- clears Waiting/Follow-up and Next Action snapshot fields;
- appends a final Task Result.

### Reopen

Only Completed tasks can be reopened. Reopen requires:

- Reason
- Progress 1-99%
- Next Action

CompletedDate is cleared and a new Task Result is appended.

### Cancel

Cancellation requires a reason. Tasks are not hard-deleted.

## Current snapshot versus history

`10_TASKS` contains the current snapshot used by the UI:

- current Status
- current Progress
- current NextAction
- current WaitingFor
- current FollowUpDate

`11_TASK_RESULTS` keeps the historical updates.

Both are written under the same OperationID and protected with LockService.

## PR02A acceptance test

Use one real test task and perform the following sequence:

1. Create Task -> Not Started / 0%.
2. Update Result -> In Progress / 20%.
3. Update Result -> In Progress / 50%.
4. Update Result -> Waiting / 60%, set Waiting For and Follow-up.
5. Update Result -> In Progress / 80%.
6. Complete -> 100%.
7. Reopen -> 90%, add reason and Next Action.
8. Complete again.

Verify:

- [ ] Task List reads live data from Google Sheets.
- [ ] Task Detail shows the current snapshot.
- [ ] `11_TASK_RESULTS` contains every update.
- [ ] old result rows are not overwritten.
- [ ] `90_AUDIT_LOG` contains related OperationIDs.
- [ ] progress decrease without reason is rejected.
- [ ] Waiting without Waiting For is rejected.
- [ ] Complete forces 100%.
- [ ] Reopen clears CompletedDate.
- [ ] Cancel does not delete the task.
- [ ] refresh/reopen Web App preserves state.

## Rollback

PR02A does not require a sheet schema migration.

To rollback application code:

1. restore the PR01B source version;
2. deploy a new Web App version from that code.

Task data already created by PR02A remains compatible with the PR01 schema. Do not delete task/result sheets as part of code rollback.

## Next PR

PR03 will implement the My Work engine:

- Need Attention
- Today
- Upcoming
- Waiting
- Follow-up trigger
- Next Action trigger
- de-duplication between sections
