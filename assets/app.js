/* Public fixtures are separate from the authenticated organization API. */
window.COLDLINE_WORKSPACE_READY=(async () => {
 'use strict';
 const config=window.BRAND;
 if(!config) return;
 const $=(selector,root=document)=>root.querySelector(selector);
 const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const base=document.body.dataset.base||'./';
 const key='b2b:'+config.slug+':';
 const cloud=window.COLDLINE_WORKSPACE;
 const number=value=>Number(value).toLocaleString('en-NG',{maximumFractionDigits:1});
 const currency=value=>'₦'+Math.round(value).toLocaleString('en-NG');
 const planCurrency=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:2}).format(value);
 let storageAvailable=true;
 const memory=new Map();
 function read(store,item,fallback=null) {
  try {const value=window[store].getItem(key+item);return value===null?fallback:JSON.parse(value);}
  catch {storageAvailable=false;return memory.has(item)?memory.get(item):fallback;}
 }
 function write(store,item,value) {
  try {window[store].setItem(key+item,JSON.stringify(value));}
  catch {storageAvailable=false;memory.set(item,value);notify('Browser storage is unavailable. This change lasts only until the page is refreshed.');}
 }
 function remove(store,item) {try{window[store].removeItem(key+item);}catch{}memory.delete(item);}
 let toastTimer;
 function notify(message) {
  const feedback=$('dialog[open] .dialog-feedback');if(feedback)feedback.textContent=message;
  const node=$('.toast');if(!node)return;
  node.textContent=message;node.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),4200);
 }
 function download(content,type,name) {
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function enterDemo() {
  if(cloud){window.location.assign(window.COLDLINE_SITE.canonicalUrl+'dashboard/?demo=1');return;}
  write('sessionStorage','session',{demo:true,startedAt:Date.now()});
  if(!storageAvailable) {
   // Explicit public demo mode allows read-only navigation when storage is disabled.
   window.location.assign(base+'dashboard/?demo=1');
  } else window.location.assign(base+'dashboard/');
 }
 const menu=$('.menu-toggle');
 const workspaceLink=$('.nav-login');
 if(workspaceLink&&!cloud&&read('sessionStorage','session')?.demo){workspaceLink.href=base+'dashboard/';workspaceLink.textContent='My workspace';}
 if(menu) menu.addEventListener('click',()=>{
  const expanded=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(expanded));menu.setAttribute('aria-label',expanded?'Close menu':'Open menu');$('#primary-navigation').classList.toggle('open',expanded);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');$('#primary-navigation')?.classList.remove('open');}});
 $$('.demo-enter').forEach(button=>button.addEventListener('click',enterDemo));
 $('#login-form')?.addEventListener('submit',event=>{
  event.preventDefault();
  const valid=$('#login-email').value.trim().toLowerCase()===`demo@${config.slug}.example`&&$('#login-password').value==='MVPdemo2026!';
  $('#login-error').hidden=valid;
  if(valid)enterDemo();else $('#login-error').scrollIntoView({block:'nearest'});
 });
 $('#show-password')?.addEventListener('click',()=>{
  const input=$('#login-password');const show=input.type==='password';input.type=show?'text':'password';$('#show-password').textContent=show?'Hide':'Show';$('#show-password').setAttribute('aria-label',show?'Hide password':'Show password');$('#show-password').setAttribute('aria-pressed',String(show));
 });
 $$('[data-reset]').forEach(button=>button.addEventListener('click',()=>{
  if(!window.confirm('Restore the sample '+config.name+' workspace? This removes saved records, pilot briefs and the demo session for this brand in this browser.'))return;
  for(const item of ['records','brief','analyses'])remove('localStorage',item);
  remove('sessionStorage','session');
  if(document.body.dataset.page==='dashboard') window.location.assign(base+'login/');
  else window.location.reload();
 }));
 $$('[data-billing]').forEach(button=>button.addEventListener('click',()=>{
  const annual=button.dataset.billing==='annual';
  $$('[data-billing]').forEach(other=>{const active=other===button;other.classList.toggle('active',active);other.setAttribute('aria-pressed',String(active));});
  $$('[data-price]').forEach(node=>{const amount=Number(node.dataset.price)*(annual?.8:1);node.textContent=planCurrency(amount);const card=node.closest('.price-card');$('.billing-detail',card).textContent=annual?planCurrency(amount*12)+' billed annually':'Monthly plan price';});
 }));
 const slider=$('#scenario-range');
 if(slider)slider.addEventListener('input',()=>{
  const value=Number(slider.value);$('#scenario-input').value=number(value);
  $('#scenario-result').textContent=config.slug==='rill'?number(value*.15)+' m³':config.slug==='leasewell'?currency(value*50000):number(value*.25)+' hours';
 });
 const pilot=$('#pilot-form');
 if(pilot) {
  const saved=read('localStorage','brief');
  if(saved&&typeof saved==='object') {
   for(const field of ['name','email','organization','size','priority','message']) if(typeof saved[field]==='string')pilot.elements[field].value=saved[field];
   $('#pilot-result').hidden=false;
  }
  pilot.addEventListener('submit',event=>{
   event.preventDefault();
   if(!pilot.reportValidity())return;
   const data=Object.fromEntries(new FormData(pilot).entries());delete data.consent;
   for(const field of Object.keys(data))data[field]=String(data[field]).trim();
   data.product=config.name;data.savedAt=new Date().toISOString();
   write('localStorage','brief',data);$('#pilot-result').hidden=false;notify('Pilot brief saved on this device. No message was sent.');
  });
  $('#download-brief')?.addEventListener('click',()=>{
   const data=read('localStorage','brief');
   if(!data){notify('Save a pilot brief first.');return;}
   const text=`${config.name.toUpperCase()} — PILOT BRIEF\n\nLOCAL DRAFT ONLY — No message has been sent.\n\nName: ${data.name}\nWork email: ${data.email}\nOrganization: ${data.organization}\nTeam: ${data.size}\nPriority: ${data.priority}\n\nSuccess measure / context:\n${data.message}\n\nSaved: ${data.savedAt}\n`;
   download(text,'text/plain;charset=utf-8',config.slug+'-pilot-brief.txt');notify('Pilot brief downloaded.');
  });
 }
 if(document.body.dataset.page!=='dashboard')return;
 const publicDemo=new URLSearchParams(window.location.search).get('demo')==='1';
 if(!cloud&&!read('sessionStorage','session')?.demo&&!publicDemo){window.location.replace(base+'login/');return;}
 if(!cloud&&(!storageAvailable||publicDemo)){const notice=document.createElement('div');notice.className='storage-notice';notice.textContent='Public demonstration mode. If browser storage is disabled, changes will be lost when this page refreshes.';$('.app-main').prepend(notice);}
 const fixture=()=>config.records.map(row=>({id:row[0],name:row[1],place:row[2],value:row[3],score:row[4],status:row[5],owner:row[6],note:row[7]}));
 const saved=read('localStorage','records');
 const statuses=['Needs review','Scheduled',config.finalStatus];
 let records=Array.isArray(saved)&&saved.length<2000&&saved.every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&typeof r.place==='string'&&typeof r.owner==='string'&&typeof r.note==='string'&&Number.isFinite(r.value)&&r.value>=0&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100&&statuses.includes(r.status))?saved:fixture();
 let activeRecord=null,busy=false,acknowledged;
 if(cloud){
  try{records=await cloud.load();applyAccount();}
  catch(error){
   const gate=document.createElement('section');gate.className='workspace-gate';
   const title=document.createElement('h1');title.textContent=error.status===401?'Sign in to your workspace':'Your workspace needs attention';
   const message=document.createElement('p');message.textContent=error.message;
   const link=document.createElement('a');link.className='button';link.textContent=error.status===401?'Sign in with Microsoft':'Contact the team';link.href=error.status===401?'/.auth/login/aad?post_login_redirect_uri=/dashboard/':base+'contact/?intent=trial';
   const retry=document.createElement('a');retry.href=location.href;retry.textContent='Reload workspace';gate.append(title,message,link,retry);document.querySelector('.app-layout').replaceWith(gate);document.body.classList.remove('workspace-loading');return;
  }
 }
 acknowledged=structuredClone(records);
 async function persist(){
  if(busy){records=structuredClone(acknowledged);return false;}busy=true;
  const buttons=$$('#save-note,#complete-record,#reopen-record,#add-form [type="submit"]');buttons.forEach(button=>button.disabled=true);
  try{
   if(cloud)records=await cloud.save(records);else write('localStorage','records',records);
   acknowledged=structuredClone(records);activeRecord=records.find(record=>record.id===activeRecord?.id)||null;render();return true;
  }catch(error){records=structuredClone(acknowledged);activeRecord=records.find(record=>record.id===activeRecord?.id)||null;render();notify(error.message);return false;}
  finally{busy=false;buttons.forEach(button=>button.disabled=cloud&&!cloud.canWrite());if(activeRecord)$('#complete-record').disabled=activeRecord.status===config.finalStatus||(cloud&&!cloud.canWrite());}
 }
 function applyAccount(){
  const session=cloud.session;
  $('#add-dialog').setAttribute('aria-label','Register a shipment');
  const team=$('.w-team-card');team.innerHTML='<span class="eyebrow">YOUR ORGANIZATION</span><h2>Access, with the context.</h2><p></p><button class="text-link" type="button">View account details →</button>';$('p',team).textContent=session.trialEndsAt?'Trial access through '+new Date(session.trialEndsAt).toLocaleDateString('en-GB')+'. Your role: '+session.roles.join(', ')+'.':'Signed in to '+session.organization+'. Your role: '+session.roles.join(', ')+'.';$('button',team).addEventListener('click',()=>activateTab('settings'));
  $$('[data-account-organization]').forEach(node=>node.textContent=session.organization);
  $$('[data-account-identity]').forEach(node=>node.textContent=session.userDetails||session.userId);
  $$('[data-account-scope]').forEach(node=>node.textContent='Organization workspace');
  $$('[data-account-copy]').forEach(node=>node.textContent=node.dataset.accountCopy);
  $$('[data-demo-only]').forEach(node=>node.hidden=true);
  $$('[data-account-avatar]').forEach(node=>node.textContent=(session.organization||'CL').slice(0,2).toUpperCase());
  if(!cloud.canWrite())$$('.add-record,#save-note,#complete-record,#reopen-record').forEach(button=>button.disabled=true);
  const heading=$('#panel-settings .dashboard-heading p');heading.textContent='Your organization, role, and trial access are verified by the workspace service.';
  const card=$('#panel-settings .settings-card');card.replaceChildren();
  for(const [label,value] of [['Organization',session.organization],['Signed in as',session.userDetails||session.userId],['Role',session.roles.join(', ')],['Trial access',session.trialEndsAt?'Available until '+new Date(session.trialEndsAt).toLocaleDateString('en-GB'):'Organization membership'],['Storage','Shipment records and connected reports are stored in your organization’s Azure container.']]){const row=document.createElement('div'),h=document.createElement('h2'),p=document.createElement('p');h.textContent=label;p.textContent=value;row.append(h,p);card.append(row);}
  const activity=document.createElement('section');activity.className='settings-card';activity.innerHTML='<div><h2>Organization activity</h2><p data-cloud-usage>Loading recent usage…</p></div><div><h2>Recent audit events</h2><ol data-cloud-audit></ol></div>';$('#panel-reports').append(activity);
  Promise.allSettled([cloud.request('usage'),cloud.request('audit')]).then(([usage,audit])=>{
   const target=$('[data-cloud-usage]');target.textContent=usage.status==='fulfilled'?`${usage.value.reportCount} analyses in the last 30 days, across the latest ${usage.value.sampleLimit} retained reports. ${usage.value.averageLatencyMs===null?'No latency recorded yet.':'Average response: '+(usage.value.averageLatencyMs/1000).toFixed(1)+' seconds.'}`:'Usage could not be loaded. Reload to retry.';
   const list=$('[data-cloud-audit]');if(audit.status!=='fulfilled'){list.textContent='Audit events could not be loaded.';return;}if(!audit.value.events.length){list.textContent='No organization activity recorded yet.';return;}
   audit.value.events.slice(0,12).forEach(event=>{const li=document.createElement('li');li.textContent=event.action+' · '+new Date(event.timestamp).toLocaleString('en-GB');list.append(li);});
  });
  document.body.classList.remove('workspace-loading');
 }
 function statsHTML(interactive=false) {
  const total=records.reduce((sum,r)=>sum+r.value,0),done=records.filter(r=>r.status===config.finalStatus).length,attention=records.filter(r=>r.status==='Needs review').length;
  const scheduled=records.filter(r=>r.status==='Scheduled').length;
  return [[attention,'Needs review','Start with the open questions','Needs review'],[scheduled,'Scheduled','See the next planned shipments','Scheduled'],[done,config.finalStatus,'View completed handovers',config.finalStatus],[records.length,'All shipments',number(total)+' '+config.unit+' in the register','']].map(([value,label,note,status])=>{
   const content=`<span>${safe(label)}</span><strong>${number(value)}</strong><p>${safe(note)}</p>`;
   return interactive?`<button class="dashboard-stat" type="button" data-record-status="${safe(status)}" aria-label="${safe(label)}: ${number(value)} ${value===1?'shipment':'shipments'}">${content}<span class="w-stat-arrow" aria-hidden="true">↗</span></button>`:`<div class="dashboard-stat">${content}</div>`;
  }).join('');
 }
 function filtered() {
  const query=($('#record-search')?.value||'').trim().toLowerCase();const status=$('#status-filter')?.value||'';const sort=$('#record-sort')?.value||'priority';
  return records.filter(r=>(!status||r.status===status)&&(!query||[r.id,r.name,r.place,r.owner,r.note].some(value=>value.toLowerCase().includes(query)))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='value'?b.value-a.value:b.score-a.score);
 }
 function badge(status){return `<span class="status ${status==='Needs review'?'warn':''}"><i></i>${safe(status)}</span>`;}
 function tableHTML(rows) {
  if(!rows.length)return `<div class="empty-state"><h3>No matching ${safe(config.objects.toLowerCase())}.</h3><p>Try a different search or choose All statuses.</p></div>`;
  return `<div class="table-overflow"><table class="data-table"><thead><tr><th scope="col">${safe(config.object.toUpperCase())}</th><th scope="col">${safe(config.placeLabel.toUpperCase())}</th><th scope="col">${safe(config.unit.toUpperCase())}</th><th scope="col">PRIORITY</th><th scope="col">STATUS</th><th scope="col">OWNER</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button type="button" class="record-name" data-record="${safe(r.id)}">${safe(r.name)}<small>${safe(r.id)}</small></button></td><td><span class="record-place">${safe(r.place)}</span></td><td>${number(r.value)}</td><td><span class="priority-score"><i><span style="width:${r.score}%"></span></i>${r.score}</span></td><td>${badge(r.status)}</td><td>${safe(r.owner)}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function render() {
  $('#dashboard-stats').innerHTML=statsHTML(true);$('#report-summary').innerHTML=statsHTML();
  const queue=records.filter(r=>r.status==='Needs review').sort((a,b)=>b.score-a.score),count=queue.length;
  $('#attention-summary').textContent=count?`${count} ${count===1?'shipment is':'shipments are'} waiting for review. Start with the highest priority, then decide what happens next.`:'Your review queue is clear. Check scheduled shipments or register the next one.';
  $('#queue-count').textContent=number(count);
  $('#priority-queue').innerHTML=count?queue.map(r=>`<button class="w-queue-item" type="button" data-record="${safe(r.id)}"><span class="w-queue-copy"><span class="w-queue-reference">${safe(r.id)} · ${safe(r.place)}</span><strong>${safe(r.name)}</strong><span class="w-queue-note">${safe(r.note)}</span><span class="w-queue-owner">Assigned to ${safe(r.owner)}</span></span><span class="w-queue-priority"><strong>${r.score}</strong><span>priority</span><i aria-hidden="true">↗</i></span></button>`).join(''):'<div class="w-queue-empty"><strong>All caught up.</strong><p>There are no open condition warnings in your shipment register.</p><button class="text-link" type="button" data-record-status="Scheduled">View scheduled shipments →</button></div>';
  const done=records.filter(r=>r.status===config.finalStatus).length;
  $('#handover-progress').max=Math.max(records.length,1);$('#handover-progress').value=done;
  $('#handover-count').textContent=`${done} of ${records.length} shipments delivered`;
  $('#overview-table').innerHTML=tableHTML(records.filter(r=>r.status==='Scheduled').sort((a,b)=>b.score-a.score));
  const visible=filtered();$('#record-table').innerHTML=tableHTML(visible);$('#record-count').textContent=`Showing ${visible.length} of ${records.length} ${cloud?"organization":"sample"} ${config.objects.toLowerCase()} · ${cloud?"Saved to your organization workspace":"Changes saved in this browser"}`;
  $$('[data-record]').forEach(button=>button.addEventListener('click',()=>openRecord(button.dataset.record)));
 }
 function activateTab(tab,updateHash=true) {
  if(!['overview','records','review','reports','settings'].includes(tab))tab='overview';
  const triggerPanel=document.activeElement.closest('.app-panel');
  $$('.app-panel').forEach(panel=>panel.hidden=panel.id!=='panel-'+tab);
  $$('.app-tab').forEach(button=>{const active=button.dataset.tab===tab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('#breadcrumb').textContent=tab==='records'?config.objects:tab==='review'?'Review desk':tab[0].toUpperCase()+tab.slice(1);
  if(updateHash)history.replaceState(null,'','#'+tab);
  $('.app-sidebar').classList.remove('open');$('#app-menu').setAttribute('aria-expanded','false');
  if(triggerPanel?.hidden){const heading=$('#panel-'+tab+' h1, #panel-'+tab+' h2');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});}
 }
 function openRecords(status='') {
  $('#status-filter').value=status;$('#record-search').value='';$('#record-sort').value='priority';activateTab('records');render();
 }
 $$('.app-tab').forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
 $$('[data-open-records]').forEach(button=>button.addEventListener('click',()=>openRecords()));
 $$('[data-open-review]').forEach(button=>button.addEventListener('click',()=>activateTab('review')));
 $('#show-attention').addEventListener('click',()=>openRecords('Needs review'));
 $('#panel-overview').addEventListener('click',event=>{const metric=event.target.closest('[data-record-status]');if(metric)openRecords(metric.dataset.recordStatus);});
 $('#app-menu').addEventListener('click',()=>{const open=$('.app-sidebar').classList.toggle('open');$('#app-menu').setAttribute('aria-expanded',String(open));});
 document.addEventListener('click',event=>{if(window.innerWidth<=760&&!event.target.closest('.app-sidebar')&&!event.target.closest('#app-menu')){$('.app-sidebar').classList.remove('open');$('#app-menu').setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('.app-sidebar').classList.remove('open');$('#app-menu').setAttribute('aria-expanded','false');}});
 window.addEventListener('hashchange',()=>activateTab(window.location.hash.slice(1),false));
 $('#record-search').addEventListener('input',render);$('#status-filter').addEventListener('change',render);$('#record-sort').addEventListener('change',render);
 function openRecord(id) {
  activeRecord=records.find(r=>r.id===id);if(!activeRecord)return;
  $('#detail-reference').textContent=activeRecord.id+(cloud?' / ORGANIZATION RECORD':' / SAMPLE RECORD');$('#detail-name').textContent=activeRecord.name;
  const details=[[config.placeLabel,activeRecord.place],['Quantity',number(activeRecord.value)+' '+config.unit],[cloud?'Priority':'Sample priority',activeRecord.score+' / 100'],['Responsible operator',activeRecord.owner],['Current status',activeRecord.status]];
  $('#detail-meta').innerHTML=details.map(([label,value])=>`<div><dt>${safe(label)}</dt><dd>${safe(value)}</dd></div>`).join('');
  $('#detail-note').value=activeRecord.note;$('#detail-note').readOnly=Boolean(cloud&&!cloud.canWrite());
  $('#complete-record').disabled=activeRecord.status===config.finalStatus||(cloud&&!cloud.canWrite());
  $('#reopen-record').hidden=activeRecord.status!==config.finalStatus;
  $('#record-dialog .dialog-feedback').textContent='';$('#record-dialog').showModal();
 }
 $('#save-note').addEventListener('click',async()=>{
  if(!activeRecord||busy||(cloud&&!cloud.canWrite()))return;
  const value=$('#detail-note').value.trim();if(!value){notify('Add a sample observation before saving.');$('#detail-note').focus();return;}
  activeRecord.note=value.slice(0,1500);if(await persist())notify(cloud?'Note saved to your organization workspace.':'Note saved in this browser.');
 });
 $('#complete-record').addEventListener('click',async()=>{
  if(!activeRecord||busy||(cloud&&!cloud.canWrite()))return;activeRecord.note=$('#detail-note').value.trim().slice(0,1500)||activeRecord.note;activeRecord.status=config.finalStatus;if(await persist()){$('#record-dialog').close();notify(config.object+' updated: '+config.finalStatus+'.');}
 });
 $('#reopen-record').addEventListener('click',async()=>{if(!activeRecord||busy||(cloud&&!cloud.canWrite()))return;activeRecord.status='Needs review';if(await persist()){$('#record-dialog').close();notify(config.object+' reopened for review.');}});
 $$('.add-record').forEach(button=>button.addEventListener('click',()=>{$('#add-dialog .dialog-feedback').textContent='';$('#add-dialog').showModal();}));
 $('#add-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||(cloud&&!cloud.canWrite()))return;const form=event.currentTarget;if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));const value=Number(values.value),score=Number(values.score);
  if(!Number.isFinite(value)||value<=0||value>1000000||!Number.isFinite(score)||score<0||score>100)return;
  const fields=['name','place','owner','note'];if(fields.some(field=>!String(values[field]).trim())){notify('Complete each field with sample information.');return;}
  const prefix=config.records[0][0].split('-')[0];let counter=Math.max(...records.map(r=>Number(r.id.split('-').at(-1))||0),0)+1;
  records.unshift({id:prefix+'-'+counter,name:values.name.trim().slice(0,120),place:values.place.trim().slice(0,120),value,score,status:'Scheduled',owner:values.owner.trim().slice(0,80),note:values.note.trim().slice(0,1500)});
  $('#status-filter').value='';$('#record-search').value='';if(await persist()){$('#add-dialog').close();form.reset();activateTab('records');notify('New '+(cloud?'':'sample ')+config.object.toLowerCase()+' created.');}
 });
 function exportCSV(all=false) {
  const rows=all?records:filtered();if(!rows.length){notify('No matching records to export.');return;}
  function cell(value){let text=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
  const headers=['Reference',config.object,config.placeLabel,`Quantity (${config.unit})`,cloud?'Priority':'Sample priority','Status','Owner',config.noteLabel];
  const lines=[headers,...rows.map(r=>[r.id,r.name,r.place,r.value,r.score,r.status,r.owner,r.note])].map(row=>row.map(cell).join(','));
  download('\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8',config.slug+(cloud?'-organization':'-sample')+'-register.csv');notify(rows.length+(cloud?' organization':' sample')+' records exported.');
 }
 $$('[data-export]').forEach(button=>button.addEventListener('click',()=>exportCSV(false)));
 $$('[data-export-all]').forEach(button=>button.addEventListener('click',()=>exportCSV(true)));
 $('#logout').addEventListener('click',()=>{if(cloud){window.location.assign('/.auth/logout?post_logout_redirect_uri=/login/');return;}remove('sessionStorage','session');window.location.assign(base+'login/');});
 for(const dialog of $$('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
 render();activateTab(window.location.hash.slice(1)||'overview',false);
})();
