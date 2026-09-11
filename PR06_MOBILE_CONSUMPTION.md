# PR06 — Tiêu dùng di động

## Behavior
Manage actual and plan by market, year and month in thousand USD. Enter service amounts or total plus shares; paste a table from Excel or import normalized JSON after preview. Reports show monthly and year-to-date totals, plan achievement, MoM, YoY, Data share and a 12-month market trend. CSV export reflects the selected report.

Source totals take precedence: mismatched service breakdowns remain Draft, are visibly flagged and cannot be finalized. Missing values are not zero. Shares for aggregated periods are calculated from sums. Incomplete periods do not appear as complete totals. Annual-only history uses Month 0 and is never added to monthly history.

## Source policy approved by user
- TD thuc.xlsx values are already thousand USD.
- VBD maps to VTB; exclude VTCM from child market imports and retain VTC only. VTG original totals are retained unchanged even when their source formulas include VTCM.
- TH 2026 is actual 2026.
- Preserve cached formula results; do not refresh external links.
- Keep original total when components differ. Import 1,528 historical records, including 103 flagged for reconciliation, as Draft.
- 2012/2013 annual-only records remain annual; do not invent monthly allocations.

## Files changed
- AuditService.gs: reserve audit IDs and write/verify audit batches under the existing lock.
- ConsumptionApi.gs: public Apps Script entry points.
- ConsumptionService.gs: additive 32_MOBILE_CONSUMPTION sheet, validation, preview, revision checks, locked batch writes, verification and audit rollback.
- ConsumptionJS.html: reports, monthly entry, import preview/save, revision history and CSV export.
- AppJS.html, Index.html, Styles.html: navigation, event routing and UI.
- Config.gs: PR06 DEV version.
- tools/extract_consumption_history.py: read-only converter for the approved TD thuc layout.
- tools/verify_consumption_import.py: read-only full comparison of an exported DB with source records and audit coverage.
- tests/pr06-consumption.test.cjs, tests/pr06-consumption-ui.test.cjs: backend/report/UI regression checks.
- tests/pr05-market-ui.test.cjs: include new module in the existing UI harness.

## Data and deployment
Two additive consumption sheets only; existing task/project/market schemas stay unchanged. Do not run setupMyWorkV1 against the live workbook. Initialize the module with its Start button once. The first preview identifies existing keys and their revisions; identical records are marked UNCHANGED and skipped; saving replaces only reviewed records at matching revision. A final record requires a change reason before update. Import runs in batches of 100; previously successful batches remain saved if a later batch fails. Preview again after an uncertain response.

Financial import JSON stays outside Git and the source archive. The converter is specific to the approved workbook layout, not a general XLSX importer. The Web App accepts pasted Excel columns and normalized JSON; exports CSV. Full XLSX upload/export is not part of this version.

## Test checklist
- [x] 103 automated checks across nine test files pass (mock Sheets).
- [x] Monthly and annual aggregates preserve missing vs zero and weighted shares.
- [x] Preserve source total; mark mismatch; reject finalizing unreconciled breakdown.
- [x] Prevent stale/duplicate writes; validate limits, periods and values.
- [x] Audit/readback failure rolls back the batch; physical blank rows do not shift updates.
- [x] Local browser: VTC actual January 2026 and plan entry by shares refresh correctly.
- [x] Live: initialize, preview and save 1,528 unique historical records.
- [x] Full exported Sheet comparison: 1,528 source records match all five amounts, periods, units, source and revision; 1,528 matching audit records; 103 flagged breakdowns.
- [x] Reloaded monthly/year-to-date report and mismatch indicator.

All source data values, including zeros returned by saved formulas, are retained. Review the flagged records before marking periods Final.

Deployment: Apps Script version 17, existing DEV deployment URL, 2026-09-11. Remote v11 backed up before push; all baseline files matched repository HEAD.

Verification evidence: PR06_live_verification.json (pass=true, errors=[]). Source VTC January 2026 = 32,498.573570907283 thousand USD; January–July 2026 = 224,093.06636193764 thousand USD.

## VTG parent report
Store 188 original VTG periods (including 8 annual actual/plan summaries) in 33_VTG_CONSUMPTION, separately from 1,528 child market periods. Select VTG in the market filter to compare original actual/plan, child sum, difference, service composition, monthly and annual reports. Full-year original summaries take precedence over monthly sums; never sum parent and children together. Missing-market coverage is displayed. All historical inputs remain Draft; 49 VTG breakdowns are flagged.

Additional files: ConsumptionGroupJS.html (parent reports and CSV), tools/extract_vtg_history.py (read-only extraction). ConsumptionService/JS, AppJS and Index route and persist the separate parent scope.

- [x] 188 VTG rows and 188 audit records independently match the source, all five values and revision 1.
- [x] Existing 1,528 market rows and audits still match after VTG import.
- [x] Live January 2026 VTG original and child sum both display 250,523.60 thousand USD.
- [x] Live full-year 2017 uses original 974,600.41, child sum 861,687.39, difference 112,913.03.
- [x] Annual matrix shows original 2012–2017 totals; no annual/monthly double counting.

Evidence: PR06_VTG_live_verification.json and PR06_live_verification.json, both pass=true with errors=[].
