# PR03 - My Work

## Objective
Turn live Task Core data into a daily execution view: Need Attention, Today, Upcoming and Waiting.

## New files
- `MyWorkService.gs`
- `MyWorkApi.gs`
- `CHANGELOG_PR03.md`

## Changed files
- `Config.gs` - version bumped to `1.0.0-dev-pr03`
- `AppJS.html` - live My Work UI, filters, quick Update Result integration
- `Styles.html` - My Work card/section styling matching the PWM-inspired UI
- `README.md` - PR03 deployment/test notes

## Migration
None. PR03 uses the existing Task schema.

## Classification order
1. Need Attention
2. Today
3. Upcoming
4. Waiting

A task appears in exactly one section.

## Acceptance tests
- MW01 Overdue -> Need Attention
- MW02 Follow-up today -> Need Attention
- MW03 Follow-up overdue -> Need Attention
- MW04 Next Action overdue -> Need Attention
- MW05 Due today -> Today unless escalated by a higher-priority attention rule
- MW06 Next Action due today -> Today
- MW07 Due/next action in 1-7 days -> Upcoming
- MW08 Waiting + future/no follow-up -> Waiting
- MW09 Waiting + follow-up due -> Need Attention
- MW10 Completed hidden
- MW11 Cancelled hidden
- MW12 Project task shows project context
- MW13 Multiple conditions -> one section only
- MW14 Task update -> My Work reclassifies after refresh
- MW15 Date calculations use Apps Script project timezone

## Rollback
Revert the PR03 commit. No database rollback is required.
