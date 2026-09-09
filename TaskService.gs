function createTask_(payload, actor) {
  payload = payload || {};
  actor = actor || ensureCurrentUser_();

  const input = validateCreateTaskInput_(payload, actor);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  let taskRow = null;
  const auditSheet = getSheet_(MYWORK.SHEETS.AUDIT_LOG);
  const auditSafeRow = auditSheet.getLastRow();

  try {
    if (input.ProjectID) validateProjectTaskLink_(input.ProjectID,input.ParentTaskID,'',input.Weight);
    else if (input.ParentTaskID || input.SourceType === MYWORK.TASK_SOURCE.PROJECT) throw new Error('Project is required for a project task.');
    const now = new Date();
    const operationId = newOperationId_();
    const taskId = nextIdLocked_('TASK');

    const record = {
      TaskID: taskId,
      TaskTitle: input.TaskTitle,
      Description: input.Description,
      SourceType: input.SourceType,
      ProjectID: input.ProjectID,
      ParentTaskID: input.ParentTaskID,
      OwnerID: input.OwnerID,
      AssignedBy: input.AssignedBy,
      AssignedDate: input.AssignedDate,
      StartDate: input.StartDate,
      DueDate: input.DueDate,
      CompletedDate: '',
      Priority: input.Priority,
      Status: MYWORK.TASK_STATUS.NOT_STARTED,
      Progress: 0,
      ExpectedOutput: input.ExpectedOutput,
      Weight: input.Weight,
      SortOrder: input.SortOrder,
      NextAction: input.NextAction,
      NextActionDue: input.NextActionDue,
      WaitingFor: '',
      FollowUpDate: '',
      IsArchived: false,
      CreatedBy: actor.UserID,
      CreatedAt: now,
      UpdatedAt: now
    };

    taskRow = taskRepoInsert_(record);
    auditRecordLocked_('TASK', taskId, 'CREATE', '', '', record, actor.UserID, operationId);
    SpreadsheetApp.flush();

    return {
      task: serializeRecordForClient_(record),
      warnings: input.Warnings,
      operationId: operationId
    };
  } catch (error) {
    if (taskRow) {
      deleteRowSafe_(MYWORK.SHEETS.TASKS, taskRow);
    }
    deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG, auditSafeRow);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function listTasks_(filters) {
  filters = filters || {};
  let tasks = taskRepoList_().filter(task => !normalizeBoolean_(task.IsArchived));

  if (filters.status) {
    tasks = tasks.filter(task => String(task.Status) === String(filters.status));
  }

  if (filters.priority) {
    tasks = tasks.filter(task => String(task.Priority) === String(filters.priority));
  }

  if (filters.activeOnly) {
    tasks = tasks.filter(task => ![MYWORK.TASK_STATUS.COMPLETED, MYWORK.TASK_STATUS.CANCELLED].includes(String(task.Status)));
  }

  const query = String(filters.query || '').trim().toLowerCase();
  if (query) {
    tasks = tasks.filter(task => [
      task.TaskTitle,
      task.Description,
      task.AssignedBy,
      task.ExpectedOutput,
      task.NextAction,
      task.WaitingFor
    ].some(value => String(value || '').toLowerCase().indexOf(query) !== -1));
  }

  tasks.sort(compareTasksForList_);
  return tasks.map(serializeTaskSummary_);
}

function getTask_(taskId) {
  const found = taskRepoFind_(taskId);
  if (!found) {
    throw new Error('Task not found: ' + taskId);
  }

  const history = taskResultRepoList_(taskId);
  const task = serializeRecordForClient_(found.record);
  const latestResult = history.length ? serializeRecordForClient_(history[0]) : null;

  return {
    task: task,
    latestResult: latestResult,
    history: history.map(serializeRecordForClient_),
    calculated: buildTaskCalculated_(found.record)
  };
}

function updateTaskMetadata_(taskId, payload, actor) {
  payload = payload || {};
  actor = actor || ensureCurrentUser_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  const auditSafeRow = getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
  let originalRow = null;
  let taskRowNumber = null;

  try {
    const found = taskRepoFind_(taskId);
    if (!found) {
      throw new Error('Task not found: ' + taskId);
    }

    taskRowNumber = found.rowNumber;
    originalRow = found.rowValues.slice();
    const current = found.record;
    const patch = validateMetadataPatch_(current, payload);
    if (!Object.keys(patch).length) throw new Error('No task metadata was received. Reload and try again.');
    patch.UpdatedAt = new Date();

    const updated = taskRepoUpdate_(taskRowNumber, patch);
    const operationId = newOperationId_();
    const fields = Object.keys(patch).filter(field => field !== 'UpdatedAt');

    auditChangesLocked_('TASK', taskId, 'UPDATE_METADATA', current, updated, fields, actor.UserID, operationId);
    SpreadsheetApp.flush();

    return {
      task: serializeRecordForClient_(updated),
      operationId: operationId
    };
  } catch (error) {
    if (originalRow && taskRowNumber) {
      restoreRow_(MYWORK.SHEETS.TASKS, taskRowNumber, originalRow);
    }
    deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG, auditSafeRow);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function addTaskResult_(taskId, payload, actor) {
  payload = payload || {};
  actor = actor || ensureCurrentUser_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  const auditSafeRow = getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
  let resultRow = null;
  let taskRowNumber = null;
  let originalTaskRow = null;

  try {
    const found = taskRepoFind_(taskId);
    if (!found) {
      throw new Error('Task not found: ' + taskId);
    }

    if (String(found.record.Status) === MYWORK.TASK_STATUS.COMPLETED) {
      throw new Error('Completed task must be reopened before adding a new progress update.');
    }

    taskRowNumber = found.rowNumber;
    originalTaskRow = found.rowValues.slice();

    const current = found.record;
    const normalized = validateTaskResultInput_(current, payload);
    const now = new Date();
    const operationId = newOperationId_();
    const resultId = nextIdLocked_('TASK_RESULT');

    const result = {
      ResultID: resultId,
      TaskID: taskId,
      UpdateDate: normalized.UpdateDate,
      ProgressBefore: Number(current.Progress) || 0,
      ProgressAfter: normalized.ProgressAfter,
      StatusBefore: current.Status,
      StatusAfter: normalized.StatusAfter,
      CompletedWork: normalized.CompletedWork,
      PendingWork: normalized.PendingWork,
      IssuesConstraints: normalized.IssuesConstraints,
      WaitingFor: normalized.WaitingFor,
      NextAction: normalized.NextAction,
      NextActionDue: normalized.NextActionDue,
      FollowUpDate: normalized.FollowUpDate,
      ProgressChangeReason: normalized.ProgressChangeReason,
      UpdatedBy: actor.UserID,
      CreatedAt: now
    };

    resultRow = taskResultRepoAppend_(result);

    const taskPatch = {
      Status: normalized.StatusAfter,
      Progress: normalized.ProgressAfter,
      NextAction: normalized.NextAction,
      NextActionDue: normalized.NextActionDue,
      WaitingFor: normalized.WaitingFor,
      FollowUpDate: normalized.FollowUpDate,
      CompletedDate: normalized.StatusAfter === MYWORK.TASK_STATUS.COMPLETED ? normalized.UpdateDate : '',
      UpdatedAt: now
    };

    const updatedTask = taskRepoUpdate_(taskRowNumber, taskPatch);

    auditChangesLocked_(
      'TASK',
      taskId,
      'UPDATE_RESULT',
      current,
      updatedTask,
      ['Status', 'Progress', 'NextAction', 'NextActionDue', 'WaitingFor', 'FollowUpDate', 'CompletedDate'],
      actor.UserID,
      operationId
    );

    auditRecordLocked_('TASK_RESULT', resultId, 'CREATE', '', '', result, actor.UserID, operationId);
    SpreadsheetApp.flush();

    return {
      task: serializeRecordForClient_(updatedTask),
      result: serializeRecordForClient_(result),
      operationId: operationId
    };
  } catch (error) {
    if (originalTaskRow && taskRowNumber) {
      restoreRow_(MYWORK.SHEETS.TASKS, taskRowNumber, originalTaskRow);
    }
    if (resultRow) {
      deleteRowSafe_(MYWORK.SHEETS.TASK_RESULTS, resultRow);
    }
    deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG, auditSafeRow);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function completeTask_(taskId, payload, actor) {
  payload = payload || {};
  if (!String(payload.completedWork || '').trim()) {
    throw new Error('Final Result / Completed Work is required.');
  }

  return addTaskResult_(taskId, {
    updateDate: payload.completedDate || payload.updateDate || todayIso_(),
    status: MYWORK.TASK_STATUS.COMPLETED,
    progress: 100,
    completedWork: payload.completedWork,
    pendingWork: '',
    issuesConstraints: payload.issuesConstraints || '',
    nextAction: '',
    nextActionDue: '',
    waitingFor: '',
    followUpDate: ''
  }, actor);
}

function reopenTask_(taskId, payload, actor) {
  payload = payload || {};
  actor = actor || ensureCurrentUser_();

  const found = taskRepoFind_(taskId);
  if (!found) {
    throw new Error('Task not found: ' + taskId);
  }

  if (String(found.record.Status) !== MYWORK.TASK_STATUS.COMPLETED) {
    throw new Error('Only a completed task can be reopened.');
  }

  const reason = String(payload.reason || '').trim();
  const nextAction = String(payload.nextAction || '').trim();
  if (!reason) {
    throw new Error('Reopen reason is required.');
  }
  if (!nextAction) {
    throw new Error('Next Action is required when reopening a task.');
  }

  const progress = Number(payload.progress);
  if (!Number.isFinite(progress) || progress < 1 || progress > 99) {
    throw new Error('Reopened task progress must be between 1 and 99.');
  }

  return reopenCompletedTaskLockedWrapper_(taskId, {
    updateDate: payload.updateDate || todayIso_(),
    progress: progress,
    reason: reason,
    nextAction: nextAction,
    nextActionDue: payload.nextActionDue || ''
  }, actor);
}

function reopenCompletedTaskLockedWrapper_(taskId, payload, actor) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  const auditSafeRow = getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
  let resultRow = null;
  let taskRowNumber = null;
  let originalTaskRow = null;

  try {
    const found = taskRepoFind_(taskId);
    if (!found || String(found.record.Status) !== MYWORK.TASK_STATUS.COMPLETED) {
      throw new Error('Task is no longer in Completed status. Refresh and try again.');
    }

    taskRowNumber = found.rowNumber;
    originalTaskRow = found.rowValues.slice();
    const current = found.record;
    const now = new Date();
    const updateDate = parseDateInput_(payload.updateDate, 'Update Date');
    const operationId = newOperationId_();
    const resultId = nextIdLocked_('TASK_RESULT');

    const result = {
      ResultID: resultId,
      TaskID: taskId,
      UpdateDate: updateDate,
      ProgressBefore: 100,
      ProgressAfter: payload.progress,
      StatusBefore: MYWORK.TASK_STATUS.COMPLETED,
      StatusAfter: MYWORK.TASK_STATUS.IN_PROGRESS,
      CompletedWork: '',
      PendingWork: payload.reason,
      IssuesConstraints: '',
      WaitingFor: '',
      NextAction: payload.nextAction,
      NextActionDue: payload.nextActionDue ? parseDateInput_(payload.nextActionDue, 'Next Action Due') : '',
      FollowUpDate: '',
      ProgressChangeReason: payload.reason,
      UpdatedBy: actor.UserID,
      CreatedAt: now
    };

    resultRow = taskResultRepoAppend_(result);

    const patch = {
      Status: MYWORK.TASK_STATUS.IN_PROGRESS,
      Progress: payload.progress,
      CompletedDate: '',
      WaitingFor: '',
      FollowUpDate: '',
      NextAction: payload.nextAction,
      NextActionDue: result.NextActionDue,
      UpdatedAt: now
    };

    const updated = taskRepoUpdate_(taskRowNumber, patch);
    auditChangesLocked_(
      'TASK',
      taskId,
      'REOPEN',
      current,
      updated,
      ['Status', 'Progress', 'CompletedDate', 'NextAction', 'NextActionDue'],
      actor.UserID,
      operationId
    );
    auditRecordLocked_('TASK_RESULT', resultId, 'CREATE', '', '', result, actor.UserID, operationId);
    SpreadsheetApp.flush();

    return {
      task: serializeRecordForClient_(updated),
      result: serializeRecordForClient_(result),
      operationId: operationId
    };
  } catch (error) {
    if (originalTaskRow && taskRowNumber) {
      restoreRow_(MYWORK.SHEETS.TASKS, taskRowNumber, originalTaskRow);
    }
    if (resultRow) {
      deleteRowSafe_(MYWORK.SHEETS.TASK_RESULTS, resultRow);
    }
    deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG, auditSafeRow);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function cancelTask_(taskId, payload, actor) {
  payload = payload || {};
  const reason = String(payload.reason || '').trim();
  if (!reason) {
    throw new Error('Cancellation reason is required.');
  }

  const found = taskRepoFind_(taskId);
  if (!found) {
    throw new Error('Task not found: ' + taskId);
  }
  if ([MYWORK.TASK_STATUS.COMPLETED, MYWORK.TASK_STATUS.CANCELLED].includes(String(found.record.Status))) {
    throw new Error('This task cannot be cancelled from its current status.');
  }

  return addTaskResult_(taskId, {
    updateDate: payload.updateDate || todayIso_(),
    status: MYWORK.TASK_STATUS.CANCELLED,
    progress: Number(found.record.Progress) || 0,
    completedWork: '',
    pendingWork: '',
    issuesConstraints: reason,
    nextAction: '',
    nextActionDue: '',
    waitingFor: '',
    followUpDate: ''
  }, actor);
}

function getTaskHistory_(taskId) {
  const found = taskRepoFind_(taskId);
  if (!found) {
    throw new Error('Task not found: ' + taskId);
  }
  return taskResultRepoList_(taskId).map(serializeRecordForClient_);
}

function validateCreateTaskInput_(payload, actor) {
  const title = String(payload.taskTitle || '').trim();
  const ownerId = String(payload.ownerId || actor.UserID || '').trim();
  const priority = String(payload.priority || MYWORK.PRIORITY.MEDIUM).trim().toUpperCase();
  const assignedDate = parseDateInput_(payload.assignedDate || todayIso_(), 'Assigned Date');
  const dueDate = parseDateInput_(payload.dueDate, 'Due Date');

  if (!title) {
    throw new Error('Task Title is required.');
  }
  if (!ownerId) {
    throw new Error('Owner is required.');
  }
  if (!Object.values(MYWORK.PRIORITY).includes(priority)) {
    throw new Error('Invalid priority.');
  }
  if (!dueDate) {
    throw new Error('Due Date is required.');
  }
  if (compareDateOnly_(dueDate, assignedDate) < 0) {
    throw new Error('Due Date cannot be earlier than Assigned Date.');
  }

  const nextActionDue = payload.nextActionDue ? parseDateInput_(payload.nextActionDue, 'Next Action Due') : '';
  const warnings = [];
  if (nextActionDue && compareDateOnly_(nextActionDue, dueDate) > 0) {
    warnings.push('Next Action Due is later than the Task Due Date.');
  }

  return {
    TaskTitle: title,
    Description: String(payload.description || '').trim(),
    SourceType: payload.projectId ? MYWORK.TASK_SOURCE.PROJECT : String(payload.sourceType || MYWORK.TASK_SOURCE.MANUAL),
    ProjectID: String(payload.projectId || '').trim(),
    ParentTaskID: String(payload.parentTaskId || '').trim(),
    OwnerID: ownerId,
    AssignedBy: String(payload.assignedBy || '').trim(),
    AssignedDate: assignedDate,
    StartDate: assignedDate,
    DueDate: dueDate,
    Priority: priority,
    ExpectedOutput: String(payload.expectedOutput || '').trim(),
    Weight: payload.weight === '' || payload.weight === null || typeof payload.weight === 'undefined' ? (payload.projectId ? 1 : '') : Number(payload.weight),
    SortOrder: payload.sortOrder === '' || payload.sortOrder === null || typeof payload.sortOrder === 'undefined' ? 0 : Number(payload.sortOrder),
    NextAction: String(payload.nextAction || '').trim(),
    NextActionDue: nextActionDue,
    Warnings: warnings
  };
}

function validateMetadataPatch_(current, payload) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'taskTitle')) {
    const value = String(payload.taskTitle || '').trim();
    if (!value) {
      throw new Error('Task Title is required.');
    }
    patch.TaskTitle = value;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    patch.Description = String(payload.description || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'assignedBy')) {
    patch.AssignedBy = String(payload.assignedBy || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'ownerId')) {
    const value = String(payload.ownerId || '').trim();
    if (!value) {
      throw new Error('Owner is required.');
    }
    patch.OwnerID = value;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'priority')) {
    const value = String(payload.priority || '').toUpperCase();
    if (!Object.values(MYWORK.PRIORITY).includes(value)) {
      throw new Error('Invalid priority.');
    }
    patch.Priority = value;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'assignedDate')) {
    patch.AssignedDate = normalizeTaskMetadataDate_(payload.assignedDate, 'Assigned Date');
    patch.StartDate = patch.AssignedDate;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'dueDate')) {
    patch.DueDate = normalizeTaskMetadataDate_(payload.dueDate, 'Due Date');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'expectedOutput')) {
    patch.ExpectedOutput = String(payload.expectedOutput || '').trim();
  }

  const assignedDate = Object.prototype.hasOwnProperty.call(patch, 'AssignedDate') ? patch.AssignedDate : current.AssignedDate;
  const dueDate = Object.prototype.hasOwnProperty.call(patch, 'DueDate') ? patch.DueDate : current.DueDate;
  if (compareDateOnly_(dueDate, assignedDate) < 0) {
    throw new Error('Due Date cannot be earlier than Assigned Date.');
  }

  return patch;
}

