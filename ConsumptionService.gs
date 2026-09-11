const CONSUMPTION_SHEET='32_MOBILE_CONSUMPTION';
const VTG_CONSUMPTION_SHEET='33_VTG_CONSUMPTION';
const CONSUMPTION_HEADERS=['RecordID','MarketID','Year','Month','Scenario','Unit','InputMode','Total','Voice','SMS','Data','VAS','VoiceShare','SMSShare','DataShare','VASShare','Status','Source','Note','Revision','ChangeReason','Reconciliation','Difference','UpdatedBy','CreatedAt','UpdatedAt'];
function consumptionSheet_(name){const sheet=getSheet_(name||CONSUMPTION_SHEET),headers=getHeaders_(sheet);CONSUMPTION_HEADERS.forEach(k=>{if(headers.indexOf(k)<0||headers.indexOf(k)!==headers.lastIndexOf(k))throw Error('Invalid consumption header: '+k);});return {sheet:sheet,headers:headers};}
function apiInitializeConsumption_() {
 ensureCurrentUser_();const lock=LockService.getScriptLock();lock.waitLock(30000);
 try { [CONSUMPTION_SHEET,VTG_CONSUMPTION_SHEET].forEach(name=>{if(getDb_().getSheetByName(name)){consumptionSheet_(name);return;}const s=getDb_().insertSheet(name);s.getRange(1,1,1,CONSUMPTION_HEADERS.length).setValues([CONSUMPTION_HEADERS]);s.setFrozenRows(1);s.getRange(1,1,1,CONSUMPTION_HEADERS.length).setFontWeight('bold');});return {ready:true}; }finally{lock.releaseLock();}
}
function consumptionScope_(inputs){const group=inputs.length>0&&inputs.every(r=>r.marketCode==='VTG'||r.marketId==='VTG');return {sheet:group?VTG_CONSUMPTION_SHEET:CONSUMPTION_SHEET,markets:group?[{MarketID:'VTG',ShortName:'VTG'}]:marketRead_('30_MARKETS'),entity:group?'VTG_CONSUMPTION':'MOBILE_CONSUMPTION'};}
function consumptionKey_(r){return [r.MarketID,r.Year,r.Month,r.Scenario].join('|');}
function consumptionNumber_(v,name){if(v===''||v===null||v===undefined)return '';if(typeof v==='boolean'||typeof v==='object')throw Error('Invalid number: '+name);const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error(name+' must be a non-negative number.');return n;}
function consumptionValidate_(input,markets){
 const allowed=['marketId','marketCode','year','month','scenario','inputMode','total','voice','sms','data','vas','voiceShare','smsShare','dataShare','vasShare','status','source','note','revision','changeReason'];
 Object.keys(input).forEach(k=>{if(!allowed.includes(k))throw Error('Unknown input: '+k);});
 const code=String(input.marketCode||'').trim().toUpperCase();if(code==='VTCM')throw Error('VTCM excluded by import policy.');
 const canonical=code==='VBD'?'VTB':code;const m=markets.find(m=>input.marketId?m.MarketID===input.marketId:(String(m.ShortName).toUpperCase()==='VBD'?'VTB':String(m.ShortName).toUpperCase())===canonical);if(!m)throw Error('Unknown market: '+canonical);
 const r={MarketID:m.MarketID,Year:Number(input.year),Month:Number(input.month),Scenario:input.scenario||'ACTUAL',Unit:'USD_THOUSAND',InputMode:input.inputMode||'AMOUNTS',Status:input.status||'DRAFT',Source:String(input.source||'').trim(),Note:String(input.note||'').trim(),ChangeReason:String(input.changeReason||'').trim()};
 if(!Number.isInteger(r.Year)||r.Year<2000||r.Year>2100||!Number.isInteger(r.Month)||r.Month<0||r.Month>12||input.month===''||input.month==null)throw Error('Invalid reporting period. Month 0 is annual history only.');
 if(!['ACTUAL','PLAN'].includes(r.Scenario)||!['DRAFT','FINAL'].includes(r.Status)||!['AMOUNTS','SHARES'].includes(r.InputMode))throw Error('Invalid record type.');
 if([r.Source,r.Note,r.ChangeReason].some(s=>s.length>2000))throw Error('Text is too long.');
 const fields=['Voice','SMS','Data','VAS'],keys=['voice','sms','data','vas'];
 r.Total=consumptionNumber_(input.total,'Total');
 fields.forEach((f,i)=>{r[f]=consumptionNumber_(input[keys[i]],f);r[f+'Share']=consumptionNumber_(input[keys[i]+'Share'],f+' share');});
 if(r.InputMode==='SHARES'){
  if(r.Total===''||fields.some(f=>r[f+'Share']===''))throw Error('Total and all four shares are required.');
  const sum=fields.reduce((s,f)=>s+r[f+'Share'],0);if(Math.abs(sum-100)>0.01||fields.some(f=>r[f+'Share']>100))throw Error('Shares must total 100% (tolerance 0.01 percentage point).');
  fields.forEach(f=>{r[f]=r.Total*r[f+'Share']/100;});
 }else{
  const complete=fields.every(f=>r[f]!=='');
  if(complete){const sum=fields.reduce((s,f)=>s+r[f],0);if(r.Total==='')r.Total=sum;}
  if(r.Total===''&&fields.every(f=>r[f]===''))throw Error('Enter at least one value.');
  fields.forEach(f=>r[f+'Share']=r.Total!==''&&r.Total>0&&r[f]!==''?r[f]/r.Total*100:'');

 }
 const knownSum=fields.reduce((s,f)=>s+(r[f]===''?0:r[f]),0),complete=fields.every(f=>r[f]!=='');
 r.Difference=r.Total!==''&&complete?knownSum-r.Total:'';
 r.Reconciliation=r.Total!==''&&(complete?Math.abs(knownSum-r.Total)>Math.max(0.001,r.Total*0.0001):knownSum>r.Total+Math.max(0.001,r.Total*0.0001))?'MISMATCH':(!complete?'INCOMPLETE':'MATCHED');
 if(r.Status==='FINAL'&&r.Reconciliation!=='MATCHED')throw Error('Reconcile service amounts before finalizing.');
 if(r.Status==='FINAL'&&(r.Total===''||fields.some(f=>r[f]==='')))throw Error('Final records require all service amounts.');
 return r;
}
function consumptionRows_(name){consumptionSheet_(name);return getSheetObjects_(name||CONSUMPTION_SHEET);}
function consumptionIndex_(rows){const index={};rows.forEach((r,i)=>{const k=consumptionKey_(r);if(index[k])throw Error('Duplicate period in Sheet: '+k);index[k]={record:r,row:i+2};});return index;}
function consumptionPrepare_(inputs,existing,markets){
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>200)throw Error('Submit 1–200 records per batch.');const index=consumptionIndex_(existing),seen=new Set();
 return inputs.map(input=>{const r=consumptionValidate_(input,markets),key=consumptionKey_(r);if(seen.has(key))throw Error('Duplicate period in batch.');seen.add(key);const before=index[key];
 if(before){if(Number(input.revision)!==Number(before.record.Revision))throw Error('Data changed or period already exists. Preview again before replacing.');if(before.record.Status==='FINAL'&&!r.ChangeReason)throw Error('A reason is required to revise a final period.');}
 else if(Number(input.revision||0)!==0)throw Error('Period no longer exists. Refresh first.');
 return {record:r,before:before};});
}
function apiPreviewConsumption_(inputs){ensureCurrentUser_();if(!Array.isArray(inputs)||!inputs.length||inputs.length>200)throw Error('Submit 1–200 records per preview.');const scope=consumptionScope_(inputs),markets=scope.markets,existing=consumptionRows_(scope.sheet),index=consumptionIndex_(existing),seen=new Set();return inputs.map((input,i)=>{try{const r=consumptionValidate_(input,markets),key=consumptionKey_(r);if(seen.has(key))throw Error('Duplicate period in import.');seen.add(key);const old=index[key];return {line:i+1,input:Object.assign({},input,{revision:old?old.record.Revision:0}),record:r,previous:old?serializeRecordForClient_(old.record):null,action:old?(consumptionSame_(r,old.record)?'UNCHANGED':'REPLACE'):'CREATE'};}catch(e){return {line:i+1,error:e.message,input:input};}});}
function apiSaveConsumptionBatch_(inputs) {
 const actor=ensureCurrentUser_(),lock=LockService.getScriptLock();lock.waitLock(30000);
 let safe=null,auditSafe=null,backups=[],scope=null;
 try {
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>200)throw Error('Submit 1–200 records per batch.');
  scope=consumptionScope_(inputs);
  const data=consumptionSheet_(scope.sheet),s=data.sheet,h=data.headers,existing=consumptionRows_(scope.sheet);
  const plan=consumptionPrepare_(inputs,existing,scope.markets);
  safe=s.getLastRow();auditSafe=getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
  const now=new Date(),op=newOperationId_(),saved=[],appended=[];let next=safe+1;
  const existingValues=safe>1?s.getRange(2,1,safe-1,h.length).getValues():[];
  const physicalRows={};existingValues.forEach((row,i)=>{physicalRows[String(row[h.indexOf('RecordID')])]=i+2;});
  plan.forEach(p=>{
   const old=p.before&&p.before.record,r=Object.assign(p.record,{RecordID:old?old.RecordID:'MC-'+Utilities.getUuid(),Revision:old?Number(old.Revision)+1:1,UpdatedBy:actor.UserID,CreatedAt:old?old.CreatedAt:now,UpdatedAt:now});
   const row=old?physicalRows[old.RecordID]:next++;
   if(old&&!row)throw Error('Record disappeared before update.');
   const values=objectToRow_(h,r).map(v=>typeof v==='string'&&v.startsWith('=')?"'"+v:v);
   if(old){backups.push({row:row,values:existingValues[row-2]});s.getRange(row,1,1,h.length).setValues([values]);}
   else appended.push(values);
   saved.push({row:row,record:r,old:old});
  });
  if(next-1>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),next-1-s.getMaxRows());
  if(appended.length)s.getRange(safe+1,1,appended.length,h.length).setValues(appended);
  SpreadsheetApp.flush();
  const persisted=s.getRange(2,1,s.getLastRow()-1,h.length).getValues(),audit=[];
  saved.forEach(p=>{
   const actual=rowToObject_(h,persisted[p.row-2]),a=serializeRecordForClient_(actual),b=serializeRecordForClient_(p.record);
   CONSUMPTION_HEADERS.forEach(k=>{const equal=typeof a[k]==='number'&&typeof b[k]==='number'?Math.abs(a[k]-b[k])<=Math.max(1,Math.abs(b[k]))*1e-12:String(a[k])===String(b[k]);if(!equal)throw Error('Consumption field did not persist: '+k);});
   p.persisted=actual;
   audit.push({entityType:scope.entity,entityId:p.record.RecordID,action:p.old?'UPDATE':'CREATE',fieldName:'Record',oldValue:p.old||'',newValue:actual,userId:actor.UserID,operationId:op});
  });
  auditRecordsBatchLocked_(audit);SpreadsheetApp.flush();
  return {records:saved.map(p=>serializeRecordForClient_(p.persisted)),operationId:op};
 }catch(e){if(safe!==null){backups.forEach(b=>restoreRow_(scope.sheet,b.row,b.values));deleteRowsAfter_(scope.sheet,safe);if(auditSafe!==null)deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG,auditSafe);}throw e;}finally{lock.releaseLock();}
}
function apiConsumptionBootstrap_(){ensureCurrentUser_();const ready=!!getDb_().getSheetByName(CONSUMPTION_SHEET);return {ready:ready,markets:marketRead_('30_MARKETS').map(serializeRecordForClient_),records:ready?consumptionRows_().map(serializeRecordForClient_):[],vtgReady:!!getDb_().getSheetByName(VTG_CONSUMPTION_SHEET),vtgRecords:getDb_().getSheetByName(VTG_CONSUMPTION_SHEET)?consumptionRows_(VTG_CONSUMPTION_SHEET).map(serializeRecordForClient_):[]};}
function apiConsumptionHistory_(id){ensureCurrentUser_();return getSheetObjects_(MYWORK.SHEETS.AUDIT_LOG).filter(r=>['MOBILE_CONSUMPTION','VTG_CONSUMPTION'].includes(r.EntityType)&&r.EntityID===id).map(serializeRecordForClient_);}

function consumptionSame_(a,b){return Object.keys(a).filter(k=>k!=='ChangeReason').every(k=>typeof a[k]==='number'&&typeof b[k]==='number'?Math.abs(a[k]-b[k])<=Math.max(1,Math.abs(a[k]))*1e-12:String(a[k])===String(b[k]));}
