// PR05 adds its own sheets; never run the destructive initial setup on an existing DB.
const MARKET_SCHEMA = Object.freeze({
  '30_MARKETS': ['MarketID','Country','ShortName','Operator','Currency','ExchangeRate','RateDate','Note','CreatedBy','CreatedAt','UpdatedAt'],
  '31_MARKET_CONTACTS': ['ContactID','MarketID','ContactName','Role','Tel','Email','Channel','Note','IsPrimary','IsActive','CreatedBy','CreatedAt','UpdatedAt']
});
function marketHeaders_(name) {
  const sheet=getSheet_(name), headers=getHeaders_(sheet);
  MARKET_SCHEMA[name].forEach(k=>{if(headers.indexOf(k)<0||headers.indexOf(k)!==headers.lastIndexOf(k))throw new Error('Invalid market header: '+k);});
  return {sheet:sheet,headers:headers};
}
function marketInitialize_() {
  const db=getDb_();
  // Validate all existing tabs before adding any missing ones.
  Object.keys(MARKET_SCHEMA).forEach(name=>{if(db.getSheetByName(name))marketHeaders_(name);});
  Object.keys(MARKET_SCHEMA).forEach(name=>{
    if(db.getSheetByName(name))return;
    const sheet=db.insertSheet(name),headers=MARKET_SCHEMA[name];
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold');
  });
}
function apiInitializeMarketContacts() {
  ensureCurrentUser_(); const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {marketInitialize_();return {ready:true};} finally {lock.releaseLock();}
}
function marketRead_(name) {marketHeaders_(name);return getSheetObjects_(name);}
function marketFind_(name,id) {marketHeaders_(name);return findRecordById_(name,MARKET_SCHEMA[name][0],id);}
function marketWrite_(name,patch,row) {
  const data=marketHeaders_(name),sheet=data.sheet,headers=data.headers;
  Object.keys(patch).forEach(k=>{if(!MARKET_SCHEMA[name].includes(k))throw new Error('Unknown market field: '+k);});
  row=row||Math.max(2,sheet.getLastRow()+1);
  // Sheets literal text avoids formula execution and phone-number coercion.
  Object.keys(patch).forEach(k=>{
    const cell=sheet.getRange(row,headers.indexOf(k)+1),v=patch[k];
    if(typeof v==='string') {cell.setNumberFormat('@');cell.setValue(v.startsWith('=')?"'"+v:v);}
    else cell.setValue(v);
  });
  SpreadsheetApp.flush();
  const record=rowToObject_(headers,sheet.getRange(row,1,1,headers.length).getValues()[0]);
  const expected=marketSerialize_(patch),actual=marketSerialize_(record);
  Object.keys(patch).forEach(k=>{if(String(expected[k])!==String(actual[k]))throw new Error('Market field did not persist: '+k);});
  return record;
}
function marketSerialize_(record) {
  const result=serializeRecordForClient_(record);
  if(Object.prototype.hasOwnProperty.call(record,'RateDate'))result.RateDate=toIsoDate_(record.RateDate);
  return result;
}
function marketPatch_(input,map) {
  const patch={};
  Object.keys(input||{}).forEach(k=>{
    if(!Object.prototype.hasOwnProperty.call(map,k))throw new Error('Unknown input field: '+k);
    const v=input[k];if(v!==null&&typeof v==='object')throw new Error('Invalid value: '+k);
    patch[map[k]]=String(v==null?'':v).trim();
    if(patch[map[k]].length>2000)throw new Error('Field too long: '+k);
  });
  if(!Object.keys(patch).length)throw new Error('No changes received.');
  return patch;
}
function validateMarket_(input,current,others) {
  const p=marketPatch_(input,{country:'Country',shortName:'ShortName',operator:'Operator',currency:'Currency',exchangeRate:'ExchangeRate',rateDate:'RateDate',note:'Note'});
  if('ShortName' in p)p.ShortName=p.ShortName.toUpperCase();
  if('ExchangeRate' in p&&p.ExchangeRate!=='') {p.ExchangeRate=Number(p.ExchangeRate);if(!Number.isFinite(p.ExchangeRate)||p.ExchangeRate<=0)throw new Error('Exchange rate must be greater than zero.');}
  if('RateDate' in p)p.RateDate=parseDateInput_(p.RateDate,'Rate date');
  const m=Object.assign({Operator:'',Currency:'',ExchangeRate:'',RateDate:'',Note:''},current||{},p);
  if(!m.Country||!m.ShortName)throw new Error('Country and short name are required.');
  if(!/^[A-Z0-9_-]{2,20}$/.test(m.ShortName))throw new Error('Short name must be 2–20 letters, numbers, dashes or underscores.');
  if(others.some(x=>x.MarketID!==m.MarketID&&String(x.ShortName).toUpperCase()===m.ShortName))throw new Error('Short name already exists.');
  if(m.ExchangeRate!==''&&(!m.Currency||!m.RateDate))throw new Error('Currency and rate date are required with an exchange rate.');
  return current?p:m;
}
function validateMarketContact_(input,current) {
  const p=marketPatch_(input,{marketId:'MarketID',contactName:'ContactName',role:'Role',tel:'Tel',email:'Email',channel:'Channel',note:'Note',isPrimary:'IsPrimary',isActive:'IsActive'});
  ['IsPrimary','IsActive'].forEach(k=>{if(k in p){if(!['true','false'].includes(p[k]))throw new Error('Invalid contact flag: '+k);p[k]=p[k]==='true';}});
  const m=Object.assign({Role:'',Tel:'',Email:'',Channel:'',Note:'',IsPrimary:false,IsActive:true},current||{},p);
  if(!m.ContactName||!m.MarketID)throw new Error('Market and contact name are required.');
  if(current&&m.MarketID!==current.MarketID)throw new Error('A contact cannot be moved to another market.');
  if(m.Email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.Email))throw new Error('Enter a valid email address.');
  if(m.Tel&&!/^\+?[\d () .-]{5,40}$/.test(m.Tel))throw new Error('Enter a valid phone number.');
  if(!m.IsActive)m.IsPrimary=false;
  return m;
}
function apiListMarketContacts() {
  ensureCurrentUser_();
  const db=getDb_();if(!Object.keys(MARKET_SCHEMA).every(n=>db.getSheetByName(n)))return {ready:false,markets:[],contacts:[]};
  return {ready:true,markets:marketRead_('30_MARKETS').map(marketSerialize_),contacts:marketRead_('31_MARKET_CONTACTS').map(marketSerialize_)};
}
function apiSaveMarket(id,input) {
  const actor=ensureCurrentUser_(),lock=LockService.getScriptLock();lock.waitLock(30000);
  let before=null,inserted=null,auditSafe=null;
  try {
    const name='30_MARKETS';marketHeaders_(name);
    before=id?marketFind_(name,id):null;if(id&&!before)throw new Error('Market not found.');
    const patch=validateMarket_(input,before&&before.record,marketRead_(name)),now=new Date();
    patch.UpdatedAt=now;
    if(!before)Object.assign(patch,{MarketID:'MKT-'+Utilities.getUuid(),CreatedBy:actor.UserID,CreatedAt:now});
    auditSafe=getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
    if(!before)inserted=getSheet_(name).getLastRow()+1;
    const record=marketWrite_(name,patch,before&&before.rowNumber),op=newOperationId_();
    if(before)auditChangesLocked_('MARKET',id,'UPDATE_METADATA',before.record,record,Object.keys(patch).filter(k=>k!=='UpdatedAt'),actor.UserID,op);
    else auditRecordLocked_('MARKET',record.MarketID,'CREATE','','',record,actor.UserID,op);
    SpreadsheetApp.flush();return {market:marketSerialize_(record),operationId:op};
  } catch(e) {
    if(auditSafe!==null){if(before)restoreRow_('30_MARKETS',before.rowNumber,before.rowValues);if(inserted)deleteRowSafe_('30_MARKETS',inserted);deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG,auditSafe);}
    throw e;
  } finally {lock.releaseLock();}
}
function apiSaveMarketContact(id,input) {
  const actor=ensureCurrentUser_(),lock=LockService.getScriptLock();lock.waitLock(30000);
  const name='31_MARKET_CONTACTS';let backups=[],inserted=null,auditSafe=null;
  try {
    const before=id?marketFind_(name,id):null;if(id&&!before)throw new Error('Contact not found.');
    const record=validateMarketContact_(input,before&&before.record);
    if(!marketFind_('30_MARKETS',record.MarketID))throw new Error('Market not found.');
    const now=new Date(),op=newOperationId_();record.UpdatedAt=now;
    if(!before)Object.assign(record,{ContactID:'CON-'+Utilities.getUuid(),CreatedBy:actor.UserID,CreatedAt:now});
    const peers=marketRead_(name).filter(c=>c.MarketID===record.MarketID&&c.ContactID!==id&&normalizeBoolean_(c.IsActive));
    // Exactly one primary whenever at least one active contact exists.
    if(record.IsActive&&!peers.some(c=>normalizeBoolean_(c.IsPrimary)))record.IsPrimary=true;
    const changes=[];
    if(record.IsPrimary)peers.filter(c=>normalizeBoolean_(c.IsPrimary)).forEach(c=>changes.push({id:c.ContactID,primary:false}));
    else if(before&&normalizeBoolean_(before.record.IsPrimary)&&peers.length)changes.push({id:peers[0].ContactID,primary:true});
    const peerChanges=changes.map(c=>({before:marketFind_(name,c.id),primary:c.primary}));
    auditSafe=getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
    if(before)backups.push(before);else inserted=getSheet_(name).getLastRow()+1;
    const saved=marketWrite_(name,record,before&&before.rowNumber);
    if(before)auditChangesLocked_('MARKET_CONTACT',id,'UPDATE_METADATA',before.record,saved,Object.keys(saved).filter(k=>k!=='UpdatedAt'),actor.UserID,op);
    else auditRecordLocked_('MARKET_CONTACT',saved.ContactID,'CREATE','','',saved,actor.UserID,op);
    peerChanges.forEach(change=>{backups.push(change.before);const updated=marketWrite_(name,{IsPrimary:change.primary,UpdatedAt:now},change.before.rowNumber);auditChangesLocked_('MARKET_CONTACT',updated.ContactID,'UPDATE_PRIMARY',change.before.record,updated,['IsPrimary'],actor.UserID,op);});
    SpreadsheetApp.flush();return {contact:marketSerialize_(saved),contacts:marketRead_(name).filter(c=>c.MarketID===saved.MarketID).map(marketSerialize_),operationId:op};
  } catch(e) {
    if(auditSafe!==null){backups.forEach(b=>restoreRow_(name,b.rowNumber,b.rowValues));if(inserted)deleteRowSafe_(name,inserted);deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG,auditSafe);}
    throw e;
  } finally {lock.releaseLock();}
}
