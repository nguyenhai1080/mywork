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
    const oldValue = oldRecord ? oldRecord[field] : '';
    const newValue = newRecord ? newRecord[field] : '';

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
