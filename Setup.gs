function setupMyWorkV1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Run setupMyWorkV1() from the bound MyWork spreadsheet.');
  }
  PropertiesService.getScriptProperties().setProperty(MYWORK.PROPERTIES.DB_SPREADSHEET_ID, ss.getId());
  const schemas = getMyWorkSchemas_();

  Object.keys(schemas).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = schemas[sheetName];

    // PR01A setup is intended for a new/empty workbook.
    // Re-running it will reset the managed sheets.
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, headers.length);
  });

  seedCounters_();
  seedSettings_();
  ensureCurrentUser_();

  console.log('MyWork database initialized successfully. Version: ' + MYWORK.VERSION);
}

function getMyWorkSchemas_() {
  const S = MYWORK.SHEETS;
  const schemas = {};

  schemas[S.SETTINGS] = [
    'Key',
    'Value',
    'Description'
  ];

  schemas[S.USERS] = [
    'UserID',
    'FullName',
    'Email',
    'Department',
    'Position',
    'TimeZone',
    'Role',
    'IsActive',
    'CreatedAt',
    'UpdatedAt'
  ];

  schemas[S.TASKS] = [
    'TaskID',
    'TaskTitle',
    'Description',
    'SourceType',
    'ProjectID',
    'ParentTaskID',
    'OwnerID',
    'AssignedBy',
    'AssignedDate',
    'StartDate',
    'DueDate',
    'CompletedDate',
    'Priority',
    'Status',
    'Progress',
    'ExpectedOutput',
    'Weight',
    'SortOrder',
    'NextAction',
    'NextActionDue',
    'WaitingFor',
    'FollowUpDate',
    'IsArchived',
    'CreatedBy',
    'CreatedAt',
    'UpdatedAt'
  ];

  schemas[S.TASK_RESULTS] = [
    'ResultID',
    'TaskID',
    'UpdateDate',
    'ProgressBefore',
    'ProgressAfter',
    'StatusBefore',
    'StatusAfter',
    'CompletedWork',
    'PendingWork',
    'IssuesConstraints',
    'WaitingFor',
    'NextAction',
    'NextActionDue',
    'FollowUpDate',
    'ProgressChangeReason',
    'UpdatedBy',
    'CreatedAt'
  ];

  schemas[S.TASK_DEPENDENCIES] = [
    'DependencyID',
    'TaskID',
    'DependsOnTaskID',
    'CreatedAt'
  ];

  schemas[S.PROJECTS] = [
    'ProjectID',
    'ProjectName',
    'Description',
    'Objective',
    'ExpectedOutput',
    'OwnerID',
    'Sponsor',
    'StartDate',
    'TargetDate',
    'CompletedDate',
    'Priority',
    'Status',
    'Progress',
    'SystemHealth',
    'OwnerHealth',
    'HealthOverrideReason',
    'NextMajorAction',
    'NextActionDue',
    'CompletionReason',
    'IsArchived',
    'CreatedBy',
    'CreatedAt',
    'UpdatedAt'
  ];

  schemas[S.PROJECT_MILESTONES] = [
    'MilestoneID',
    'ProjectID',
    'MilestoneName',
    'Description',
    'TargetDate',
    'CompletedDate',
    'Status',
    'RelatedTaskID',
    'IsRequired',
    'Note',
    'CreatedAt',
    'UpdatedAt'
  ];

  schemas[S.PROJECT_UPDATES] = [
    'ProjectUpdateID',
    'ProjectID',
    'UpdateDate',
    'Assessment',
    'KeyAchievements',
    'PendingWork',
    'IssuesConstraints',
    'NextMajorAction',
    'NextActionDue',
    'HealthOverrideReason',
    'UpdatedBy',
    'CreatedAt'
  ];

  schemas[S.AUDIT_LOG] = [
    'AuditID',
    'EntityType',
    'EntityID',
    'Action',
    'FieldName',
    'OldValue',
    'NewValue',
    'UserID',
    'OperationID',
    'CreatedAt'
  ];

  schemas[S.COUNTERS] = [
    'Entity',
    'Prefix',
    'CurrentValue',
    'Digits'
  ];

  return schemas;
}

function seedCounters_() {
  const sheet = getSheet_(MYWORK.SHEETS.COUNTERS);

  const rows = [
    ['TASK', 'TSK', 0, 6],
    ['TASK_RESULT', 'RES', 0, 6],
    ['PROJECT', 'PRJ', 0, 4],
    ['MILESTONE', 'MLS', 0, 4],
    ['PROJECT_UPDATE', 'PUP', 0, 4],
    ['DEPENDENCY', 'DEP', 0, 6],
    ['AUDIT', 'AUD', 0, 7],
    ['USER', 'USR', 0, 4]
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function seedSettings_() {
  const sheet = getSheet_(MYWORK.SHEETS.SETTINGS);

  const rows = [
    ['APP_VERSION', MYWORK.VERSION, 'Current MyWork version'],
    ['DEFAULT_TIMEZONE', Session.getScriptTimeZone(), 'Default application timezone'],
    ['DUE_SOON_DAYS', '3', 'Number of days used for due-soon calculation']
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function migrateMyWorkPR02A() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Run migrateMyWorkPR02A() from the bound MyWork spreadsheet.');
  }

  const requiredSheets = Object.values(MYWORK.SHEETS);
  const missing = requiredSheets.filter(name => !ss.getSheetByName(name));
  if (missing.length) {
    throw new Error('PR02A migration stopped. Missing required sheets: ' + missing.join(', ') + '. Run setupMyWorkV1() only on a new DEV workbook.');
  }

  PropertiesService.getScriptProperties().setProperty(MYWORK.PROPERTIES.DB_SPREADSHEET_ID, ss.getId());
  upsertSetting_('APP_VERSION', MYWORK.VERSION, 'Current MyWork version');
  ensureCurrentUser_();

  console.log('MyWork PR02A migration completed. Database ID configured: ' + ss.getId());
}

function upsertSetting_(key, value, description) {
  const sheet = getSheet_(MYWORK.SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(key)) {
        sheet.getRange(i + 2, 1, 1, 3).setValues([[key, value, description || values[i][2] || '']]);
        return;
      }
    }
  }

  sheet.appendRow([key, value, description || '']);
}
