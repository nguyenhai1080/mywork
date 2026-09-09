function taskRepoList_() {
  return getSheetObjects_(MYWORK.SHEETS.TASKS);
}

function taskRepoFind_(taskId) {
  return findRecordById_(MYWORK.SHEETS.TASKS, 'TaskID', taskId);
}

function taskRepoInsert_(record) {
  return appendRecord_(MYWORK.SHEETS.TASKS, record);
}

function taskRepoUpdate_(rowNumber, patch) {
  const sheet = getSheet_(MYWORK.SHEETS.TASKS);
  const headers = getHeaders_(sheet);
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('Invalid task row: ' + rowNumber);
  }
  // Validate every field before writing any cell.
  const fields = Object.keys(patch);
  fields.forEach(field => {
    if (headers.indexOf(field) === -1) throw new Error('TASKS field not found: ' + field);
    if (headers.indexOf(field) !== headers.lastIndexOf(field)) throw new Error('Duplicate TASKS field: ' + field);
  });
  fields.forEach(field => {
    sheet.getRange(rowNumber, headers.indexOf(field) + 1).setValue(patch[field]);
  });
  SpreadsheetApp.flush();
  const persisted = rowToObject_(headers, sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]);
  fields.forEach(field => {
    const expected = serializeRecordForClient_(patch)[field];
    const actual = serializeRecordForClient_(persisted)[field];
    if (String(expected) !== String(actual)) throw new Error('Task update did not persist field: ' + field);
  });
  return persisted;
}

function taskResultRepoAppend_(record) {
  return appendRecord_(MYWORK.SHEETS.TASK_RESULTS, record);
}

function taskResultRepoList_(taskId) {
  return getSheetObjects_(MYWORK.SHEETS.TASK_RESULTS)
    .filter(result => String(result.TaskID) === String(taskId))
    .sort((a, b) => dateTimeSortValue_(b.CreatedAt) - dateTimeSortValue_(a.CreatedAt));
}

function dateTimeSortValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.getTime();
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
