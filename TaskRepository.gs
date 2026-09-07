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
  return updateRecordRow_(MYWORK.SHEETS.TASKS, rowNumber, patch);
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
