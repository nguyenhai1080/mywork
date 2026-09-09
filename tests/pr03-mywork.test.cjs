const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.resolve(__dirname,'..'),c=vm.createContext({console});
for(const f of ['Db.gs','TaskService.gs','TaskRepository.gs','MyWorkService.gs'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c);
vm.runInContext(`
var MYWORK={VERSION:'PR03',SHEETS:{PROJECTS:'projects',TASK_RESULTS:'results'},TASK_STATUS:{COMPLETED:'COMPLETED',CANCELLED:'CANCELLED',WAITING:'WAITING',IN_PROGRESS:'IN_PROGRESS'},PRIORITY:{HIGH:'HIGH',MEDIUM:'MEDIUM'}};
var Session={getScriptTimeZone:()=> 'Asia/Ho_Chi_Minh'};
var Utilities={formatDate:(d,tz,fmt)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
todayIso_=()=> '2026-09-09';ensureCurrentUser_=()=>({UserID:'U1'});getSettingValue_=()=>3;
var tasks=[],results=[],projects=[{ProjectID:'P1',ProjectName:'Project test'}];
taskRepoList_=()=>tasks;getSheetObjects_=n=>n==='projects'?projects:results;
function setTask(patch){tasks=[Object.assign({TaskID:'T1',OwnerID:'U1',Status:'IN_PROGRESS',Priority:'MEDIUM',DueDate:'2026-09-30'},patch)];}
`,c);
let passed=0;function run(s){return vm.runInContext(s,c);}function test(n,fn){fn();console.log('PASS '+n);passed++;}
function section(patch,expected){run('setTask('+JSON.stringify(patch)+')');const r=run('getMyWork_({})');const all=Object.values(r.sections).flat();assert.equal(all.length,expected?1:0);if(expected)assert.equal(r.sections[expected][0].TaskID,'T1');return r;}
test('MW01 overdue',()=>section({DueDate:'2026-09-08'},'needAttention'));
test('MW02 follow-up today',()=>section({Status:'WAITING',FollowUpDate:'2026-09-09'},'needAttention'));
test('MW03 follow-up overdue',()=>section({Status:'WAITING',FollowUpDate:'2026-09-08'},'needAttention'));
test('MW04 next action overdue',()=>section({NextActionDue:'2026-09-08'},'needAttention'));
test('MW05 due today',()=>section({DueDate:'2026-09-09'},'today'));
test('MW06 next action today',()=>section({NextActionDue:'2026-09-09'},'today'));
test('MW07 upcoming boundaries',()=>{for(const day of ['10','16'])section({DueDate:'2026-09-'+day},'upcoming');section({DueDate:'2026-09-17'},null);});
test('MW08 waiting future or absent follow-up',()=>{section({Status:'WAITING',FollowUpDate:'2026-09-15'},'waiting');section({Status:'WAITING'},'waiting');});
test('MW09 waiting due only once',()=>section({Status:'WAITING',FollowUpDate:'2026-09-09',DueDate:'2026-09-09'},'needAttention'));
test('MW10 completed hidden',()=>section({Status:'COMPLETED',DueDate:'2026-09-08'},null));
test('MW11 cancelled hidden',()=>section({Status:'CANCELLED',DueDate:'2026-09-08'},null));
test('MW12 project context',()=>assert.equal(section({ProjectID:'P1',DueDate:'2026-09-09'},'today').sections.today[0].ProjectName,'Project test'));
test('MW13 multiple reasons, one section',()=>{const r=section({DueDate:'2026-09-08',NextActionDue:'2026-09-08'},'needAttention');assert.equal(r.sections.needAttention[0].AttentionReasons.length,2);});
test('MW14 reload aggregation reclassifies changed record',()=>{section({DueDate:'2026-09-08'},'needAttention');run("tasks[0].DueDate='2026-09-10'");assert.equal(run('getMyWork_({}).sections.upcoming.length'),1);});
test('MW15 timezone date near UTC midnight',()=>{assert.equal(run("toIsoDate_(new Date('2026-09-08T18:00:00Z'))"),'2026-09-09');});
test('archived and other owner excluded',()=>{section({IsArchived:true,DueDate:'2026-09-09'},null);section({OwnerID:'U2',DueDate:'2026-09-09'},null);});
test('high priority due soon escalates per existing rule',()=>section({Priority:'HIGH',DueDate:'2026-09-10'},'needAttention'));
test('waiting with near due follows classification precedence',()=>section({Status:'WAITING',FollowUpDate:'2026-09-20',DueDate:'2026-09-10'},'upcoming'));
console.log(passed+' My Work logic tests passed. Mock data only; browser interaction remains manual.');
