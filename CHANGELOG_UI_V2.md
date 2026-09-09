# PR03 UI V2 - MyWork Productivity UI

## Objective
Refactor the visual hierarchy of MyWork from a finance-dashboard style to a productivity workspace inspired by common task-management interaction patterns.

## Changed
- Compact navy sidebar and simplified header.
- Removed large hero/KPI surfaces from My Work and Tasks.
- My Work now uses dense sections: Need Attention, Today, Upcoming, Waiting.
- Tasks now use a dense list with status, deadline, progress and priority columns.
- Task detail opens in a right-side drawer.
- Projects use compact progress rows/cards.
- Dashboard remains the primary KPI/card surface.

## Backend / Schema
No changes.

## Migration
None.

## Rollback
Revert the UI V2 commit; PR03 backend remains compatible with the previous UI.
