function apiTaskBootstrap() {
  return {
    version: MYWORK.VERSION,
    today: todayIso_(),
    currentUser: serializeRecordForClient_(ensureCurrentUser_()),
    users: listActiveUsers_(),
    tasks: listTasks_({})
  };
}

function apiListTasks(filters) {
  return listTasks_(filters || {});
}

function apiGetTask(taskId) {
  return getTask_(taskId);
}

function apiCreateTask(payload) {
  return createTask_(payload || {}, ensureCurrentUser_());
}

function apiUpdateTaskMetadata(taskId, payload) {
  // The service returns the repository read-back while holding the update lock.
  const result = updateTaskMetadata_(taskId, payload || {}, ensureCurrentUser_());
  if (!result.task || String(result.task.TaskID) !== String(taskId)) {
    throw new Error('Updated task could not be verified.');
  }
  return { success: true, task: result.task, operationId: result.operationId };
}

function apiAddTaskResult(taskId, payload) {
  return addTaskResult_(taskId, payload || {}, ensureCurrentUser_());
}

function apiCompleteTask(taskId, payload) {
  return completeTask_(taskId, payload || {}, ensureCurrentUser_());
}

function apiReopenTask(taskId, payload) {
  return reopenTask_(taskId, payload || {}, ensureCurrentUser_());
}

function apiCancelTask(taskId, payload) {
  return cancelTask_(taskId, payload || {}, ensureCurrentUser_());
}

function apiGetTaskHistory(taskId) {
  return getTaskHistory_(taskId);
}

function apiGetTaskFormOptions() {
  return {
    today: todayIso_(),
    users: listActiveUsers_(),
    priorities: Object.values(MYWORK.PRIORITY),
    statuses: Object.values(MYWORK.TASK_STATUS)
  };
}
