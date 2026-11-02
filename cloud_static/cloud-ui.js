'use strict';
(() => {
  let connected=false,background=false,leaving=false,account=null,statusTimer=null,restoringView=false;
  const tab=sessionStorage.getItem('beam.cloud.tab')||crypto.randomUUID();
  sessionStorage.setItem('beam.cloud.tab',tab);
  const mount=document.createElement('div');
  mount.innerHTML=`<section id="beam-cloud-gate" class="cloud-overlay"><div class="cloud-connect-card"><div class="cloud-account-line"><span id="cloud-account">Your GitHub workspace</span><button id="cloud-sign-out">Sign out</button></div><div class="eyebrow">BEAM CLOUD</div><h1>Your computer in the cloud.</h1><p>Choose a Codespace to open Studio and Crew. Your files, conversations and team memory stay there.</p><select id="cloud-computers" aria-label="Your Codespaces"><option value="">Loading your Codespaces…</option></select><div class="cloud-connect-actions"><button id="cloud-start" class="primary-button">Connect Codespace</button><button id="cloud-list-refresh" class="secondary-button">Refresh</button><a href="https://github.com/codespaces" target="_blank" rel="noopener noreferrer">Create a Codespace ↗</a></div><p id="cloud-connect-progress" class="cloud-connect-progress" role="status"></p><small>First connection installs Beam’s worker and generation libraries in your Codespace. This starts the computer and uses your GitHub allowance.</small></div></section>
  <dialog id="cloud-computer-dialog" class="cloud-computer-dialog"><h2>Your Codespace</h2><p id="cloud-current-name"></p><p>Studio and Crew run here. Background work is off by default; if the browser disconnects, tasks are saved and the computer stops after a two-minute reconnect window.</p><div id="cloud-paused-list" class="cloud-paused-list"></div><div class="cloud-leave-actions"><button id="cloud-leave-open" class="primary-button">Leave workspace…</button><button id="cloud-computer-close" class="secondary-button">Done</button></div></dialog>
  <dialog id="cloud-leave-dialog" class="cloud-computer-dialog"><h2>Leave your workspace?</h2><p>Pause and stop saves Studio and Crew conversations, cancels active commands and stops the entire Codespace. Resume saved tasks when you return.</p><p id="cloud-background-note"></p><div class="cloud-leave-actions"><button id="cloud-pause-stop" class="primary-button">Pause tasks & stop Codespace</button><button id="cloud-keep-running" class="secondary-button">Continue in background</button><button id="cloud-stay" class="text-button">Stay here</button></div></dialog>
  <dialog id="cloud-folders-dialog" class="cloud-computer-dialog"><h2>Open a Codespace project</h2><p id="cloud-folder-path" class="cloud-folder-path"></p><button id="cloud-folder-up" class="text-button">↑ Parent folder</button><div id="cloud-folder-list" class="cloud-folder-list"></div><div class="cloud-leave-actions"><button id="cloud-folder-choose" class="primary-button">Open this folder</button><button id="cloud-folder-new" class="secondary-button">Use Beam workspace</button><button id="cloud-folder-cancel" class="text-button">Cancel</button></div></dialog>`;
  document.body.append(mount);
  const mobile=()=>matchMedia('(max-width:760px)').matches;
  const sidebarToggle=$('#expand-sidebar').onclick;
  $('#expand-sidebar').onclick=$('#collapse').onclick=()=>{if(mobile())document.body.classList.toggle('cloud-mobile-nav');else sidebarToggle();};
  const inspectorToggle=$('#toggle-inspector').onclick;
  $('#toggle-inspector').onclick=()=>{if(mobile())document.body.classList.toggle('cloud-mobile-files');else inspectorToggle();};
  const previousOpenFile=openFile;openFile=async function(path){if(mobile())document.body.classList.add('cloud-mobile-files');return previousOpenFile(path);};
  document.addEventListener('click',event=>{if(!mobile())return;if(event.target.closest('[data-session],[data-project],#beam-mode-code,#beam-mode-crew')||(!event.target.closest('#sidebar,#expand-sidebar')&&document.body.classList.contains('cloud-mobile-nav')))document.body.classList.remove('cloud-mobile-nav');});
  const backgroundRow=document.createElement('label');
  backgroundRow.className='cloud-background-setting';
  backgroundRow.innerHTML='<input id="cloud-background" type="checkbox"><span><strong>Allow background work</strong><small>Studio and Crew may continue after you close the browser, while GitHub keeps the Codespace running. Approvals and private details still pause for you. When off, a disconnected browser pauses tasks and stops the computer.</small></span>';
  $('#settings-form').insertBefore(backgroundRow,$('#settings-result'));
  const leaveButton=document.createElement('button');leaveButton.id='cloud-leave';leaveButton.className='text-button';leaveButton.textContent='Leave';
  $('.topbar-actions').append(leaveButton);
  $('#execution-location').textContent='Private Codespace';
  $('.crew-local').innerHTML='<span class="status-dot"></span>Private team · Codespace';
  $('#computer-settings').title='Manage your Codespace';
  $('#settings-form .dialog-description').textContent='Studio, Crew and all project tools run in your GitHub Codespace.';
  const note=$('#api-key').parentElement.querySelector('p.field-note');if(note)note.textContent='Encrypted in your Codespace, outside project files. Your key is never returned to the page.';
  $('#import-history').nextElementSibling?.classList.add('hidden');
  $('#browser-visible').closest('label')?.classList.add('hidden');
  const googleHelp=$('#google-state');if(googleHelp)googleHelp.textContent='Import a Google Web application OAuth client to connect Drive and Slides.';
  $('#mode').onchange=()=>$('#mode-help').textContent=$('#mode').value==='plan'?'Plan inspects the project without changing files or running commands.':$('#mode').value==='edit'?'Project edits are allowed. Commands and external actions ask for approval in your Codespace.':'Edits and commands ask for approval in your Codespace.';
  $('#mode').dispatchEvent(new Event('change'));

  const baseApi=api;
  api=async function(path,data){
    const result=await baseApi(path,data);
    if(path==='state'&&result.connected!==false){background=!!result.background_work;$('#cloud-background').checked=background;renderPaused(result.paused||[]);}
    return result;
  };
  function progress(message,error=false){$('#cloud-connect-progress').textContent=message;$('#cloud-connect-progress').classList.toggle('cloud-connect-error',error);}
  function gate(message=''){connected=false;$('#beam-cloud-gate').classList.remove('hidden');progress(message);}
  async function list(){const data=await api('codespaces');$('#cloud-computers').innerHTML=data.computers.length?data.computers.map(c=>`<option value="${esc(c.name)}">${esc(c.display_name||c.name)} · ${esc(c.state)}</option>`).join(''):'<option value="">No Codespaces yet — create one on GitHub</option>';if(account?.codespace)$('#cloud-computers').value=account.codespace;$('#cloud-start').disabled=!$('#cloud-computers').value;}
  async function ready(){
    if(connected)return;
    try{
    clearTimeout(statusTimer);connected=true;leaving=false;
    $('#computer-label').textContent='Codespace';$('#cloud-current-name').textContent=account.codespace;
    await api('cloud/presence',{tab});
    await refreshState();
    restoringView=true;
    const view=await api('cloud/ui');
    if(view.session&&state.sessions.some(s=>s.id===view.session))await loadSession(view.session);
    else if(view.project&&state.projects.some(p=>p.id===view.project))await selectProject(view.project);
    else if(state.sessions.length)await loadSession(state.sessions[0].id);else if(state.projects.length)await selectProject(state.projects[0].id);
    await restoreDrafts();
    restoringView=false;
    if(view.mode==='crew')window.beamCrew?.show();
    if(document.body.classList.contains('crew-mode'))await window.beamCrew?.refresh();
    $('#beam-cloud-gate').classList.add('hidden');
    }catch(error){connected=false;restoringView=false;throw error;}
  }
  async function checkStatus(){
    try{const data=await api('codespaces/status');progress(data.message);if(data.status==='ready'){await ready();return;}if(data.status==='failed'){progress(data.message,true);$('#cloud-start').disabled=false;return;}statusTimer=setTimeout(checkStatus,1800);}
    catch(e){progress(e.message,true);$('#cloud-start').disabled=false;}
  }
  $('#cloud-start').onclick=safely(async()=>{const codespace=$('#cloud-computers').value;if(!codespace)return;$('#cloud-start').disabled=true;progress('Checking your GitHub connection…');try{await api('codespaces/connect',{codespace});account.codespace=codespace;await checkStatus();}catch(e){$('#cloud-start').disabled=false;progress(e.message,true);}});
  $('#cloud-computers').onchange=()=>$('#cloud-start').disabled=!$('#cloud-computers').value;
  $('#cloud-list-refresh').onclick=safely(list);
  $('#cloud-sign-out').onclick=safely(async()=>{if(connected&&!background){openLeave();return;}const r=await fetch('/auth/logout',{method:'POST',headers:{'X-Beam-Token':token}});if(r.ok)location.assign('/');});
  $('#computer-settings').onclick=safely(async()=>{await refreshState();$('#cloud-current-name').textContent=account?.codespace||'';$('#cloud-computer-dialog').showModal();});
  $('#cloud-computer-close').onclick=()=>$('#cloud-computer-dialog').close();
  function openLeave(){$('#cloud-computer-dialog').close();$('#cloud-keep-running').disabled=!background;$('#cloud-background-note').textContent=background?'Background work is enabled. Your Codespace uses GitHub running hours while it remains on.':'Enable “Allow background work” in Settings to keep working after you leave.';$('#cloud-leave-dialog').showModal();}
  leaveButton.onclick=$('#cloud-leave-open').onclick=openLeave;
  $('#cloud-stay').onclick=()=>$('#cloud-leave-dialog').close();
  $('#cloud-pause-stop').onclick=safely(async()=>{if(!await leaveEditor())return;await saveDrafts();await api('cloud/leave',{background:false});leaving=true;$('#cloud-leave-dialog').close();gate('Pausing your saved tasks and stopping the Codespace. Reconnect when you want to continue.');$('#cloud-start').disabled=false;});
  $('#cloud-keep-running').onclick=safely(async()=>{await saveDrafts();await api('cloud/leave',{background:true});leaving=true;$('#cloud-leave-dialog').close();gate('Your tasks continue in the Codespace. You can close this tab.');$('#cloud-start').disabled=false;});
  $('#cloud-background').onchange=safely(async()=>{const desired=$('#cloud-background').checked;try{await api('settings',{background_work:desired});background=desired;toast(desired?'Background work enabled':'Tasks pause and the Codespace stops when you disconnect');}catch(e){$('#cloud-background').checked=background;throw e;}});
  let folder=null;
  async function browse(path='/workspaces'){const data=await api('cloud/folders?path='+encodeURIComponent(path));folder=data.path;$('#cloud-folder-path').textContent=data.path;$('#cloud-folder-up').disabled=!data.parent;$('#cloud-folder-up').onclick=safely(()=>browse(data.parent));$('#cloud-folder-choose').disabled=!data.selectable;$('#cloud-folder-list').innerHTML=data.folders.map(p=>`<button data-cloud-folder="${esc(p.path)}">${icon('folder')} ${esc(p.name)} <span>→</span></button>`).join('')||'<p>No subfolders here.</p>';$$('[data-cloud-folder]').forEach(b=>b.onclick=safely(()=>browse(b.dataset.cloudFolder)));}
  openProject=async function(){if(!connected){gate('Connect a Codespace first.');return;}await browse();$('#cloud-folders-dialog').showModal();};
  $('#open-project').onclick=$('#add-project').onclick=$('#project-title').onclick=$('#crew-open-project').onclick=safely(openProject);
  $('#cloud-folder-choose').onclick=safely(async()=>{const project=await api('projects',{path:folder});$('#cloud-folders-dialog').close();await refreshState();await selectProject(project.id);if(document.body.classList.contains('crew-mode'))await window.beamCrew?.refresh();});
  $('#cloud-folder-new').onclick=safely(async()=>{const project=await api('workspace',{});$('#cloud-folders-dialog').close();await refreshState();await selectProject(project.id);});
  $('#cloud-folder-cancel').onclick=()=>$('#cloud-folders-dialog').close();
  function renderPaused(rows){$('#cloud-paused-list').innerHTML=rows.length?'<strong>Saved tasks ready to resume</strong>'+rows.map(row=>`<button class="secondary-button" data-cloud-resume="${esc(row.session_id)}">Resume ${row.crew_task?'Crew task':'Studio session'} · ${esc(row.session_id.slice(0,8))}</button>`).join(''):'';$$('[data-cloud-resume]').forEach(b=>b.onclick=safely(async()=>{await api('cloud/resume',{session_id:b.dataset.cloudResume});await refreshState();await window.beamCrew?.refresh();toast('Task resumed');}));}
  const draftKey=()=>state.session?'studio:'+state.session:'studio:new:'+(state.project?.id||'none');
  const crewDraftKey=()=>{const row=$('[data-crew-task].selected');return row?'crew:'+row.dataset.crewTask:null;};
  const savedDrafts=new Map();let saveTimer=null;
  async function saveDrafts(){if(!connected||leaving)return;const values=[[draftKey(),$('#prompt').value]];if(crewDraftKey())values.push([crewDraftKey(),$('#crew-reply').value]);for(const [id,text] of values){if(savedDrafts.get(id)===text)continue;await api('cloud/drafts',{id,text});savedDrafts.set(id,text);}}
  async function restoreDrafts(){const data=await api('cloud/drafts');for(const [key,value] of Object.entries(data.drafts)){savedDrafts.set(key,value);if(key.startsWith('crew:'))window.beamCrew?.setDraft(key.slice(5),value);}if(!$('#prompt').value)$('#prompt').value=savedDrafts.get(draftKey())||'';}
  for(const id of ['prompt','crew-reply'])$('#'+id).addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>safely(saveDrafts)(),700);});
  const originalLoadSession=loadSession;loadSession=async function(id){$('#prompt').disabled=true;try{await saveDrafts();await originalLoadSession(id);$('#prompt').value=savedDrafts.get(draftKey())||'';}finally{$('#prompt').disabled=false;}};
  const previousNewSession=newSession;newSession=async function(){$('#prompt').disabled=true;try{return await previousNewSession();}finally{$('#prompt').disabled=false;}};
  $('#new-session').onclick=$('#home').onclick=safely(async()=>{$('#beam-mode-code').onclick();await newSession();});
  async function saveUi(){if(!connected||restoringView||leaving)return;await api('cloud/ui',{project:state.project?.id||null,session:state.session,mode:document.body.classList.contains('crew-mode')?'crew':'studio'});}
  const previousSetProject=setProject;setProject=function(project){previousSetProject(project);queueMicrotask(()=>safely(saveUi)());};
  document.addEventListener('click',event=>{if(event.target.closest('#beam-mode-code,#beam-mode-crew'))queueMicrotask(()=>safely(saveUi)());});
  setInterval(async()=>{if(!connected||leaving)return;try{await api('cloud/presence',{tab});await saveDrafts();}catch(e){gate('Connection lost. Reconnect within two minutes to keep the Codespace running. Background work follows your saved setting.');$('#cloud-start').disabled=false;}},20000);
  window.addEventListener('beforeunload',event=>{if(connected&&!leaving&&!background){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{if(!connected||leaving)return;fetch('/api/cloud/presence',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-Beam-Token':token},body:JSON.stringify({tab,leaving:true})}).catch(()=>{});});
  window.beamComputer={refresh:()=>Promise.resolve()};
  safely(async()=>{account=await api('account');const restoring=!!account.codespace;$('#cloud-account').textContent='Signed in as '+account.user.login;$('#settings .avatar').textContent=account.user.login.slice(0,1).toUpperCase();$('#settings strong').textContent=account.user.login;await list();if(restoring){progress('Restoring your Codespace connection…');await checkStatus();}})();
})();
