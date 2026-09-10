function apiListProjects(){return listProjects_();}
function apiGetProject(id){return getProject_(id);}
function apiCreateProject(input){return saveProject_('',input);}
function apiUpdateProject(id,input){return saveProject_(id,input);}
function apiUpdateTaskWbs(id,input){return updateTaskWbs_(id,input);}