function validateTaskResultInput_(current, payload) {
  const status = String(payload.status || '').trim().toUpperCase();
  if (!Object.values(MYWORK.TASK_STATUS).includes(status)) {
    throw new Error('Invalid task status.');
  }

  validateStatusTransition_(String(current.Status), status);

  let progress = Number(payload.progress);
  if (status === MYWORK.TASK_STATUS.COMPLETED) {
    progress = 100;
  } else if (status === MYWORK.TASK_STATUS.CANCELLED) {
    progress = Number(current.Progress) || 0;
  }

  validateProgressForStatus_(status, progress);

  const before = Number(current.Progress) || 0;
  const reason = String(payload.progressChangeReason || '').trim();
  if (progress < before && status !== MYWORK.TASK_STATUS.CANCELLED && !reason) {
    throw new Error('Reason is required when progress decreases.');
  }

  let waitingFor = String(payload.waitingFor || '').trim();
  let followUpDate = payload.followUpDate ? parseDateInput_(payload.followUpDate, 'Follow-up Date') : '';
  let nextAction = String(payload.nextAction || '').trim();
  let nextActionDue = payload.nextActionDue ? parseDateInput_(payload.nextActionDue, 'Next Action Due') : '';

  if (status === MYWORK.TASK_STATUS.WAITING && !waitingFor) {
    throw new Error('Waiting For is required when status is Waiting.');
  }

  const completedWork = String(payload.completedWork || '').trim();
  const issuesConstraints = String(payload.issuesConstraints || '').trim();

  if (status === MYWORK.TASK_STATUS.COMPLETED && !completedWork) {
    throw new Error('Final Result / Completed Work is required when completing a task.');
  }

  if (status === MYWORK.TASK_STATUS.CANCELLED && !issuesConstraints) {
    throw new Error('Cancellation reason is required.');
  }

  if (status === MYWORK.TASK_STATUS.COMPLETED || status === MYWORK.TASK_STATUS.CANCELLED) {
    waitingFor = '';
    followUpDate = '';
    nextAction = '';
    nextActionDue = '';
  }

  return {
    UpdateDate: parseDateInput_(payload.updateDate || todayIso_(), 'Update Date'),
    StatusAfter: status,
    ProgressAfter: progress,
    CompletedWork: completedWork,
    PendingWork: String(payload.pendingWork || '').trim(),
    IssuesConstraints: issuesConstraints,
    WaitingFor: waitingFor,
    NextAction: nextAction,
    NextActionDue: nextActionDue,
    FollowUpDate: followUpDate,
    ProgressChangeReason: reason
  };
}

