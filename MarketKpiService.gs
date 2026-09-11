const MARKET_KPI_SHEET='34_MARKET_KPI';
const MARKET_KPI_FIELDS=["sites","registered","active","population","marketShare","arpuActual","arpuFixed","arpu4g","exchangeRate","dataSubsShare","data4gShare","dou","dou4g","dataPrice","dataCost","mouOutgoing","voicePrice","voiceCost","originalVoiceShare","originalSMSShare","originalDataShare","originalVASShare"];
const MARKET_KPI_HEADERS=['RecordID','MarketCode','Year','Month','ValuesJSON','ReferenceJSON','Source','Note','Revision','UpdatedBy','CreatedAt','UpdatedAt'];
function kpiSheet_(){const sheet=getSheet_(MARKET_KPI_SHEET),headers=getHeaders_(sheet);MARKET_KPI_HEADERS.forEach(k=>{if(headers.indexOf(k)<0||headers.indexOf(k)!==headers.lastIndexOf(k))throw Error('Invalid KPI header: '+k);});return {sheet,headers};}
function apiInitializeMarketKpi(){
 ensureCurrentUser_();const lock=LockService.getScriptLock();lock.waitLock(30000);try{if(!getDb_().getSheetByName(MARKET_KPI_SHEET)){const s=getDb_().insertSheet(MARKET_KPI_SHEET);s.getRange(1,1,1,MARKET_KPI_HEADERS.length).setValues([MARKET_KPI_HEADERS]);s.setFrozenRows(1);}kpiSheet_();return {ready:true};}finally{lock.releaseLock();}
}
function apiListMarketKpi(){
 ensureCurrentUser_();if(!getDb_().getSheetByName(MARKET_KPI_SHEET))return {ready:false,records:[]};kpiSheet_();return {ready:true,records:getSheetObjects_(MARKET_KPI_SHEET).map(serializeRecordForClient_)};
}
function kpiValidate_(input,codes){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid KPI input');
 Object.keys(input).forEach(k=>{if(!['marketCode','year','month','values','references','source','note','revision'].includes(k))throw Error('Unknown KPI input: '+k);});
 const code=String(input.marketCode||'').trim().toUpperCase().replace(/^VBD$/,'VTB');
 if(code==='VTCM'||!codes.includes(code))throw Error('Unknown KPI market: '+code);
 const year=Number(input.year),month=Number(input.month);if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw Error('Invalid KPI period');
 const values={};if(!input.values||typeof input.values!=='object'||Array.isArray(input.values))throw Error('Enter KPI values');
 Object.keys(input.values).forEach(k=>{if(!MARKET_KPI_FIELDS.includes(k))throw Error('Unknown KPI: '+k);});
 MARKET_KPI_FIELDS.forEach(k=>{const v=input.values[k];if(v==null||v===''){values[k]=null;return;}if(!['number','string'].includes(typeof v)||!Number.isFinite(Number(v))||Number(v)<0)throw Error('Invalid KPI value: '+k);values[k]=Number(v);if((['marketShare','dataSubsShare','data4gShare'].includes(k)||k.startsWith('original'))&&values[k]>100)throw Error(k+' must be 0–100%');if(k==='sites'&&!Number.isInteger(values[k]))throw Error('Sites must be an integer');});
 if(!Object.values(values).some(v=>v!==null))throw Error('Enter at least one KPI');
 const references={};Object.keys(input.references||{}).forEach(k=>{if(!MARKET_KPI_FIELDS.includes(k)||typeof input.references[k]!=='string'||input.references[k].length>200)throw Error('Invalid reference period');references[k]=input.references[k];});
 const source=String(input.source||'').trim(),note=String(input.note||'').trim();if(source.length>2000||note.length>2000)throw Error('Text too long');
 return {MarketCode:code,Year:year,Month:month,ValuesJSON:JSON.stringify(values),ReferenceJSON:JSON.stringify(references),Source:source,Note:note};
}
function apiSaveMarketKpi(inputs){
 const actor=ensureCurrentUser_(),lock=LockService.getScriptLock();lock.waitLock(30000);let safe=null,auditSafe=null,backups=[];
 try{if(!Array.isArray(inputs)||!inputs.length||inputs.length>50)throw Error('Submit 1–50 KPI records');const {sheet:s,headers:h}=kpiSheet_(),last=s.getLastRow(),rows=last>1?s.getRange(2,1,last-1,h.length).getValues():[],index={};
 rows.forEach((v,i)=>{const r=rowToObject_(h,v);if(!r.RecordID)return;const key=[r.MarketCode,r.Year,r.Month].join('|');if(index[key])throw Error('Duplicate KPI period in Sheet');index[key]={record:r,row:i+2,values:v};});
 const codes=marketRead_('30_MARKETS').map(m=>String(m.ShortName).replace(/^VBD$/,'VTB')).filter(c=>!c.startsWith('TEST')).concat(['VTT','VTG']);const seen=new Set();
 const plan=inputs.map(input=>{const r=kpiValidate_(input,codes),key=[r.MarketCode,r.Year,r.Month].join('|'),old=index[key];if(seen.has(key))throw Error('Duplicate KPI period in batch');seen.add(key);if(Number(input.revision||0)!==Number(old?old.record.Revision:0))throw Error('KPI changed. Reload before saving.');return {r,old};});
 safe=last;auditSafe=getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();const op=newOperationId_(),now=new Date(),saved=[],audit=[];let next=last+1;
 for(const p of plan){const old=p.old&&p.old.record;const r=Object.assign(p.r,{RecordID:old?old.RecordID:'KPI-'+Utilities.getUuid(),Revision:old?Number(old.Revision)+1:1,UpdatedBy:actor.UserID,CreatedAt:old?old.CreatedAt:now,UpdatedAt:now}),row=p.old?p.old.row:next++;
 if(p.old)backups.push(p.old);if(row>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),row-s.getMaxRows());s.getRange(row,1,1,h.length).setValues([objectToRow_(h,r).map(v=>typeof v==='string'&&v.startsWith('=')?"'"+v:v)]);SpreadsheetApp.flush();const actual=rowToObject_(h,s.getRange(row,1,1,h.length).getValues()[0]),a=serializeRecordForClient_(actual),b=serializeRecordForClient_(r);MARKET_KPI_HEADERS.forEach(k=>{if(String(a[k])!==String(b[k]))throw Error('KPI did not persist: '+k);});saved.push(a);audit.push({entityType:'MARKET_KPI',entityId:r.RecordID,action:old?'UPDATE':'CREATE',fieldName:'Record',oldValue:old||'',newValue:actual,userId:actor.UserID,operationId:op});}
 auditRecordsBatchLocked_(audit);return {records:saved,operationId:op};
 }catch(e){if(safe!==null){backups.forEach(b=>restoreRow_(MARKET_KPI_SHEET,b.row,b.values));deleteRowsAfter_(MARKET_KPI_SHEET,safe);if(auditSafe!==null)deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG,auditSafe);}throw e;}finally{lock.releaseLock();}
}
function apiMarketKpiHistory(id){
 ensureCurrentUser_();return getSheetObjects_(MYWORK.SHEETS.AUDIT_LOG).filter(r=>r.EntityType==='MARKET_KPI'&&r.EntityID===id).map(serializeRecordForClient_);
}
