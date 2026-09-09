/**
 * PR03 - My Work service.
 * Read-only aggregation over TASKS/TASK_RESULTS/PROJECTS.
 * No schema changes and no persistence.
 */
function getMyWork_(options) {
  options = options || {};

  const actor = ensureCurrentUser_();
  const userId = String(options.userId || actor.UserID || '');
  const today = todayIso_();
  const todayDate = parseDateInput_(today, 'Today');
  const todayTime = todayDate.getTime();

  const projects = getSheetObjects_(MYWORK.SHEETS.PROJECTS);
  const projectMap = {};
  projects.forEach(project => {
    const id = String(project.ProjectID || '');
    if (id) projectMap[id] = project;
  });

  const latestResultMap = getLatestTaskResultMapForMyWork_();

  const activeTasks = taskRepoList_()
    .filter(task => !normalizeBoolean_(task.IsArchived))
    .filter(task => ![MYWORK.TASK_STATUS.COMPLETED, MYWORK.TASK_STATUS.CANCELLED].includes(String(task.Status || '')))
    .filter(task => !userId || !task.OwnerID || String(task.OwnerID) === userId)
    .map(task => buildMyWorkTask_(task, projectMap, latestResultMap, todayTime));

  const sections = {
    needAttention: [],
    today: [],
    upcoming: [],
    waiting: []
  };

  activeTasks.forEach(task => {
    const section = classifyMyWorkTask_(task, todayTime);
    if (section) sections[section].push(task);
  });

  sections.needAttention.sort(compareMyWorkNeedAttention_);
  sections.today.sort(compareMyWorkDefault_);
  sections.upcoming.sort(compareMyWorkUpcoming_);
  sections.waiting.sort(compareMyWorkWaiting_);

  return {
    version: MYWORK.VERSION,
    today: today,
    currentUser: serializeRecordForClient_(actor),
    summary: buildMyWorkSummary_(activeTasks, todayTime),
    sections: sections
  };
}

function getLatestTaskResultMapForMyWork_() {
  const rows = getSheetObjects_(MYWORK.SHEETS.TASK_RESULTS);
  const map = {};

  rows.forEach(row => {
    const taskId = String(row.TaskID || '');
    if (!taskId) return;

    const current = map[taskId];
    if (!current) {
      map[taskId] = row;
      return;
    }

    const currentTime = myWorkDateTimeRank_(current.CreatedAt);
    const nextTime = myWorkDateTimeRank_(row.CreatedAt);
    if (nextTime >= currentTime) map[taskId] = row;
  });

  return map;
}

function buildMyWorkTask_(task, projectMap, latestResultMap, todayTime) {
  const output = serializeTaskSummary_(task);
  const projectId = String(task.ProjectID || '');
  const project = projectId ? projectMap[projectId] : null;
  const latest = latestResultMap[String(task.TaskID || '')] || null;

  output.ProjectName = project ? String(project.ProjectName || '') : '';
  output.LatestResult = latest ? serializeRecordForClient_(latest) : null;

  const attention = getMyWorkAttention_(task, todayTime);
  output.AttentionReasons = attention.reasons;
  output.AttentionRank = attention.rank;

  output.DueInDays = myWorkDaysFromToday_(task.DueDate, todayTime);
  output.NextActionDueInDays = myWorkDaysFromToday_(task.NextActionDue, todayTime);
  output.FollowUpInDays = myWorkDaysFromToday_(task.FollowUpDate, todayTime);

  return output;
}

function classifyMyWorkTask_(task, todayTime) {
  if ((task.AttentionReasons || []).length) return 'needAttention';

  const due = myWorkDaysFromToday_(task.DueDate, todayTime);
  const next = myWorkDaysFromToday_(task.NextActionDue, todayTime);
  const follow = myWorkDaysFromToday_(task.FollowUpDate, todayTime);

  if (next === 0 || due === 0) return 'today';

  if ((next !== null && next > 0 && next <= 7) || (due !== null && due > 0 && due <= 7)) {
    return 'upcoming';
  }

  if (String(task.Status) === MYWORK.TASK_STATUS.WAITING && (follow === null || follow > 0)) {
    return 'waiting';
  }

  return null;
}

