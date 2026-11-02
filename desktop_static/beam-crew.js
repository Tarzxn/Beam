'use strict';
(() => {
  const crew = {mode:false,project:null,data:null,selected:null,detail:null,events:[],after:0,epoch:0,filterBot:null,showArchived:false,loading:false,polling:false,offline:false,lastDetail:'',drafts:new Map(),busyAction:false,avatar:null};
  const activeStates = new Set(['queued','running','approval','privacy','waiting_team','stopping']);
  const labels = {draft:'Draft',queued:'Queued',running:'Working',approval:'Approval needed',privacy:'Privacy choice needed',waiting_input:'Your reply needed',waiting_team:'Waiting for team',done:'Completed',failed:'Failed',stopped:'Stopped',needs_attention:'Needs attention',interrupted:'Interrupted',stopping:'Stopping'};
  const displayStatus = s => labels[s] || s || 'Ready';
  const botById = id => crew.data?.bots?.find(b=>b.id===id);
  const taskById = id => crew.data?.tasks?.find(t=>t.id===id);
  const shortName = b => b?.name || 'Specialist';
  const initials = name => String(name||'B').trim().split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase();
  const botColor = b => /^#[a-f\d]{6}$/i.test(b?.color||'') ? b.color : '';
  const styleColor = b => botColor(b) ? `style="color:${botColor(b)}"` : '';
  const jsonText = v => {try{return JSON.stringify(v,null,2)}catch{return String(v)}};
  const taskBusy = () => activeStates.has(crew.detail?.task?.status);
  const workingNow = () => !crew.offline && crew.detail?.task?.status==='running' && crew.detail?.run?.working===true;
  function currentProject(){return state.project?.id || null}
  function saveReply(){if(crew.selected)crew.drafts.set(crew.selected,$('#crew-reply').value)}
  function mode(code){
    const enabled=code==='crew';
    crew.mode=enabled;
    document.body.classList.toggle('crew-mode',enabled);
    $('#crew-space').classList.toggle('hidden',!enabled);
    $('#code-space').classList.toggle('hidden',enabled);
    $('#workspace-mode-label').textContent=enabled?'Crew':'Studio';
    $('#beam-mode-code').classList.toggle('active',!enabled);
    $('#beam-mode-crew').classList.toggle('active',enabled);
    $('#beam-mode-code').setAttribute('aria-pressed',String(!enabled));
    $('#beam-mode-crew').setAttribute('aria-pressed',String(enabled));
    $('#beam-product-label').textContent=enabled?'Crew':'Studio';
    $('#beam-product-description').textContent=enabled?'Team workspace':'Personal workspace';
    $('#beam-product-symbol').textContent=enabled?'C':'S';
    $('#workspace-switcher').open=false;
    if(enabled){safely(loadWorkspace)();}else updateStatus();
  }
  async function ensureProject(){
    if(state.project)return state.project;
    const p=await api('workspace',{});
    await refreshState();setProject(p);await refreshFiles();return p;
  }
  async function loadWorkspace(force=false){
    const project=currentProject();
    if(project!==crew.project){
      saveReply();crew.epoch++;crew.project=project;crew.selected=null;crew.detail=null;crew.events=[];crew.after=0;crew.data=null;crew.filterBot=null;crew.lastDetail='';
      renderDetail();renderHealth();
    }
    $('#crew-no-project').classList.toggle('hidden',!!project);
    $('#crew-content').classList.toggle('hidden',!project);
    $('#crew-brief-button').disabled=!project;
    if(!project)return;
    if(crew.loading&&!force)return;
    crew.loading=true;
    const epoch=crew.epoch;
    try{
      const data=await api('crew?project_id='+encodeURIComponent(project));
      if(epoch!==crew.epoch||project!==currentProject())return;
      crew.data=data;crew.offline=!!data.disconnected;renderOverview();
      if(crew.selected)await loadDetail(false);
    }catch(error){
      if(epoch===crew.epoch){crew.offline=true;renderHealth();renderBots();renderTasks();renderRunStatus();if(force||!crew.data)toast(error.message);}
    }finally{crew.loading=false;}
  }
  function renderHealth(){
    const tasks=crew.data?.tasks||[];
    const running=tasks.filter(t=>t.status==='running').length;
    const waiting=tasks.filter(t=>['approval','privacy','waiting_input','needs_attention'].includes(t.status)).length;
    const queued=tasks.filter(t=>['queued','waiting_team'].includes(t.status)).length;
    const health=$('#crew-health');
    health.className='crew-health'+(crew.offline?' is-offline':running?' is-working':waiting?' is-waiting':'');
    health.textContent=crew.offline?'Connection interrupted':running?running+' working':waiting?waiting+' needs you':queued?queued+' queued / delegated':'Ready';
    const count=$('#crew-nav-count');
    count.textContent=waiting||running||'';
    count.classList.toggle('hidden',!(waiting||running));
    count.title=waiting?waiting+' tasks need your attention':running+' tasks working';
  }
  function renderBots(){
    const bots=crew.data?.bots||[],tasks=crew.data?.tasks||[];
    const archived=bots.filter(b=>b.archived).length;
    const visible=bots.filter(b=>crew.showArchived||!b.archived);
    $('#crew-bots').innerHTML=visible.map(b=>{
      const current=tasks.filter(t=>t.bot_id===b.id&&activeStates.has(t.status));
      const needs=tasks.some(t=>t.bot_id===b.id&&['approval','privacy','waiting_input','needs_attention'].includes(t.status));
      const running=current.some(t=>t.status==='running');
      const text=b.archived?'Archived':crew.offline?'Status unavailable':needs?'Needs you':running?'Working':current.length?current.length+' queued / delegated':'Available';
      return `<div class="crew-bot-card ${crew.filterBot===b.id?'selected':''} ${b.archived?'archived':''}"><button class="crew-bot-main" data-crew-bot="${esc(b.id)}" title="Show ${esc(b.name)}’s tasks"><span class="crew-avatar" ${styleColor(b)}>${window.beamAvatars?window.beamAvatars.render(b.avatar):esc(initials(b.name))}</span><strong>${esc(b.name)}</strong><span class="crew-role">${esc(b.role)}</span><span class="crew-bot-state ${!crew.offline&&running?'active':''} ${needs?'needs-you':''}">${esc(text)}</span></button><button class="crew-bot-edit" data-crew-edit-bot="${esc(b.id)}" title="Edit ${esc(b.name)}’s profile and memory" aria-label="Edit ${esc(b.name)} profile">⋯</button></div>`;
    }).join('')+(archived?`<button class="crew-bot-archive-toggle" id="crew-show-archived">${crew.showArchived?'Hide archived specialists':'Show '+archived+' archived specialist'+(archived===1?'':'s')}</button>`:'');
    $$('[data-crew-bot]').forEach(b=>b.onclick=()=>{crew.filterBot=crew.filterBot===b.dataset.crewBot?null:b.dataset.crewBot;renderBots();renderTasks()});
    $$('[data-crew-edit-bot]').forEach(b=>b.onclick=()=>editBot(b.dataset.crewEditBot));
    if($('#crew-show-archived'))$('#crew-show-archived').onclick=()=>{crew.showArchived=!crew.showArchived;renderBots()};
  }
  function renderTasks(){
    const all=crew.data?.tasks||[],filter=$('#crew-task-filter').value;
    const matches=t=>(!crew.filterBot||t.bot_id===crew.filterBot)&&(filter==='all'||filter==='active'&&activeStates.has(t.status)||filter==='attention'&&['approval','privacy','waiting_input','needs_attention','failed','interrupted'].includes(t.status)||filter==='done'&&t.status==='done');
    const tasks=all.filter(matches).sort((a,b)=>Number(b.updated||b.created)-Number(a.updated||a.created));
    $('#crew-task-count').textContent=all.length;
    const clear=$('#crew-bot-filter');clear.textContent=(shortName(botById(crew.filterBot)))+' ×';clear.classList.toggle('hidden',!crew.filterBot);
    $('#crew-tasks').innerHTML=tasks.length?tasks.map(t=>{
      const parent=t.parent_id?taskById(t.parent_id):null;
      return `<button class="crew-task-row ${crew.selected===t.id?'selected':''} ${t.parent_id?'child-task':''}" data-crew-task="${esc(t.id)}" title="${esc(t.title)}"><span class="crew-delegated ${t.parent_id?'':'hidden'}">↳ ${esc(parent?.title||'Delegated task')}</span><strong>${esc(t.title)}</strong><small><span class="crew-dot ${esc(crew.offline&&t.status==='running'?'unknown':t.status)}"></span><span>${esc(shortName(botById(t.bot_id)))}</span><span class="crew-task-state">${esc(crew.offline&&t.status==='running'?'Status unavailable':displayStatus(t.status))}</span></small></button>`;
    }).join(''):`<div class="crew-empty-list">${all.length?'No tasks match this filter.':'No tasks yet.<br>Create a task for your team.'}</div>`;
    $$('[data-crew-task]').forEach(b=>b.onclick=safely(()=>selectTask(b.dataset.crewTask)));
  }
  function renderActivity(){
    const entries=crew.data?.activity||[];
    $('#crew-activity-list').innerHTML=entries.length?entries.slice(0,24).map(a=>`<div class="crew-activity-item"><b>${esc(shortName(botById(a.bot_id)))}</b> · ${esc(a.text)}${a.task_id?` <button class="text-button" data-crew-activity-task="${esc(a.task_id)}">View ↗</button>`:''}</div>`).join(''):'<div class="crew-activity-item">Handoffs and team updates appear here.</div>';
    $$('[data-crew-activity-task]').forEach(b=>b.onclick=safely(()=>selectTask(b.dataset.crewActivityTask)));
  }
  function renderOverview(){renderHealth();renderBots();renderTasks();renderActivity();if(crew.detail&&crew.selected){const updated=taskById(crew.selected);if(updated){crew.detail.task=updated;renderDetailHeader();renderRunStatus();}}}
  async function selectTask(id){
    if(id===crew.selected){await loadDetail(false);return;}
    saveReply();crew.epoch++;crew.selected=id;crew.detail=null;crew.events=[];crew.after=0;crew.lastDetail='';
    $('#crew-reply').value=crew.drafts.get(id)||'';renderTasks();renderDetail();
    await loadDetail(true);
  }
  async function loadDetail(initial){
    const id=crew.selected,epoch=crew.epoch;if(!id)return;
    let page;
    do{
      page=await api(`crew/tasks/${encodeURIComponent(id)}?after=${crew.after}`);
      if(id!==crew.selected||epoch!==crew.epoch)return;
      crew.detail=page;crew.events.push(...(page.events||[]));
      if(page.events?.length)crew.after=page.events.at(-1).seq;
    }while(page.events?.length===2000);
    crew.offline=!!page.disconnected;
    renderDetail();
    if(initial)$('#crew-conversation').scrollTop=$('#crew-conversation').scrollHeight;
  }
  function renderDetailHeader(){
    const t=crew.detail?.task;if(!t)return;
    const bot=botById(t.bot_id);
    $('#crew-task-title').textContent=t.title;
    $('#crew-task-meta').textContent=`${shortName(bot)} · ${bot?.role||'Specialist'} · ${crew.data?.cloud?'Cloud Crew':'This PC coordinator'} · ${(t.effort||'high').replace(/^./,c=>c.toUpperCase())} effort · ${t.mode==='plan'?'Plan only':t.mode==='edit'?'Project edits allowed':'Ask before changes'}`;
    const parent=$('#crew-parent-link');parent.classList.toggle('hidden',!t.parent_id);
    if(t.parent_id){const p=taskById(t.parent_id);parent.innerHTML=`Delegated from <button id="crew-go-parent">${esc(p?.title||'Lead task')} ↗</button>`;$('#crew-go-parent').onclick=safely(()=>selectTask(t.parent_id));}
  }
  function renderDetail(){
    $('#crew-task-empty').classList.toggle('hidden',!!crew.selected);
    $('#crew-task-view').classList.toggle('hidden',!crew.selected);
    if(!crew.selected)return;
    if(!crew.detail){$('#crew-task-title').textContent='Loading task…';$('#crew-task-meta').textContent='';$('#crew-timeline').innerHTML='';$('#crew-parent-link').classList.add('hidden');$('#crew-working').classList.add('hidden');$('#crew-task-status').textContent='Loading…';$('#crew-send').disabled=true;$('#crew-stop').classList.add('hidden');return;}
    renderDetailHeader();
    const signature=JSON.stringify([crew.after,crew.detail.task.status,crew.detail.pending,crew.detail.privacy_pending,crew.detail.run?.status,crew.data?.tasks?.filter(t=>t.parent_id===crew.selected).map(t=>[t.id,t.status])]);
    if(signature!==crew.lastDetail){renderConversation();crew.lastDetail=signature;}
    renderRunStatus();
  }
  function renderConversation(){
    const scroll=$('#crew-conversation'),stick=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<100;
    const opens=new Set($$('#crew-timeline .tool-card[open]').map(e=>e.dataset.call));
    const events=crew.events,t=crew.detail.task,bot=botById(t.bot_id);
    const results=new Map(events.filter(e=>e.type==='result').map(e=>[e.call_id,e]));
    const decisions=new Map(events.filter(e=>e.type==='decision').map(e=>[e.action_id,e]));
    const latestUser=events.filter(e=>e.type==='user').at(-1)?.seq||0;
    let html='',stream='';
    const assistant=text=>`<div class="message assistant"><div class="crew-agent-label"><span ${styleColor(bot)}>◈</span>${esc(shortName(bot))}</div>${markdown(text)}</div>`;
    for(const e of events){
      if(e.type==='user')html+='<div class="message user">'+esc(e.text)+'</div>';
      else if(e.type==='delta')stream+=e.text;
      else if(e.type==='assistant'){stream='';if(e.text)html+=assistant(e.text);}
      else if(e.type==='tool'){
        const r=results.get(e.call_id)?.result;
        const text=r?(r.error||r.status==='Timed out'||Number.isInteger(r.exit_code)&&r.exit_code!==0)?'Failed':r.denied?'Declined':r.waiting_for_user?'Waiting':r.cached?'Reused':'Done':e.seq>=latestUser&&t.status==='approval'?'Approval needed':e.seq>=latestUser&&t.status==='running'?'Working':'Interrupted';
        const args=e.arguments||{},target=args.path||args.command||args.query||args.title||args.bot_id||'';
        const toolName=(typeof toolNames!=='undefined'&&toolNames[e.name])||({crew_delegate:'Delegate task',crew_message:'Message teammate',crew_remember:'Save specialist memory',crew_tasks:'Review team tasks',crew_board:'Review team tasks',crew_handoff:'Hand off task'}[e.name])||e.name;
        html+=`<details class="tool-card" data-call="${esc(e.call_id)}" ${opens.has(e.call_id)?'open':''}><summary>${esc(toolName)} <span class="tool-target">${esc(target)}</span><span class="tool-result-state">${esc(text)}</span></summary><pre>${esc(jsonText(r||args))}</pre></details>`;
      }else if(e.type==='privacy'){
        html+=window.beamPrivacy?.checkpoint(e,events,t.session_id,(crew.offline?null:window.beamPrivacy.pendingFor(crew.detail,t.status,events)))||'';
      }else if(e.type==='private_summary'){
        html+=window.beamPrivacy?.summary(e)||'';
      }else if(e.type==='approval'){
        const decision=decisions.get(e.action_id),pending=crew.detail.pending?.action_id===e.action_id&&t.status==='approval';
        html+=`<div class="approval"><div class="approval-header">${icon('shield')} ${esc(shortName(bot))} needs your approval</div><p>${esc(e.name)}</p><pre>${esc(e.diff||jsonText(e.arguments||{}))}</pre>${decision?`<p>${decision.allowed?'Approved':'Declined'}</p>`:pending?`<div class="approval-actions"><button class="secondary-button" data-crew-decision="no" data-crew-action="${esc(e.action_id)}">Decline</button><button class="primary-button" data-crew-decision="yes" data-crew-action="${esc(e.action_id)}">Allow once</button></div>`:'<p>This request is no longer pending.</p>'}</div>`;
      }else if(e.type==='question'){
        html+=`<div class="user-question"><p>${esc(e.question)}</p>${e.seq>=latestUser&&t.status==='waiting_input'?`<div class="question-options">${(e.options||[]).map(v=>`<button class="secondary-button" data-crew-answer="${esc(v)}">${esc(v)}</button>`).join('')}</div>`:''}</div>`;
      }else if(e.type==='artifact'){
        html+=`<button class="artifact" data-crew-artifact="${esc(e.path)}"><span class="file-badge">${esc(String(e.kind||'file').toUpperCase())}</span><span><strong>${esc(e.path)}</strong><small>${Math.ceil((e.bytes||0)/1024)} KB · Saved to project</small>${(e.warnings||[]).map(w=>`<small>${esc(w)}</small>`).join('')}</span><span class="artifact-arrow">↗</span></button><div class="artifact-related">${(e.companions||[]).filter(p=>/\.(glb|svg|csv|zip)$|\.model\.json$|-dimensions\.png$/.test(p)).map(p=>`<button class="small-button" data-crew-artifact="${esc(p)}">${esc(p.split('/').at(-1))}</button>`).join('')}</div>`;
      }else if(e.type==='error')html+='<div class="error-message">'+esc(e.text)+'</div>';
      else if(e.type==='notice')html+='<div class="notice">'+esc(e.text)+'</div>';
      else if(e.type==='crew_handoff'||e.type==='crew_message'||e.type==='crew_delegate')html+='<div class="crew-handoff">'+esc(e.text||e.message||e.title||'Team handoff recorded.')+'</div>';
      else if(e.type==='done'&&e.status==='stopped')html+='<div class="notice">Task stopped.</div>';
      else if(e.type==='terminal')html+=`<details class="tool-card"><summary>Command output</summary><pre>${esc(e.text)}</pre></details>`;
    }
    if(!events.some(e=>e.type==='user')&&t.prompt)html='<div class="message user">'+esc(t.prompt)+'</div>'+html;
    if(stream)html+=assistant(stream);
    const children=(crew.data?.tasks||[]).filter(child=>child.parent_id===t.id);
    if(children.length)html+=`<div class="crew-handoff">${children.length} specialist task${children.length===1?'':'s'} linked to this goal.</div><div class="crew-children">${children.map(child=>`<button data-crew-child="${esc(child.id)}">${esc(shortName(botById(child.bot_id)))} · ${esc(child.title)}<br>${esc(displayStatus(child.status))} ↗</button>`).join('')}</div>`;
    $('#crew-timeline').innerHTML=html;
    $$('[data-crew-decision]').forEach(button=>button.onclick=safely(async()=>{
      const taskId=crew.selected;button.disabled=true;
      try{await api(`crew/tasks/${taskId}/approve`,{action_id:button.dataset.crewAction,allowed:button.dataset.crewDecision==='yes'});await loadWorkspace(true);}
      finally{if(button.isConnected)button.disabled=false;}
    }));
    $$('[data-crew-answer]').forEach(button=>button.onclick=()=>{$('#crew-reply').value=button.dataset.crewAnswer;$('#crew-reply').focus()});
    $$('[data-crew-artifact]').forEach(button=>button.onclick=safely(()=>openArtifact(button.dataset.crewArtifact)));
    $$('[data-crew-child]').forEach(button=>button.onclick=safely(()=>selectTask(button.dataset.crewChild)));
    window.beamPrivacy?.bind($('#crew-timeline'),()=>loadWorkspace(true));
    if(stick)scroll.scrollTop=scroll.scrollHeight;
  }
  function renderRunStatus(){
    if(!crew.detail)return;
    const t=crew.detail.task,run=crew.detail.run||{},running=workingNow(),busy=taskBusy();
    let text=crew.offline?'Cloud connection unavailable. Resume the computer in Project computer to update its status.':t.status==='queued'?'Queued. A specialist will start when the shared workspace is free.':t.status==='waiting_team'?'Waiting for delegated specialists. The Lead will bring their results together.':t.status==='privacy'?'Waiting for your privacy choice.':t.status==='approval'?'Waiting for your approval.':t.status==='waiting_input'?'Waiting for your reply.':t.status==='running'?(run.label||'Working'):t.status==='interrupted'?'This task was interrupted when Beam closed. Send a follow-up to resume.':t.status==='needs_attention'?'The task reached a work limit. Review the progress and send a follow-up.':displayStatus(t.status);
    $('#crew-task-status').textContent=text;
    $('#crew-working').classList.toggle('hidden',!running);
    $('#crew-working-detail').textContent=run.label||'Thinking';
    const elapsed=run.elapsed_seconds||0;
    $('#crew-working-elapsed').textContent=elapsed>=60?Math.floor(elapsed/60)+'m '+elapsed%60+'s':elapsed+'s';
    $('#crew-stop').classList.toggle('hidden',!busy);
    $('#crew-stop').disabled=crew.busyAction||t.status==='stopping';
    $('#crew-send').classList.toggle('hidden',busy);
    $('#crew-send').disabled=crew.busyAction||crew.offline;
    $('#crew-reply').disabled=false;
    $('#crew-reply').placeholder=busy?'Draft a follow-up while the crew works…':t.status==='waiting_input'?'Answer the specialist’s question…':'Add a follow-up or a new instruction…';
    $('#crew-reply-note').textContent=busy?'Your draft stays here. Stop or wait to send.':'Follow-ups stay with this specialist.';
  }
  function assigneeOptions(selected){
    const bots=(crew.data?.bots||[]).filter(b=>!b.archived);
    $('#crew-new-assignee').innerHTML=bots.map(b=>`<option value="${esc(b.id)}">${esc(b.name)} · ${esc(b.role)}</option>`).join('');
    const lead=bots.find(b=>b.id==='lead'||/lead|coordinator/i.test(b.role));
    $('#crew-new-assignee').value=selected&&bots.some(b=>b.id===selected)?selected:lead?.id||bots[0]?.id||'';
  }
  async function newTask(prompt){
    await ensureProject();await loadWorkspace(true);
    if(!crew.data)return;
    assigneeOptions(crew.filterBot);
    $('#crew-new-effort').value=typeof effortLevels!=='undefined'?effortLevels[effortValue]:'high';
    $('#crew-new-mode').value=crew.data?.cloud&&crew.data?.trusted?'edit':$('#mode').value||'ask';
    if(typeof prompt==='string')$('#crew-new-prompt').value=prompt;
    $('#crew-task-form-error').textContent='';$('#crew-task-dialog').showModal();$('#crew-new-prompt').focus();
  }
  async function createTask(event){
    event.preventDefault();
    if(!state.configured&&!crew.data?.cloud){$('#crew-task-form-error').textContent='Add an Ollama Cloud API key in Settings before starting a task.';return;}
    const button=$('#crew-create-task');button.disabled=true;$('#crew-task-form-error').textContent='';
    try{
      const result=await api('crew/tasks',{project_id:currentProject(),title:$('#crew-new-title').value.trim(),prompt:$('#crew-new-prompt').value.trim(),bot_id:$('#crew-new-assignee').value,mode:$('#crew-new-mode').value,effort:$('#crew-new-effort').value,start:true});
      $('#crew-task-dialog').close();$('#crew-new-title').value='';$('#crew-new-prompt').value='';
      await loadWorkspace(true);
      const id=result.task?.id||result.id;if(id)await selectTask(id);
    }catch(error){$('#crew-task-form-error').textContent=error.message;}
    finally{button.disabled=false;}
  }
  async function sendReply(){
    const id=crew.selected,text=$('#crew-reply').value.trim();if(!id||!text||crew.busyAction)return;
    if(taskBusy()){toast('Wait for this task to finish or stop it before sending a follow-up.');return;}
    crew.busyAction=true;renderRunStatus();
    try{
      await api(`crew/tasks/${id}/start`,{prompt:text});
      crew.drafts.delete(id);if(crew.selected===id)$('#crew-reply').value='';
      await loadWorkspace(true);
    }finally{crew.busyAction=false;renderRunStatus();}
  }
  async function stopTask(){
    const id=crew.selected;if(!id||crew.busyAction)return;
    crew.busyAction=true;renderRunStatus();
    try{await api(`crew/tasks/${id}/stop`,{});await loadWorkspace(true);}
    finally{crew.busyAction=false;renderRunStatus();}
  }
  function editBot(id){
    const bot=botById(id);crew.avatar=bot?.avatar||{kind:'character',shape:'clover',color:'#d99b7a',eyes:'line'};
    $('#crew-profile-avatar').innerHTML=window.beamAvatars.render(crew.avatar);
    $('#crew-job-preset').value=['Researcher','Analyst','Engineer','Designer','Writer','Operations'].includes(bot?.role)?bot.role:'Custom';
    $('#crew-bot-dialog-title').textContent=bot?'Specialist profile':'Add a specialist';
    $('#crew-bot-id').value=bot?.id||'';$('#crew-bot-name').value=bot?.name||'';$('#crew-bot-role').value=bot?.role||'';$('#crew-bot-instructions').value=bot?.instructions||'';$('#crew-bot-memory').value=bot?.memory||'';$('#crew-bot-archived').checked=!!bot?.archived;$('#crew-bot-archived').disabled=!bot;$('#crew-bot-form-error').textContent='';
    $('#crew-bot-dialog').showModal();$('#crew-bot-name').focus();
  }
  async function saveBot(event){
    event.preventDefault();const button=$('#crew-save-bot');button.disabled=true;$('#crew-bot-form-error').textContent='';
    const id=$('#crew-bot-id').value,old=botById(id);
    try{
      await api('crew/bots',{...(id?{id}:{}),project_id:currentProject(),avatar:crew.avatar,name:$('#crew-bot-name').value.trim(),role:$('#crew-bot-role').value.trim(),instructions:$('#crew-bot-instructions').value,memory:$('#crew-bot-memory').value,color:crew.avatar?.color||old?.color||'#d38a68',archived:$('#crew-bot-archived').checked});
      $('#crew-bot-dialog').close();await loadWorkspace(true);
    }catch(error){$('#crew-bot-form-error').textContent=error.message;}
    finally{button.disabled=false;}
  }
  async function openArtifact(path){
    mode('code');document.body.classList.remove('inspector-collapsed');await refreshFiles();await openFile(path);
  }
  async function openBrief(){
    await loadWorkspace(true);if(!crew.data)return;
    $('#crew-brief-text').value=crew.data.brief||'';$('#crew-brief-form-error').textContent='';$('#crew-brief-dialog').showModal();
  }
  async function saveBrief(event){
    event.preventDefault();const button=$('#crew-save-brief');button.disabled=true;$('#crew-brief-form-error').textContent='';
    try{await api('crew/brief',{project_id:currentProject(),brief:$('#crew-brief-text').value});$('#crew-brief-dialog').close();await loadWorkspace(true);}
    catch(error){$('#crew-brief-form-error').textContent=error.message;}
    finally{button.disabled=false;}
  }
  document.addEventListener('click',e=>{if(!e.target.closest('#workspace-switcher'))$('#workspace-switcher').open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#workspace-switcher').open=false;});
  $('#home').onclick=safely(async()=>{mode('code');await originalNewSession();});
  const profile=document.createElement('div');profile.className='crew-profile-identity';profile.innerHTML='<button type="button" id="crew-profile-avatar" class="crew-profile-avatar" aria-label="Edit member picture"></button><div><strong>Member picture</strong><small>Choose a character or upload an image.</small><button type="button" id="crew-edit-avatar" class="text-button">Edit picture</button></div>';
  $('#crew-bot-id').after(profile);
  const job=document.createElement('div');job.className='crew-job-presets';job.innerHTML='<label class="field-label" for="crew-job-preset">Start with a job</label><select id="crew-job-preset"><option>Custom</option><option>Researcher</option><option>Analyst</option><option>Engineer</option><option>Designer</option><option>Writer</option><option>Operations</option></select>';
  profile.after(job);
  function editPicture(){window.beamAvatars.edit(crew.avatar,value=>{crew.avatar=value;$('#crew-profile-avatar').innerHTML=window.beamAvatars.render(value)})}
  $('#crew-profile-avatar').onclick=$('#crew-edit-avatar').onclick=editPicture;
  $('#crew-job-preset').onchange=e=>{const role=e.target.value;if(role==='Custom')return;const instructions={Researcher:'Research questions using primary sources. Cite evidence, verify dates and distinguish findings from assumptions.',Analyst:'Analyze data and evidence, check calculations and assumptions, and produce clear tables, charts and conclusions.',Engineer:'Build and repair software. Inspect the project, implement focused changes, and run proportionate checks.',Designer:'Design usable interfaces and dimensioned 3D models. Preserve constraints and provide editable, validated outputs.',Writer:'Write and edit clear documents and presentations. Adapt to the audience and verify the finished files.',Operations:'Organize plans, schedules and project deliverables. Track dependencies, clarify missing inputs and never publish or contact others without approval.'};$('#crew-bot-role').value=role;$('#crew-bot-instructions').value=instructions[role]};
  $('#beam-mode-code').onclick=()=>mode('code');$('#beam-mode-crew').onclick=()=>mode('crew');
  $('#crew-new-task').onclick=safely(()=>newTask());$('#crew-task-form').onsubmit=createTask;
  $('#crew-refresh').onclick=safely(()=>loadWorkspace(true));$('#crew-task-filter').onchange=renderTasks;
  $('#crew-bot-filter').onclick=()=>{crew.filterBot=null;renderBots();renderTasks()};
  $('#crew-add-bot').onclick=()=>editBot();$('#crew-bot-form').onsubmit=saveBot;
  $('#crew-brief-button').onclick=safely(openBrief);$('#crew-brief-form').onsubmit=saveBrief;
  $('#crew-send').onclick=safely(sendReply);$('#crew-stop').onclick=safely(stopTask);
  $('#crew-reply').oninput=saveReply;
  $('#crew-reply').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!taskBusy())safely(sendReply)();}};
  $('#crew-view-files').onclick=safely(async()=>{mode('code');document.body.classList.remove('inspector-collapsed');setTab('files');await refreshFiles();});
  $('#crew-open-project').onclick=safely(openProject);$('#crew-use-workspace').onclick=safely(async()=>{await ensureProject();await loadWorkspace(true);});
  $$('[data-crew-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.crewClose).close());
  $$('[data-crew-example]').forEach(b=>b.onclick=safely(()=>newTask(b.dataset.crewExample)));
  const originalSetProject=setProject;
  setProject=function(project){originalSetProject(project);if(crew.mode)queueMicrotask(()=>safely(loadWorkspace)());};
  const originalLoadSession=loadSession;
  loadSession=async function(id){if(crew.mode)mode('code');return originalLoadSession(id);};
  const originalNewSession=newSession;
  $('#new-session').onclick=safely(async()=>{mode('code');await originalNewSession();});
  document.addEventListener('keydown',e=>{
    if(crew.mode&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){
      e.preventDefault();e.stopImmediatePropagation();safely(()=>newTask())();
    }
  },true);
  setInterval(async()=>{
    if(!crew.mode||crew.polling||crew.loading||!currentProject())return;
    crew.polling=true;
    try{await loadWorkspace();}finally{crew.polling=false;}
  },1400);
  window.beamCrew={show:()=>mode('crew'),refresh:()=>loadWorkspace(true),setDraft:(id,text)=>{crew.drafts.set(id,text);if(crew.selected===id)$('#crew-reply').value=text;}};
})();
