function auditRecordLocked_(entityType, entityId, action, fieldName, oldValue, newValue, userId, operationId) {
  const record = {
    AuditID: nextIdLocked_('AUDIT'),
    EntityType: entityType || '',
    EntityID: entityId || '',
    Action: action || '',
    FieldName: fieldName || '',
    OldValue: auditValue_(oldValue),
    NewValue: auditValue_(newValue),
    UserID: userId || '',
    OperationID: operationId || '',
    CreatedAt: new Date()
  };

  return appendRecord_(MYWORK.SHEETS.AUDIT_LOG, record);
}

function auditChangesLocked_(entityType, entityId, action, oldRecord, newRecord, fields, userId, operationId) {
  const changed = [];

  (fields || []).forEach(field => {
    const oldRaw = oldRecord ? oldRecord[field] : '';
    const newRaw = newRecord ? newRecord[field] : '';
    // Date-only fields compare calendar dates, avoiding midnight/noon false changes.
    const dateOnly = field === 'AssignedDate' || field === 'DueDate';
    const oldValue = dateOnly ? toIsoDate_(oldRaw) : oldRaw;
    const newValue = dateOnly ? toIsoDate_(newRaw) : newRaw;

    if (!auditValuesEqual_(oldValue, newValue)) {
      auditRecordLocked_(entityType, entityId, action, field, oldValue, newValue, userId, operationId);
      changed.push(field);
    }
  });

  return changed;
}

function auditValue_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return toIsoDateTime_(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function auditValuesEqual_(a, b) {
  return auditValue_(a) === auditValue_(b);
}

// Caller must hold the script lock. Reserve audit IDs and append one batch.
function auditRecordsBatchLocked_(entries) {
  if (!entries.length) return [];
  const counters = getSheet_(MYWORK.SHEETS.COUNTERS);
  const counterRows = counters.getRange(2, 1, counters.getLastRow() - 1, 4).getValues();
  const index = counterRows.findIndex(r => String(r[0]) === 'AUDIT');
  if (index < 0) throw Error('Counter not configured for entity: AUDIT');
  const counter = counterRows[index], first = (Number(counter[2]) || 0) + 1;
  const records = entries.map((e, i) => ({
    AuditID: String(counter[1]) + String(first + i).padStart(Number(counter[3]) || 4, '0'),
    EntityType: e.entityType, EntityID: e.entityId, Action: e.action,
    FieldName: e.fieldName, OldValue: auditValue_(e.oldValue), NewValue: auditValue_(e.newValue),
    UserID: e.userId, OperationID: e.operationId, CreatedAt: new Date()
  }));
  const sheet = getSheet_(MYWORK.SHEETS.AUDIT_LOG), headers = getHeaders_(sheet);
  Object.keys(records[0]).forEach(k => { if (headers.indexOf(k) < 0 || headers.indexOf(k) !== headers.lastIndexOf(k)) throw Error('Invalid audit header: ' + k); });
  const last = sheet.getLastRow();
  if (last + records.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), last + records.length - sheet.getMaxRows());
  counters.getRange(index + 2, 3).setValue(first + records.length - 1);
  sheet.getRange(last + 1, 1, records.length, headers.length).setValues(records.map(r => objectToRow_(headers, r)));
  SpreadsheetApp.flush();
  const persisted = sheet.getRange(last + 1, 1, records.length, headers.length).getValues();
  records.forEach((r,i) => { const actual=serializeRecordForClient_(rowToObject_(headers,persisted[i])), expected=serializeRecordForClient_(r); Object.keys(r).forEach(k => { if(String(actual[k])!==String(expected[k]))throw Error('Audit field did not persist: '+k); }); });
  return records;
}