function getMyWorkAttention_(task, todayTime) {
  const reasons = [];
  let rank = 999;
  const due = myWorkDaysFromToday_(task.DueDate, todayTime);
  const next = myWorkDaysFromToday_(task.NextActionDue, todayTime);
  const follow = myWorkDaysFromToday_(task.FollowUpDate, todayTime);

  if (due !== null && due < 0) {
    const days = Math.abs(due);
    reasons.push({ code: 'TASK_OVERDUE', label: 'OVERDUE ' + days + ' DAY' + (days === 1 ? '' : 'S'), rank: 1 });
    rank = Math.min(rank, 1);
  }

  if (String(task.Status) === MYWORK.TASK_STATUS.WAITING && follow !== null && follow <= 0) {
    if (follow === 0) {
      reasons.push({ code: 'FOLLOW_UP_TODAY', label: 'FOLLOW-UP DUE TODAY', rank: 2 });
    } else {
      const days = Math.abs(follow);
      reasons.push({ code: 'FOLLOW_UP_OVERDUE', label: 'FOLLOW-UP OVERDUE ' + days + ' DAY' + (days === 1 ? '' : 'S'), rank: 2 });
    }
    rank = Math.min(rank, 2);
  }

  if (next !== null && next < 0) {
    const days = Math.abs(next);
    reasons.push({ code: 'NEXT_ACTION_OVERDUE', label: 'NEXT ACTION OVERDUE ' + days + ' DAY' + (days === 1 ? '' : 'S'), rank: 3 });
    rank = Math.min(rank, 3);
  }

  if (String(task.Priority) === MYWORK.PRIORITY.HIGH && due !== null && due >= 0 && due <= 2) {
    const label = due === 0 ? 'HIGH PRIORITY · DUE TODAY' : (due === 1 ? 'HIGH PRIORITY · DUE TOMORROW' : 'HIGH PRIORITY · DUE IN 2 DAYS');
    reasons.push({ code: 'HIGH_PRIORITY_DUE_SOON', label: label, rank: 4 });
    rank = Math.min(rank, 4);
  }

  return { reasons: reasons, rank: rank === 999 ? null : rank };
}

function buildMyWorkSummary_(tasks, todayTime) {
  let overdue = 0;
  let dueToday = 0;
  let followUpDue = 0;
  let waiting = 0;
  let missingNextAction = 0;

  tasks.forEach(task => {
    const due = myWorkDaysFromToday_(task.DueDate, todayTime);
    const follow = myWorkDaysFromToday_(task.FollowUpDate, todayTime);

    if (due !== null && due < 0) overdue++;
    if (due === 0) dueToday++;

    if (String(task.Status) === MYWORK.TASK_STATUS.WAITING) {
      waiting++;
      if (follow !== null && follow <= 0) followUpDue++;
    }

    if (String(task.Status) === MYWORK.TASK_STATUS.IN_PROGRESS && !String(task.NextAction || '').trim()) {
      missingNextAction++;
    }
  });

  return {
    totalActive: tasks.length,
    overdue: overdue,
    dueToday: dueToday,
    followUpDue: followUpDue,
    waiting: waiting,
    missingNextAction: missingNextAction
  };
}

function myWorkDaysFromToday_(value, todayTime) {
  if (!value) return null;
  try {
    const date = parseDateInput_(toIsoDate_(value), 'Date');
    return Math.round((date.getTime() - todayTime) / 86400000);
  } catch (error) {
    return null;
  }
}

function compareMyWorkNeedAttention_(a, b) {
  const rank = Number(a.AttentionRank || 999) - Number(b.AttentionRank || 999);
  if (rank !== 0) return rank;
  return compareMyWorkDefault_(a, b);
}

function compareMyWorkDefault_(a, b) {
  const priority = prioritySortRank_(a.Priority) - prioritySortRank_(b.Priority);
  if (priority !== 0) return priority;
  return myWorkPrimaryDateRank_(a) - myWorkPrimaryDateRank_(b);
}

function compareMyWorkUpcoming_(a, b) {
  const dateRank = myWorkPrimaryDateRank_(a) - myWorkPrimaryDateRank_(b);
  if (dateRank !== 0) return dateRank;
  return prioritySortRank_(a.Priority) - prioritySortRank_(b.Priority);
}

function compareMyWorkWaiting_(a, b) {
  const followA = a.FollowUpDate ? safeDateSort_(a.FollowUpDate) : Number.MAX_SAFE_INTEGER;
  const followB = b.FollowUpDate ? safeDateSort_(b.FollowUpDate) : Number.MAX_SAFE_INTEGER;
  if (followA !== followB) return followA - followB;
  return compareMyWorkDefault_(a, b);
}

function myWorkPrimaryDateRank_(task) {
  const value = task.NextActionDue || task.FollowUpDate || task.DueDate;
  return value ? safeDateSort_(value) : Number.MAX_SAFE_INTEGER;
}

function myWorkDateTimeRank_(value) {
  if (!value) return 0;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.getTime();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
