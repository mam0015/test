(function(){
  'use strict';
  const $=id=>document.getElementById(id),store=window.ACProjects;
  let currentId=store.active()||store.list()[0]?.id||'';
  const moduleInfo={electrical:['⚡','Electrical Estimate'],plumbing:['◉','Plumbing Estimate'],cladding:['▧','Cladding Estimate'],'renovation-budget':['⌂','Renovation Budget Plan'],'plan-estimate':['▤','Plan Estimate'],'quote-analysis':['⌁','Quote Analysis'],'site-checklist':['✓','Site Visit'],document:['▣','Project File / Note'],general:['•','Project Record']};
  function esc(value){return String(value==null?'':value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))}
  function dateText(value){if(!value)return'No date';const d=new Date(value+'T00:00:00');return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}
  function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
  function current(){return store.get(currentId)}

  $('newProjectBtn').addEventListener('click',()=>$('projectModal').classList.add('show'));
  $('projectModal').querySelector('.modal-cancel').addEventListener('click',closeModal);
  $('projectModal').addEventListener('click',event=>{if(event.target===$('projectModal'))closeModal()});
  $('projectModal').querySelector('.modal-save').addEventListener('click',()=>{
    const name=$('newName').value.trim();if(!name)return alert('Enter the project name.');
    const project=store.create({name,address:$('newAddress').value,client:$('newClient').value});currentId=project.id;closeModal();render();toast('Project created');
  });
  function closeModal(){$('projectModal').classList.remove('show');['newName','newAddress','newClient'].forEach(id=>$(id).value='')}
  $('addRecordBtn').addEventListener('click',()=>{if(!currentId)return;$('recordModal').classList.add('show')});
  $('recordModal').querySelector('.modal-cancel').addEventListener('click',closeRecordModal);
  $('recordModal').addEventListener('click',event=>{if(event.target===$('recordModal'))closeRecordModal()});
  $('recordModal').querySelector('.modal-save').addEventListener('click',async()=>{
    const title=$('recordTitle').value.trim();if(!title)return alert('Enter a title for this record.');
    const button=$('recordModal').querySelector('.modal-save');button.disabled=true;button.textContent='Saving…';
    try{const file=$('recordFile').files[0],attachment=file?await store.saveAttachment(currentId,file):null;store.addRecord(currentId,{module:'document',title,summary:$('recordSummary').value,attachmentId:attachment?.id||null,attachmentName:attachment?.name||'',data:{category:$('recordCategory').value}});closeRecordModal();render();showTab('records');toast('Record saved')}
    catch(error){alert(error.message||'The record could not be saved.')}finally{button.disabled=false;button.textContent='Save Record'}
  });
  function closeRecordModal(){$('recordModal').classList.remove('show');$('recordTitle').value='';$('recordSummary').value='';$('recordFile').value=''}

  document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>showTab(button.dataset.tab)));
  function showTab(name){document.querySelectorAll('.tab').forEach(button=>button.classList.toggle('active',button.dataset.tab===name));document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===name))}

  $('saveDetailsBtn').addEventListener('click',()=>{if(!currentId)return;store.update(currentId,{name:$('editName').value,address:$('editAddress').value,client:$('editClient').value,status:$('editStatus').value,notes:$('editNotes').value});render();showTab('details');toast('Project details saved')});
  $('deleteProjectBtn').addEventListener('click',async()=>{const project=current();if(!project||!confirm(`Delete "${project.name}" and all of its saved records, tasks and attachments from this device?`))return;await store.remove(project.id);currentId=store.list()[0]?.id||'';render()});
  $('taskForm').addEventListener('submit',event=>{event.preventDefault();if(!currentId)return;store.addTask(currentId,{title:$('taskTitle').value,dueDate:$('taskDate').value,dueTime:$('taskTime').value,priority:$('taskPriority').value});$('taskTitle').value='';$('taskTime').value='';render();showTab('schedule');toast('Task added')});
  $('exportBtn').addEventListener('click',async()=>{try{const text=await store.exportAll(),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AC_Project_Backup_'+store.today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){alert(error.message||'Backup could not be created.')}});
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(!confirm('Restore this backup? It will replace the projects currently saved on this device.'))return;try{const count=await store.importAll(await file.text());currentId=store.list()[0]?.id||'';render();toast(`${count} projects restored`)}catch(error){alert(error.message||'Backup could not be restored.')}finally{event.target.value=''}});

  function render(){
    renderToday();renderProjectList();const project=current();$('emptyDetail').style.display=project?'none':'grid';$('detail').classList.toggle('show',!!project);if(!project)return;
    store.setActive(project.id);$('projectTitle').textContent=project.name;$('projectSubtitle').textContent=[project.address,project.client,project.status].filter(Boolean).join(' • ')||'Project workspace';
    $('editName').value=project.name||'';$('editAddress').value=project.address||'';$('editClient').value=project.client||'';$('editStatus').value=project.status||'Active';$('editNotes').value=project.notes||'';
    const open=(project.tasks||[]).filter(task=>!task.done),done=(project.tasks||[]).filter(task=>task.done),today=open.filter(task=>task.dueDate===store.today());
    $('recordStat').textContent=(project.records||[]).length;$('taskStat').textContent=open.length;$('todayStat').textContent=today.length;$('doneStat').textContent=done.length;
    $('taskDate').value=$('taskDate').value||store.today();renderRecords(project);renderTasks(project);
  }
  function renderProjectList(){
    const projects=store.list();$('projectList').innerHTML=projects.length?projects.map(project=>{const open=(project.tasks||[]).filter(task=>!task.done).length;return `<button class="project-item ${project.id===currentId?'active':''}" data-id="${project.id}"><strong>${esc(project.name)}</strong><span>${esc(project.address||project.status||'Project')}</span><span class="project-meta"><em>${(project.records||[]).length} records</em><em>${open} tasks</em></span></button>`}).join(''):'<div class="empty-list">No projects yet.</div>';
    $('projectList').querySelectorAll('[data-id]').forEach(button=>button.addEventListener('click',()=>{currentId=button.dataset.id;store.setActive(currentId);render()}));
  }
  function renderToday(){
    const tasks=store.dueTasks(),panel=$('todayPanel');panel.classList.toggle('show',tasks.length>0);$('todayCount').textContent=`${tasks.length} task${tasks.length===1?'':'s'}`;if(!tasks.length){$('todayList').innerHTML='';return}
    $('todayList').innerHTML=tasks.slice(0,9).map(task=>`<button class="today-task ${task.overdue?'overdue':''}" data-project="${task.projectId}" style="color:inherit;text-align:left;cursor:pointer"><strong>${esc(task.title)}</strong><span>${esc(task.projectName)} • ${task.overdue?'Overdue '+dateText(task.dueDate):'Today'}${task.dueTime?' • '+esc(task.dueTime):''}</span></button>`).join('');
    $('todayList').querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{currentId=button.dataset.project;render();showTab('schedule')}));
  }
  function renderRecords(project){
    const records=project.records||[];$('recordList').innerHTML=records.length?records.map(record=>{const info=moduleInfo[record.module]||moduleInfo.general;return `<article class="record" data-record="${record.id}"><div class="record-icon">${info[0]}</div><div><strong>${esc(record.title||info[1])}</strong><span>${esc(info[1])} • ${new Date(record.createdAt).toLocaleString('en-AU')}${record.summary?' • '+esc(record.summary):''}</span>${record.attachmentName?'<span>Attachment: '+esc(record.attachmentName)+'</span>':''}</div><div class="record-actions"><button data-action="open">Open</button>${record.attachmentId?'<button data-action="file">File</button>':''}<button class="danger" data-action="delete">Delete</button></div></article>`}).join(''):'<div class="empty-list">No records saved yet. Open a calculator, plan estimator, quote analysis or checklist and choose “Save to Project”.</div>';
    $('recordList').querySelectorAll('[data-record]').forEach(card=>card.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>recordAction(project.id,card.dataset.record,button.dataset.action))));
  }
  async function recordAction(projectId,recordId,action){
    const project=store.get(projectId),record=project?.records?.find(item=>item.id===recordId);if(!record)return;
    if(action==='delete'){if(confirm('Delete this saved record?')){await store.deleteRecord(projectId,recordId);render()}return}
    if(action==='file'){const file=await store.getAttachment(record.attachmentId);if(!file)return alert('The attachment is no longer available on this device.');const url=URL.createObjectURL(file.blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
    openRecord(project,record);
  }
  function openRecord(project,record){
    const data=record.data||{};
    if(['electrical','plumbing','cladding'].includes(record.module)){const key={electrical:'ac_ai_electrical_prefill_v1',plumbing:'ac_ai_plumbing_prefill_v1',cladding:'ac_ai_cladding_prefill_v1'}[record.module];localStorage.setItem(key,JSON.stringify({quantities:data.quantities||[],project:project.name,customer:data.customer||project.client||'',mode:data.mode||'customer',createdAt:new Date().toISOString()}));location.href='../'+record.module+'/index.html';return}
    if(record.module==='plan-estimate'){const trade=data.trade||'electrical',key={electrical:'ac_ai_electrical_prefill_v1',plumbing:'ac_ai_plumbing_prefill_v1',cladding:'ac_ai_cladding_prefill_v1'}[trade],items=data.items||[],length={electrical:23,plumbing:25,cladding:11}[trade],quantities=Array(length).fill(0);items.forEach(item=>{if(item.catalog_index>=0&&item.catalog_index<length)quantities[item.catalog_index]=item.quantity});localStorage.setItem(key,JSON.stringify({quantities,project:project.name,mode:'customer',createdAt:new Date().toISOString()}));location.href='../'+trade+'/index.html';return}
    if(record.module==='quote-analysis'){localStorage.setItem('ac_project_quote_restore_v1',JSON.stringify({trade:data.trade||'electrical',result:data.result,items:data.items}));location.href='../quote-analysis/index.html';return}
    if(record.module==='site-checklist'){localStorage.setItem('ac_project_checklist_restore_v1',JSON.stringify(data.state||{}));location.href='../checklist/index.html';return}
    if(record.module==='renovation-budget'){localStorage.setItem('ac_project_renovation_restore_v1',JSON.stringify({state:data.state||data,projectId:project.id,recordId:record.id}));location.href='../renovation-budget/index.html';return}
    alert(record.summary||'The record is saved in this project.');
  }
  function renderTasks(project){
    const tasks=[...(project.tasks||[])].sort((a,b)=>(a.done-b.done)||(a.dueDate+a.dueTime).localeCompare(b.dueDate+b.dueTime));$('taskList').innerHTML=tasks.length?tasks.map(task=>{const overdue=!task.done&&task.dueDate<store.today();return `<div class="task ${task.done?'done':''}" data-task="${task.id}"><button class="task-check" data-action="toggle" aria-label="Complete task"></button><div><div class="task-title">${esc(task.title)}</div><div class="task-meta"><span class="${overdue?'overdue':''}">${overdue?'Overdue • ':''}${dateText(task.dueDate)}${task.dueTime?' at '+esc(task.dueTime):''}</span><span class="priority">${esc(task.priority)}</span></div></div><button class="task-remove" data-action="delete">Delete</button></div>`}).join(''):'<div class="empty-list">No scheduled work for this project.</div>';
    $('taskList').querySelectorAll('[data-task]').forEach(row=>row.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{const id=row.dataset.task;if(button.dataset.action==='toggle'){const task=project.tasks.find(item=>item.id===id);store.updateTask(project.id,id,{done:!task.done})}else if(confirm('Delete this task?'))store.deleteTask(project.id,id);render();showTab('schedule')})));
  }
  window.addEventListener('ac-projects-changed',()=>{if(currentId&&!store.get(currentId))currentId=store.list()[0]?.id||''});
  render();
})();
