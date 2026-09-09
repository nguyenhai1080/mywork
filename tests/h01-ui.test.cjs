const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../AppJS.html'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end<0?undefined:end);}
async function check(sourceText){
 const controls=[{name:'assignedDate',value:'2026-09-05',disabled:false},{name:'dueDate',value:'2026-09-20',disabled:false}];
 const form={reportValidity:()=>true};let sent;const toasts=[];
 const c=vm.createContext({STATE:{currentTaskDetail:{task:{TaskID:'T1'}}},document:{getElementById:()=>form},FormData:class{constructor(){this.values=controls.filter(x=>!x.disabled).map(x=>[x.name,x.value]);}forEach(cb){this.values.forEach(([k,v])=>cb(v,k));}},validateForm_:()=>true,setModalBusy_:busy=>controls.forEach(x=>x.disabled=busy),serverCall_:async(name,id,payload)=>{if(name==='apiUpdateTaskMetadata')sent=payload;return {task:{TaskID:'T1',AssignedDate:'2026-09-05',DueDate:'2026-09-20'}};},closeModal_:()=>{},refreshTasks_:async()=>{},renderCurrentPage_:()=>{},showToast_:(...a)=>toasts.push(a)});
 vm.runInContext(extract('formObject_')+'\n'+sourceText,c);
 await vm.runInContext('submitEditTask_()',c);
 return sent;
}
(async()=>{
 const start=source.indexOf('async function submitEditTask_()');const end=source.indexOf('\nfunction openUpdateResultModal_',start);const fixed=source.slice(start,end);
 const buggy=fixed.replace('  const payload = formObject_(form);\n','').replace('detail.task.TaskID, payload','detail.task.TaskID, formObject_(form)');
 assert.equal(Object.keys(await check(buggy)).length,0);
 const sent=await check(fixed);assert.equal(sent.assignedDate,'2026-09-05');assert.equal(sent.dueDate,'2026-09-20');
 console.log('PASS reproduces empty payload before fix; fixed Save sends both dates (disabled-control FormData mock).');
})().catch(e=>{console.error(e);process.exitCode=1;});
