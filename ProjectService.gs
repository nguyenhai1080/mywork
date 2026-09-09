function validateProjectInput_(input, current, actor) {
  const map = {projectName:'ProjectName', description:'Description', objective:'Objective', expectedOutput:'ExpectedOutput', ownerId:'OwnerID', sponsor:'Sponsor', priority:'Priority', startDate:'StartDate', targetDate:'TargetDate'};
  const patch = {};
  Object.keys(map).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(input,key)) patch[map[key]] = String(input[key] == null ? '' : input[key]).trim();
  });
  ['StartDate','TargetDate'].forEach(field => { if (Object.prototype.hasOwnProperty.call(patch,field)) patch[field] = parseDateInput_(patch[field],field); });
  const merged = Object.assign({OwnerID:actor.UserID, Priority:'MEDIUM'},current||{},patch);
  if (!merged.ProjectName) throw new Error('Project Name is required.');
  if (!merged.OwnerID || !listActiveUsers_().some(u=>String(u.UserID)===String(merged.OwnerID))) throw new Error('Select an active owner.');
  if (!merged.StartDate || !merged.TargetDate) throw new Error('Start Date and Target Date are required.');
  if (compareDateOnly_(merged.TargetDate,merged.StartDate)<0) throw new Error('Target Date cannot be earlier than Start Date.');
  if (!Object.values(MYWORK.PRIORITY).includes(merged.Priority)) throw new Error('Invalid priority.');
  return current ? patch : merged;
}
function saveProject_(id, input) {
  const actor=ensureCurrentUser_(), lock=LockService.getScriptLock();
  lock.waitLock(30000);
  let found=null, inserted=null, auditSafe=null;
  try {
    auditSafe=getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();
    found=id?projectRepoFind_(id):null;
    if (id&&!found) throw new Error('Project not found.');
    const patch=validateProjectInput_(input||{},found&&found.record,actor);
    if (!Object.keys(patch).length) throw new Error('No project metadata received.');
    const now=new Date(), operationId=newOperationId_();
    patch.UpdatedAt=now;
    if (!found) Object.assign(patch,{ProjectID:nextIdLocked_('PROJECT'),Status:'PLANNING',Progress:0,SystemHealth:'ON_TRACK',OwnerHealth:'',HealthOverrideReason:'',NextMajorAction:'',NextActionDue:'',CompletedDate:'',CompletionReason:'',IsArchived:false,CreatedBy:actor.UserID,CreatedAt:now});
    // Remember the insert row before writing, so failures in read-back can be compensated.
    if (!found) inserted=getSheet_(MYWORK.SHEETS.PROJECTS).getLastRow()+1;
    const record=projectRepoWrite_(patch,found&&found.rowNumber);
    if (found) auditChangesLocked_('PROJECT',id,'UPDATE_METADATA',found.record,record,Object.keys(patch).filter(k=>k!=='UpdatedAt'),actor.UserID,operationId);
    else auditRecordLocked_('PROJECT',record.ProjectID,'CREATE','','',record,actor.UserID,operationId);
    SpreadsheetApp.flush();
    return {project:serializeRecordForClient_(record),operationId:operationId};
  } catch(error) {
    if(found) restoreRow_(MYWORK.SHEETS.PROJECTS,found.rowNumber,found.rowValues);
    if(inserted) deleteRowSafe_(MYWORK.SHEETS.PROJECTS,inserted);
    if(auditSafe!==null) deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG,auditSafe);
    throw error;
  } finally { lock.releaseLock(); }
}
function projectWbs_(tasks) {
  const all={}; tasks.forEach(t=>{if(all[t.TaskID])throw new Error('Duplicate TaskID in WBS.');all[t.TaskID]=t;});
  const usable=tasks.filter(t=>!normalizeBoolean_(t.IsArchived)&&t.Status!=='CANCELLED');
  const nodes={}, roots=[];
  usable.forEach(t=>nodes[t.TaskID]={task:t,children:[]});
  usable.forEach(t=>{
    const parent=String(t.ParentTaskID||'');
    if(parent&&!all[parent]) throw new Error('WBS parent not found: '+parent);
    if(parent&&nodes[parent])nodes[parent].children.push(nodes[t.TaskID]);
    else roots.push(nodes[t.TaskID]);
  });
  const visited=new Set(),active=new Set();
  function weight(t){const w=t.Weight===''||t.Weight==null?1:Number(t.Weight);if(!Number.isFinite(w)||w<=0)throw new Error('Task weight must be positive: '+t.TaskID);return w;}
  function walk(n){
    if(active.has(n.task.TaskID))throw new Error('WBS contains a cycle.');
    if(visited.has(n.task.TaskID))return;
    active.add(n.task.TaskID);n.children.forEach(walk);
    n.weight=weight(n.task);
    n.progress=n.children.length?average(n.children):(n.task.Status==='COMPLETED'?100:Math.max(0,Math.min(100,Number(n.task.Progress)||0)));
    active.delete(n.task.TaskID);visited.add(n.task.TaskID);
  }
  function average(list){const total=list.reduce((s,n)=>s+n.weight,0);return total?list.reduce((s,n)=>s+n.progress*n.weight,0)/total:0;}
  Object.values(nodes).forEach(walk);
  const rows=[];
  function flatten(list,depth,prefix){list.sort((a,b)=>(Number(a.task.SortOrder)||0)-(Number(b.task.SortOrder)||0)||String(a.task.TaskID).localeCompare(String(b.task.TaskID)));list.forEach((n,i)=>{const code=prefix+(i+1);rows.push(Object.assign(serializeTaskSummary_(n.task),{WbsCode:code,Depth:depth,CalculatedProgress:Math.round(n.progress*100)/100,IsSummary:n.children.length>0}));flatten(n.children,depth+1,code+'.');});}
  flatten(roots,0,'');
  return {progress:Math.round(average(roots)*100)/100,rows:rows,leafCount:Object.values(nodes).filter(n=>!n.children.length).length};
}
function getProject_(id) {
  const found=projectRepoFind_(id);if(!found)throw new Error('Project not found.');
  const rollup=projectWbs_(taskRepoList_().filter(t=>String(t.ProjectID)===String(id)));
  return {project:Object.assign(serializeRecordForClient_(found.record),{Progress:rollup.progress}),tasks:rollup.rows,leafCount:rollup.leafCount};
}
function listProjects_() {
  const tasks=taskRepoList_();
  return projectRepoList_().filter(p=>!normalizeBoolean_(p.IsArchived)).map(p=>{
    const wbs=projectWbs_(tasks.filter(t=>String(t.ProjectID)===String(p.ProjectID)));
    return Object.assign(serializeRecordForClient_(p),{Progress:wbs.progress,TaskCount:wbs.rows.length});
  });
}
function validateProjectTaskLink_(projectId,parentId,taskId,weight) {
  const p=projectRepoFind_(projectId);
  if(!p||normalizeBoolean_(p.record.IsArchived)||['COMPLETED','CANCELLED'].includes(p.record.Status))throw new Error('Select an active project.');
  if(!Number.isFinite(Number(weight))||Number(weight)<=0)throw new Error('Weight must be greater than zero.');
  const seen=new Set(taskId?[String(taskId)]:[]);let parent=String(parentId||'');
  while(parent){
    if(seen.has(parent))throw new Error('A task cannot be its own ancestor.');seen.add(parent);
    const f=taskRepoFind_(parent);
    if(!f||String(f.record.ProjectID)!==String(projectId)||normalizeBoolean_(f.record.IsArchived)||['COMPLETED','CANCELLED'].includes(f.record.Status))throw new Error('Parent must be an active task in the same project.');
    parent=String(f.record.ParentTaskID||'');
  }
}
function updateTaskWbs_(taskId,input) {
  input=input||{};const actor=ensureCurrentUser_(),lock=LockService.getScriptLock();lock.waitLock(30000);
  let found=null,auditSafe=null;
  try{
    auditSafe=getSheet_(MYWORK.SHEETS.AUDIT_LOG).getLastRow();found=taskRepoFind_(taskId);if(!found||!found.record.ProjectID)throw new Error('Project task not found.');
    const parent=String(input.parentTaskId||''),weight=Number(input.weight),sort=Number(input.sortOrder||0);
    if(!Number.isFinite(sort))throw new Error('Sort order must be numeric.');
    validateProjectTaskLink_(found.record.ProjectID,parent,taskId,weight);
    const patch={ParentTaskID:parent,Weight:weight,SortOrder:sort,UpdatedAt:new Date()};
    const updated=taskRepoUpdate_(found.rowNumber,patch),op=newOperationId_();
    auditChangesLocked_('TASK',taskId,'UPDATE_WBS',found.record,updated,['ParentTaskID','Weight','SortOrder'],actor.UserID,op);SpreadsheetApp.flush();
    return {task:serializeRecordForClient_(updated),operationId:op};
  }catch(e){if(found)restoreRow_(MYWORK.SHEETS.TASKS,found.rowNumber,found.rowValues);if(auditSafe!==null)deleteRowsAfter_(MYWORK.SHEETS.AUDIT_LOG,auditSafe);throw e;}finally{lock.releaseLock();}
}