function validateStatusTransition_(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  const allowed = {};
  allowed[MYWORK.TASK_STATUS.NOT_STARTED] = [
    MYWORK.TASK_STATUS.IN_PROGRESS,
    MYWORK.TASK_STATUS.WAITING,
    MYWORK.TASK_STATUS.ON_HOLD,
    MYWORK.TASK_STATUS.COMPLETED,
    MYWORK.TASK_STATUS.CANCELLED
  ];
  allowed[MYWORK.TASK_STATUS.IN_PROGRESS] = [
    MYWORK.TASK_STATUS.WAITING,
    MYWORK.TASK_STATUS.ON_HOLD,
    MYWORK.TASK_STATUS.COMPLETED,
    MYWORK.TASK_STATUS.CANCELLED
  ];
  allowed[MYWORK.TASK_STATUS.WAITING] = [
    MYWORK.TASK_STATUS.IN_PROGRESS,
    MYWORK.TASK_STATUS.ON_HOLD,
    MYWORK.TASK_STATUS.COMPLETED,
    MYWORK.TASK_STATUS.CANCELLED
  ];
  allowed[MYWORK.TASK_STATUS.ON_HOLD] = [
    MYWORK.TASK_STATUS.IN_PROGRESS,
    MYWORK.TASK_STATUS.WAITING,
    MYWORK.TASK_STATUS.COMPLETED,
    MYWORK.TASK_STATUS.CANCELLED
  ];
  allowed[MYWORK.TASK_STATUS.CANCELLED] = [];
  allowed[MYWORK.TASK_STATUS.COMPLETED] = [];

  if (!(allowed[fromStatus] || []).includes(toStatus)) {
    throw new Error('Invalid task status transition: ' + fromStatus + ' -> ' + toStatus + '.');
  }
}

