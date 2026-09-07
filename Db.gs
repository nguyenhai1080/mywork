function getDb_() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty(MYWORK.PROPERTIES.DB_SPREADSHEET_ID);

  if (storedId) {
    return SpreadsheetApp.openById(storedId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('MyWork database spreadsheet is not configured. Run setupMyWorkV1() once from the bound spreadsheet.');
  }

  return active;
}

function getSheet_(sheetName) {
  const sheet = getDb_().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Required sheet not found: ' + sheetName);
  }

  return sheet;
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) {
    return [];
  }
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getSheetObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values.shift();

  return values
    .filter(row => row.some(value => value !== '' && value !== null))
    .map(row => rowToObject_(headers, row));
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
}

function objectToRow_(headers, record) {
  return headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '');
}

function findRecordById_(sheetName, idField, idValue) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idField);

  if (idIndex === -1) {
    throw new Error('ID field not found: ' + idField);
  }

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(idValue)) {
      return {
        rowNumber: i + 1,
        rowValues: values[i].slice(),
        record: rowToObject_(headers, values[i])
      };
    }
  }

  return null;
}

function appendRecord_(sheetName, record) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  if (!headers.length) {
    throw new Error('Sheet has no header row: ' + sheetName);
  }

  const row = objectToRow_(headers, record);
  const rowNumber = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  return rowNumber;
}

function updateRecordRow_(sheetName, rowNumber, patch) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const updated = current.slice();

  headers.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(patch, header)) {
      updated[index] = patch[header];
    }
  });

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([updated]);
  return rowToObject_(headers, updated);
}

function restoreRow_(sheetName, rowNumber, rowValues) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([rowValues.slice(0, headers.length)]);
}

function deleteRowSafe_(sheetName, rowNumber) {
  const sheet = getSheet_(sheetName);
  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
  }
}

function deleteRowsAfter_(sheetName, lastSafeRow) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow > lastSafeRow) {
    sheet.deleteRows(lastSafeRow + 1, lastRow - lastSafeRow);
  }
}

function nextId_(entity) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return nextIdLocked_(entity);
  } finally {
    lock.releaseLock();
  }
}

function nextIdLocked_(entity) {
  const sheet = getSheet_(MYWORK.SHEETS.COUNTERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Counter table is empty.');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(entity)) {
      const prefix = String(values[i][1]);
      const currentValue = Number(values[i][2]) || 0;
      const digits = Number(values[i][3]) || 4;
      const nextValue = currentValue + 1;

      sheet.getRange(i + 2, 3).setValue(nextValue);
      return prefix + String(nextValue).padStart(digits, '0');
    }
  }

  throw new Error('Counter not configured for entity: ' + entity);
}

function newOperationId_() {
  const tz = Session.getScriptTimeZone();
  const timestamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  const suffix = Utilities.getUuid().substring(0, 6).toUpperCase();
  return 'OP-' + timestamp + '-' + suffix;
}

function parseDateInput_(value, fieldName) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }

  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new Error((fieldName || 'Date') + ' must use YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error((fieldName || 'Date') + ' is invalid.');
  }

  return date;
}

function toIsoDate_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? match[0] : text;
}

function toIsoDateTime_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  return String(value);
}

function compareDateOnly_(a, b) {
  const da = parseDateInput_(toIsoDate_(a), 'Date');
  const db = parseDateInput_(toIsoDate_(b), 'Date');
  return da.getTime() - db.getTime();
}

function serializeRecordForClient_(record) {
  if (!record) {
    return null;
  }

  const dateFields = {
    AssignedDate: true,
    StartDate: true,
    DueDate: true,
    CompletedDate: true,
    NextActionDue: true,
    FollowUpDate: true,
    UpdateDate: true,
    TargetDate: true
  };

  const dateTimeFields = {
    CreatedAt: true,
    UpdatedAt: true
  };

  const output = {};
  Object.keys(record).forEach(key => {
    const value = record[key];
    if (dateFields[key]) {
      output[key] = toIsoDate_(value);
    } else if (dateTimeFields[key]) {
      output[key] = toIsoDateTime_(value);
    } else {
      output[key] = value;
    }
  });

  return output;
}

function normalizeBoolean_(value) {
  if (value === true || value === false) {
    return value;
  }
  const text = String(value).toLowerCase().trim();
  return text === 'true' || text === 'yes' || text === '1';
}
