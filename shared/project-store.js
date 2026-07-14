(function(global){
  'use strict';
  const DATA_KEY='ac_project_workspace_v1',ACTIVE_KEY='ac_active_project_v1',DB_NAME='ac_project_files_v1',DB_VERSION=1,STORE='attachments';
  const now=()=>new Date().toISOString();
  const uid=prefix=>prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
  const clean=value=>JSON.parse(JSON.stringify(value==null?null:value));
  const today=()=>{const d=new Date(),offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10)};

  function read(){
    try{const parsed=JSON.parse(localStorage.getItem(DATA_KEY)||'{}');return{version:1,projects:Array.isArray(parsed.projects)?parsed.projects:[]}}
    catch(_){return{version:1,projects:[]}}
  }
  function write(data){localStorage.setItem(DATA_KEY,JSON.stringify(data));global.dispatchEvent(new CustomEvent('ac-projects-changed'))}
  function list(){return read().projects.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))}
  function get(id){return list().find(project=>project.id===id)||null}
  function create(fields){
    const data=read(),project={id:uid('project'),name:String(fields?.name||'New Project').trim()||'New Project',address:String(fields?.address||'').trim(),client:String(fields?.client||'').trim(),status:String(fields?.status||'Active'),notes:String(fields?.notes||''),createdAt:now(),updatedAt:now(),records:[],tasks:[]};
    data.projects.unshift(project);write(data);setActive(project.id);return clean(project);
  }
  function update(id,patch){
    const data=read(),project=data.projects.find(item=>item.id===id);if(!project)return null;
    ['name','address','client','status','notes'].forEach(key=>{if(patch&&patch[key]!==undefined)project[key]=String(patch[key])});project.updatedAt=now();write(data);return clean(project);
  }
  async function remove(id){
    const data=read(),before=data.projects.length;data.projects=data.projects.filter(item=>item.id!==id);if(data.projects.length===before)return false;write(data);if(active()===id)localStorage.removeItem(ACTIVE_KEY);
    const files=await listAttachments(id);await Promise.all(files.map(file=>deleteAttachment(file.id)));return true;
  }
  function addRecord(projectId,record){
    const data=read(),project=data.projects.find(item=>item.id===projectId);if(!project)throw new Error('Project not found.');
    const entry={id:uid('record'),module:String(record.module||'general'),title:String(record.title||'Saved record'),summary:String(record.summary||''),createdAt:now(),updatedAt:now(),attachmentId:record.attachmentId||null,attachmentName:record.attachmentName||'',data:clean(record.data||{})};
    project.records.unshift(entry);project.updatedAt=now();write(data);return clean(entry);
  }
  function updateRecord(projectId,recordId,patch){
    const data=read(),project=data.projects.find(item=>item.id===projectId),record=project?.records?.find(item=>item.id===recordId);if(!record)return null;
    ['title','summary'].forEach(key=>{if(patch&&patch[key]!==undefined)record[key]=String(patch[key])});if(patch&&patch.data!==undefined)record.data=clean(patch.data);record.updatedAt=now();project.updatedAt=now();write(data);return clean(record);
  }
  async function deleteRecord(projectId,recordId){
    const data=read(),project=data.projects.find(item=>item.id===projectId);if(!project)return false;const record=project.records.find(item=>item.id===recordId);project.records=project.records.filter(item=>item.id!==recordId);project.updatedAt=now();write(data);if(record?.attachmentId)await deleteAttachment(record.attachmentId);return true;
  }
  function addTask(projectId,task){
    const data=read(),project=data.projects.find(item=>item.id===projectId);if(!project)throw new Error('Project not found.');
    const entry={id:uid('task'),title:String(task.title||'New task').trim()||'New task',dueDate:String(task.dueDate||today()),dueTime:String(task.dueTime||''),priority:String(task.priority||'Normal'),notes:String(task.notes||''),done:false,createdAt:now(),completedAt:null};
    project.tasks.push(entry);project.updatedAt=now();write(data);return clean(entry);
  }
  function updateTask(projectId,taskId,patch){
    const data=read(),project=data.projects.find(item=>item.id===projectId),task=project?.tasks?.find(item=>item.id===taskId);if(!task)return null;
    ['title','dueDate','dueTime','priority','notes'].forEach(key=>{if(patch&&patch[key]!==undefined)task[key]=String(patch[key])});if(patch&&patch.done!==undefined){task.done=!!patch.done;task.completedAt=task.done?now():null}project.updatedAt=now();write(data);return clean(task);
  }
  function deleteTask(projectId,taskId){const data=read(),project=data.projects.find(item=>item.id===projectId);if(!project)return false;project.tasks=project.tasks.filter(item=>item.id!==taskId);project.updatedAt=now();write(data);return true}
  function dueTasks(date=today()){return list().flatMap(project=>(project.tasks||[]).filter(task=>!task.done&&task.dueDate<=date).map(task=>({...clean(task),projectId:project.id,projectName:project.name,overdue:task.dueDate<date}))).sort((a,b)=>(a.dueDate+a.dueTime).localeCompare(b.dueDate+b.dueTime))}
  function active(){return localStorage.getItem(ACTIVE_KEY)||''}
  function setActive(id){if(id)localStorage.setItem(ACTIVE_KEY,id);else localStorage.removeItem(ACTIVE_KEY);global.dispatchEvent(new CustomEvent('ac-active-project-changed',{detail:{id}}))}
  function snapshot(){return clean(read())}
  function replaceSnapshot(value){const next={version:1,projects:Array.isArray(value?.projects)?clean(value.projects):[]};write(next);return snapshot()}

  function db(){
    return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(STORE)){const store=database.createObjectStore(STORE,{keyPath:'id'});store.createIndex('projectId','projectId',{unique:false})}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  }
  function readBytes(file){if(file&&typeof file.arrayBuffer==='function')return file.arrayBuffer();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(file)})}
  async function saveAttachment(projectId,file){if(!file)return null;const bytes=await readBytes(file),entry={id:uid('file'),projectId,name:file.name||'attachment',type:file.type||'application/octet-stream',size:file.size||bytes.byteLength||0,createdAt:now(),bytes};const database=await db();await new Promise((resolve,reject)=>{const request=database.transaction(STORE,'readwrite').objectStore(STORE).put(entry);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});database.close();return{id:entry.id,name:entry.name,type:entry.type,size:entry.size}}
  async function getAttachment(id){if(!id)return null;const database=await db(),value=await new Promise((resolve,reject)=>{const request=database.transaction(STORE).objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)});database.close();if(value){if(value.bytes)value.blob=new Blob([value.bytes],{type:value.type});else if(value.blob&&!value.size)value.size=value.blob.size}return value}
  async function listAttachments(projectId){const database=await db(),values=await new Promise((resolve,reject)=>{const request=database.transaction(STORE).objectStore(STORE).index('projectId').getAll(projectId);request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)});database.close();return values}
  async function deleteAttachment(id){if(!id)return;const database=await db();await new Promise((resolve,reject)=>{const request=database.transaction(STORE,'readwrite').objectStore(STORE).delete(id);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});database.close()}
  async function attachmentToDataUrl(file){const buffer=file.bytes||(file.blob?await readBytes(file.blob):new ArrayBuffer(0)),bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));return'data:'+(file.type||'application/octet-stream')+';base64,'+btoa(binary)}
  function dataUrlToBytes(value){const data=String(value).split(',')[1]||'',bytes=atob(data),array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);return array.buffer}
  async function exportAll(){
    const data=read(),attachments=[];for(const project of data.projects){for(const file of await listAttachments(project.id)){attachments.push({id:file.id,projectId:file.projectId,name:file.name,type:file.type,size:file.size,createdAt:file.createdAt,data:await attachmentToDataUrl(file)})}}
    return JSON.stringify({format:'ac-project-backup',version:1,exportedAt:now(),data,attachments},null,2);
  }
  async function importAll(text){
    const backup=JSON.parse(text);if(backup?.format!=='ac-project-backup'||!Array.isArray(backup?.data?.projects))throw new Error('This is not a valid AC project backup.');
    const clearDb=await db();await new Promise((resolve,reject)=>{const request=clearDb.transaction(STORE,'readwrite').objectStore(STORE).clear();request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});clearDb.close();
    write({version:1,projects:backup.data.projects});for(const item of backup.attachments||[]){const database=await db(),entry={...item,bytes:dataUrlToBytes(item.data)};delete entry.data;await new Promise((resolve,reject)=>{const request=database.transaction(STORE,'readwrite').objectStore(STORE).put(entry);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});database.close()}return backup.data.projects.length;
  }

  global.ACProjects={list,get,create,update,remove,addRecord,updateRecord,deleteRecord,addTask,updateTask,deleteTask,dueTasks,today,active,setActive,snapshot,replaceSnapshot,saveAttachment,getAttachment,listAttachments,deleteAttachment,exportAll,importAll};
})(window);