function validateProgressForStatus_(status, progress) {
  if (!Number.isFinite(progress)) {
    throw new Error('Progress must be a number.');
  }

  if (status === MYWORK.TASK_STATUS.NOT_STARTED && progress !== 0) {
    throw new Error('Not Started task progress must be 0%.');
  }

  if ([MYWORK.TASK_STATUS.IN_PROGRESS, MYWORK.TASK_STATUS.WAITING].includes(status) && (progress < 1 || progress > 99)) {
    throw new Error(status.replace('_', ' ') + ' progress must be between 1% and 99%.');
  }

  if (status === MYWORK.TASK_STATUS.ON_HOLD && (progress < 0 || progress > 99)) {
    throw new Error('On Hold progress must be between 0% and 99%.');
  }

  if (status === MYWORK.TASK_STATUS.COMPLETED && progress !== 100) {
    throw new Error('Completed task progress must be 100%.');
  }

  if (status === MYWORK.TASK_STATUS.CANCELLED && (progress < 0 || progress > 100)) {
    throw new Error('Cancelled task progress is invalid.');
  }
}

function compareTasksForList_(a, b) {
  const activeRank = taskLifecycleRank_(a.Status) - taskLifecycleRank_(b.Status);
  if (activeRank !== 0) {
    return activeRank;
  }

  const dueRank = safeDateSort_(a.DueDate) - safeDateSort_(b.DueDate);
  if (dueRank !== 0) {
    return dueRank;
  }

  const priorityRank = prioritySortRank_(a.Priority) - prioritySortRank_(b.Priority);
  if (priorityRank !== 0) {
    return priorityRank;
  }

  return dateTimeSortValue_(b.UpdatedAt) - dateTimeSortValue_(a.UpdatedAt);
}

