const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const dir = path.resolve(__dirname, '..');
const c = vm.createContext({console});
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.gs'))) new vm.Script(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f});
new vm.Script(fs.readFileSync(path.join(dir,'AppJS.html'),'utf8').replace(/<\/?script[^>]*>/g,''));
for (const f of ['Db.gs','TaskRepository.gs','TaskService.gs','AuditService.gs','TaskApi.gs']) vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c);
vm.runInContext(`
var MYWORK = {SHEETS:{TASKS:'tasks',AUDIT_LOG:'audit'},PRIORITY:{MEDIUM:'MEDIUM'}};
var Session = {getScriptTimeZone:()=> 'Asia/Ho_Chi_Minh'};
var Utilities = {formatDate:(d,tz,fmt)=>fmt==='yyyy-MM-dd'?d.toISOString().slice(0,10):d.toISOString()};
var SpreadsheetApp = {flush:()=>{}};
var LockService = {getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})};
var headers = ['TaskID','DueDate','AssignedDate','StartDate','UpdatedAt','TaskTitle'];
var initial = ['T1',new Date('2026-09-15T12:00:00Z'),new Date('2026-09-03T12:00:00Z'),new Date('2026-09-03T12:00:00Z'),'','Test'];
var row = initial.slice(), logs=[], writes=0, ignore=false, failAudit=false;
var sheet = {getLastRow:()=>2,getLastColumn:()=>headers.length,getRange:(r,col,n=1,w=1)=>({
 getValues:()=>r===1?(n===1?[headers.slice(col-1,col-1+w)]:[headers.slice(),row.slice()]):[row.slice(col-1,col-1+w)],
 setValue:v=>{writes++;if(!ignore)row[col-1]=v;},setValues:values=>{row=values[0].slice();}
})};
getSheet_ = name=>name==='audit'?{getLastRow:()=>logs.length+1}:sheet;
appendRecord_ = (name,record)=>{if(failAudit)throw new Error('audit failed');logs.push(record);};
nextIdLocked_ = ()=> 'A'+logs.length;
newOperationId_ = ()=> 'OP1';
ensureCurrentUser_ = ()=>({UserID:'U1'});
deleteRowsAfter_ = (name,safe)=>{logs.length=safe-1;};
`,c);
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function run(code){return vm.runInContext(code,c);}
function reset(){run('row=initial.slice();logs=[];writes=0;ignore=false;failAudit=false;');}
test('syntax: all GS and AppJS',()=>{});
test('camelCase persists with reordered headers and API read-back',()=>{reset();const r=run("apiUpdateTaskMetadata('T1',{assignedDate:'2026-09-05',dueDate:'2026-09-20'})");assert.equal(r.success,true);assert.equal(r.task.AssignedDate,'2026-09-05');assert.equal(r.task.DueDate,'2026-09-20');assert.equal(run("toIsoDate_(taskRepoFind_('T1').record.DueDate)"),'2026-09-20');});
test('audit records both dates with before/after',()=>{assert.equal(run("logs.filter(x=>x.FieldName==='AssignedDate'&&x.OldValue==='2026-09-03'&&x.NewValue==='2026-09-05').length"),1);assert.equal(run("logs.filter(x=>x.FieldName==='DueDate'&&x.NewValue==='2026-09-20').length"),1);});
test('partial due update validates against existing assigned',()=>{reset();assert.throws(()=>run("apiUpdateTaskMetadata('T1',{dueDate:'2026-09-01'})"),/earlier/);assert.equal(run('writes'),0);});
test('partial assigned update validates against existing due',()=>{reset();assert.throws(()=>run("apiUpdateTaskMetadata('T1',{assignedDate:'2026-09-16'})"),/earlier/);});
test('equal dates accepted',()=>{reset();run("apiUpdateTaskMetadata('T1',{assignedDate:'2026-09-15',dueDate:'2026-09-15'})");});
test('empty, invalid and malformed dates rejected',()=>{for(const value of ['',null,'2026-02-30','08/09/2026']){reset();assert.throws(()=>run('apiUpdateTaskMetadata("T1",'+JSON.stringify({dueDate:value})+')'));assert.equal(run('writes'),0);}});
test('unknown header fails before any writes',()=>{reset();assert.throws(()=>run("taskRepoUpdate_(2,{TaskTitle:'New',dueDate:'2026-09-20'})"),/field not found/);assert.equal(run('writes'),0);});
test('duplicate header rejected',()=>{reset();run("headers.push('DueDate')");try{assert.throws(()=>run("taskRepoUpdate_(2,{DueDate:'2026-09-20'})"),/Duplicate/);}finally{run('headers.pop()');}});
test('ignored write fails verification and rolls back',()=>{reset();run('ignore=true');assert.throws(()=>run("apiUpdateTaskMetadata('T1',{dueDate:'2026-09-20'})"),/did not persist/);assert.equal(run('logs.length'),0);});
test('audit failure rolls task back',()=>{reset();run('failAudit=true');assert.throws(()=>run("apiUpdateTaskMetadata('T1',{dueDate:'2026-09-20'})"),/audit failed/);assert.equal(run('toIsoDate_(row[1])'),'2026-09-15');});
test('unchanged date has no duplicate date audit',()=>{reset();run("apiUpdateTaskMetadata('T1',{dueDate:'2026-09-15'})");assert.equal(run("logs.filter(x=>x.FieldName==='DueDate').length"),0);});
test('missing task fails',()=>{reset();assert.throws(()=>run("apiUpdateTaskMetadata('missing',{dueDate:'2026-09-20'})"),/not found/);});
test('empty payload rejected before write',()=>{reset();assert.throws(()=>run("apiUpdateTaskMetadata('T1',{})"),/No task metadata/);assert.equal(run('writes'),0);});
console.log(passed+' tests passed; Sheets mocked. Live deployment checks remain required.');
