(function(){
  'use strict';
  if(!window.ACProjects||typeof window.ACProjectCapture!=='function')return;
  const css=document.createElement('style');css.textContent='.acp-fab{position:fixed;right:18px;bottom:18px;z-index:80;border:0;border-radius:16px;padding:14px 17px;background:#f5b400;color:#050505;font-weight:900;box-shadow:0 16px 45px rgba(0,0,0,.45);cursor:pointer}.acp-modal{position:fixed;inset:0;z-index:100;display:none;place-items:center;padding:16px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}.acp-modal.show{display:grid}.acp-box{width:min(500px,100%);padding:21px;border:1px solid #343434;border-radius:22px;background:#111;color:#f7f7f7;box-shadow:0 30px 90px rgba(0,0,0,.7)}.acp-box h2{margin:0 0 5px;font-size:23px}.acp-box p{margin:0 0 15px;color:#aaa;font-size:13px}.acp-box label{display:block;color:#aaa;font-size:12px;margin:10px 0 6px}.acp-box input,.acp-box select{width:100%;min-height:49px;padding:11px 12px;border:1px solid #333;border-radius:12px;background:#202020;color:#fff;font:inherit}.acp-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.acp-actions button,.acp-projects{min-height:48px;border:0;border-radius:13px;font-weight:850;cursor:pointer}.acp-save{background:#f5b400;color:#050505}.acp-cancel{background:#292929;color:#fff}.acp-projects{display:grid;place-items:center;margin-top:9px;border:1px solid #343434;color:#ddd;text-decoration:none}.acp-toast{position:fixed;left:50%;bottom:22px;z-index:120;transform:translateX(-50%);padding:12px 15px;border-radius:12px;background:#183723;color:#b9ffd1;box-shadow:0 18px 50px rgba(0,0,0,.5);font-weight:750}';document.head.appendChild(css);
  const fab=document.createElement('button');fab.className='acp-fab';fab.type='button';fab.textContent='Save to Project';document.body.appendChild(fab);
  const modal=document.createElement('div');modal.className='acp-modal';modal.innerHTML='<div class="acp-box"><h2>Save to Project</h2><p>Keep this result with the project estimates, site records and schedule.</p><label>Existing project</label><select id="acpProject"></select><label>Or create a new project</label><input id="acpNewName" placeholder="e.g. Rowville Project"><div class="acp-actions"><button class="acp-cancel" type="button">Cancel</button><button class="acp-save" type="button">Save</button></div><a class="acp-projects" href="../projects/index.html">Open Projects & Schedule</a></div>';document.body.appendChild(modal);
  const select=modal.querySelector('#acpProject'),newName=modal.querySelector('#acpNewName'),save=modal.querySelector('.acp-save');
  function refresh(){const projects=ACProjects.list(),active=ACProjects.active();select.innerHTML='<option value="">Select project</option>'+projects.map(project=>'<option value="'+project.id+'" '+(project.id===active?'selected':'')+'>'+escapeHtml(project.name)+'</option>').join('')}
  function escapeHtml(value){return String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))}
  function close(){modal.classList.remove('show');newName.value=''}
  function toast(message){const el=document.createElement('div');el.className='acp-toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
  fab.addEventListener('click',()=>{refresh();modal.classList.add('show')});modal.querySelector('.acp-cancel').addEventListener('click',close);modal.addEventListener('click',event=>{if(event.target===modal)close()});
  save.addEventListener('click',async()=>{
    save.disabled=true;save.textContent='Saving…';
    try{
      let projectId=select.value;const name=newName.value.trim();if(name)projectId=ACProjects.create({name}).id;if(!projectId)throw new Error('Select a project or enter a new project name.');
      const capture=await window.ACProjectCapture(),attachment=capture.attachment?await ACProjects.saveAttachment(projectId,capture.attachment):null;
      ACProjects.addRecord(projectId,{module:capture.module,title:capture.title,summary:capture.summary,data:capture.data,attachmentId:attachment?.id||null,attachmentName:attachment?.name||''});ACProjects.setActive(projectId);close();toast('Saved to '+ACProjects.get(projectId).name);
    }catch(error){alert(error.message||'The record could not be saved.')}
    finally{save.disabled=false;save.textContent='Save'}
  });
})();
