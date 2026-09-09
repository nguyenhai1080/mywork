function projectRepoFind_(id) { return findRecordById_(MYWORK.SHEETS.PROJECTS, 'ProjectID', id); }
function projectRepoList_() { return getSheetObjects_(MYWORK.SHEETS.PROJECTS); }
function projectRepoWrite_(record, rowNumber) {
  const sheet = getSheet_(MYWORK.SHEETS.PROJECTS), headers = getHeaders_(sheet);
  Object.keys(record).forEach(field => {
    if (headers.indexOf(field) < 0 || headers.indexOf(field) !== headers.lastIndexOf(field)) throw new Error('Invalid project header: ' + field);
  });
  if (rowNumber) {
    Object.keys(record).forEach(field => sheet.getRange(rowNumber, headers.indexOf(field)+1).setValue(record[field]));
  } else {
    rowNumber = appendRecord_(MYWORK.SHEETS.PROJECTS, record);
  }
  SpreadsheetApp.flush();
  const persisted=rowToObject_(headers, sheet.getRange(rowNumber,1,1,headers.length).getValues()[0]);
  const expected=serializeRecordForClient_(record),actual=serializeRecordForClient_(persisted);
  Object.keys(record).forEach(field=>{if(String(expected[field])!==String(actual[field]))throw new Error('Project field did not persist: '+field);});
  return persisted;
}
