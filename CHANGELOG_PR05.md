# PR05 — Market Contacts

Branch: feature/pr05-market-contacts.

## Features
- Market list, search by country/code/operator/contact/phone/email, market detail and add/edit forms.
- Multiple contacts per market, exactly one primary when active contacts exist. First contact is primary; selecting another demotes the old primary. Deactivating the primary promotes the first remaining active contact. Inactive contacts remain editable.
- Country, short name, operator, currency, manual exchange rate (1 USD = local currency), effective date and notes. Rate is optional; a rate requires currency and valid date. No automatic FX lookup.
- Contact name, role, telephone, email, preferred channel, note, active/primary flags. Phone stored as text.
- Header validation, lock, persisted-record readback, audit and rollback on save failure. UI refreshes from response records.

## Additive initialization
Market Contacts → Get started creates only 30_MARKETS and 31_MARKET_CONTACTS. Existing tabs are validated and never cleared. Do not run setupMyWorkV1 on the existing workbook. UUID IDs require no new counters. Existing Task/Project schemas remain unchanged.

## Files changed
New: MarketService.gs, MarketJS.html, tests/pr05-market.test.cjs, tests/pr05-market-ui.test.cjs, tests/RESULTS_PR05.txt, CHANGELOG_PR05.md.
Modified: AppJS.html (routing/events/refresh), Index.html (navigation/include/UTF-8), Styles.html (contacts/table), Config.gs (version).

## Validation
72 automated checks PASS: 53 H01/PR03/PR04 + 17 market backend + 2 market UI. Syntax checked for GS, AppJS and MarketJS. Local browser verified list/detail, adding a second contact as primary, preserving phone plus/leading zeros and saving a dated USD exchange rate. These local checks use mock Sheets; live checks are recorded separately below.

## Live checklist
1. Initialize twice; existing Tasks/Projects and new contact data remain intact.
2. Create/edit market; duplicate code and invalid rates rejected.
3. Add two contacts; choose second as primary; confirm exactly one primary.
4. Save phone with + and leading zeros; reopen and compare exact text.
5. Deactivate primary; another active contact becomes primary.
6. Reload Web App and check saved records in both new Sheet tabs.
7. Check MARKET / MARKET_CONTACT audit: before/after, actor and shared OperationID when primary changes.

The user's screenshot has not been imported; no real contact records are bundled in source control. Test exchange rates are synthetic.

## DEV v11 verification — 2026-09-10
Deployment updated successfully to version 11. Additive initialization succeeded from Web App. Live test market TEST05 / MKT-33157f00-982f-44b4-ba9e-3d0e537ca0c4 persisted across reopening the Web App. Two contacts persisted in 31_MARKET_CONTACTS: Contact A (CON-8dd0976c-492e-491f-8d45-608b85761612) with phone +00123 45678 and Contact B (CON-0c4af426-8e90-49d4-80de-5f807698e085). Selecting B as primary demoted A, confirmed by direct Sheet read.
Audit: AUD0000082 MARKET CREATE; AUD0000083 contact A CREATE; AUD0000084 contact B CREATE and AUD0000085 A IsPrimary TRUE→FALSE share OP-20260910-164548-33C402. Test records retained and clearly named [PR05 TEST]. No real user contact data imported.
Live rate editing and inactive promotion have not been exercised on DEV; covered in local browser/backend tests respectively. Not merged into develop.