function taskLifecycleRank_(status) {
  const value = String(status || '');
  if (value === MYWORK.TASK_STATUS.COMPLETED) return 2;
  if (value === MYWORK.TASK_STATUS.CANCELLED) return 3;
  return 1;
}

function prioritySortRank_(priority) {
  const value = String(priority || '');
  if (value === MYWORK.PRIORITY.HIGH) return 1;
  if (value === MYWORK.PRIORITY.MEDIUM) return 2;
  return 3;
}

function safeDateSort_(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  try {
    return parseDateInput_(toIsoDate_(value), 'Date').getTime();
  } catch (error) {
    return Number.MAX_SAFE_INTEGER;
  }
}

function serializeTaskSummary_(task) {
  const output = serializeRecordForClient_(task);
  const calculated = buildTaskCalculated_(task);
  output.IsOverdue = calculated.IsOverdue;
  output.OverdueDays = calculated.OverdueDays;
  output.IsDueSoon = calculated.IsDueSoon;
  return output;
}

function buildTaskCalculated_(task) {
  const status = String(task.Status || '');
  const today = parseDateInput_(todayIso_(), 'Today');
  const due = task.DueDate ? parseDateInput_(toIsoDate_(task.DueDate), 'Due Date') : null;
  const terminal = [MYWORK.TASK_STATUS.COMPLETED, MYWORK.TASK_STATUS.CANCELLED].includes(status);
  let overdueDays = 0;
  let isOverdue = false;
  let isDueSoon = false;

  if (due && !terminal) {
    const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
    isOverdue = diffDays > 0;
    overdueDays = isOverdue ? diffDays : 0;

    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    const dueSoonDays = Number(getSettingValue_('DUE_SOON_DAYS', '3')) || 3;
    isDueSoon = !isOverdue && daysUntil >= 0 && daysUntil <= dueSoonDays;
  }

  return {
    IsOverdue: isOverdue,
    OverdueDays: overdueDays,
    IsDueSoon: isDueSoon
  };
}

function todayIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getSettingValue_(key, fallback) {
  const rows = getSheetObjects_(MYWORK.SHEETS.SETTINGS);
  const found = rows.find(row => String(row.Key) === String(key));
  return found ? found.Value : fallback;
}

function ensureCurrentUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim();
  const users = getSheetObjects_(MYWORK.SHEETS.USERS);

  if (email) {
    const existing = users.find(user => String(user.Email || '').toLowerCase() === email.toLowerCase());
    if (existing) {
      return existing;
    }
  }

  if (users.length) {
    return users[0];
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const currentUsers = getSheetObjects_(MYWORK.SHEETS.USERS);
    if (currentUsers.length) {
      return currentUsers[0];
    }

    const now = new Date();
    const record = {
      UserID: nextIdLocked_('USER'),
      FullName: email ? email.split('@')[0] : 'MyWork User',
      Email: email,
      Department: '',
      Position: '',
      TimeZone: Session.getScriptTimeZone(),
      Role: 'ADMIN',
      IsActive: true,
      CreatedAt: now,
      UpdatedAt: now
    };
    appendRecord_(MYWORK.SHEETS.USERS, record);
    return record;
  } finally {
    lock.releaseLock();
  }
}

function listActiveUsers_() {
  ensureCurrentUser_();
  return getSheetObjects_(MYWORK.SHEETS.USERS)
    .filter(user => normalizeBoolean_(user.IsActive) || String(user.IsActive) === '')
    .map(serializeRecordForClient_);
}

// H01: required date-only metadata; reject invalid/empty input before any write.
function normalizeTaskMetadataDate_(value, fieldName) {
  const date = parseDateInput_(value, fieldName);
  if (!date) throw new Error(fieldName + ' is required.');
  return parseDateInput_(toIsoDate_(date), fieldName);
}
