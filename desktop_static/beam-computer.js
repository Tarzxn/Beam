'use strict';
(() => {
  let current=null,listing=[],timer=null,uploadToken=null,lastListAt=0,switching=false;
  const workspaceViews=new Map();
  const host=document.createElement('dialog');host.id='computer-dialog';host.className='computer-dialog';
  host.innerHTML=`<div class="dialog-content"><div class="dialog-heading"><h2>Project computer</h2><button class="icon-button" id="computer-close" aria-label="Close computer settings">×</button></div>
  <p class="dialog-description">Choose where Studio and Crew run this project's commands and create files. The coding model stays on Ollama Cloud.</p>
  <div class="computer-current" id="computer-current"></div>
  <div class="computer-choice-grid"><div class="computer-choice" id="computer-local-choice"><span class="computer-choice-icon">PC</span><div><strong>This PC</strong><small>Your local files, browser and connected tools</small></div><button class="secondary-button" id="computer-local">Switch to PC</button></div><div class="computer-choice" id="computer-cloud-choice"><span class="computer-choice-icon">☁</span><div><strong>Codespaces</strong><small id="computer-quick-note">Connect GitHub and choose a computer</small></div><button class="secondary-button" id="computer-quick-cloud" disabled>Switch to cloud</button></div></div>
  <div class="computer-switch-status hidden" id="computer-switch-status" role="status"><span class="computer-switch-spinner"></span><span></span></div>
  <div class="computer-section"><span class="computer-step">1</span><div><h3>Connect GitHub</h3><p>Sign in in your browser. Beam includes GitHub's connection helper, so there are no terminal commands to run.</p><button class="secondary-button" id="computer-login">Connect GitHub</button><div id="computer-auth" role="status"></div></div></div>
  <div class="computer-section"><span class="computer-step">2</span><div><h3>Choose a Codespace</h3><p>A free personal account includes a limited allowance. Use the two-core machine and keep payment details unset to avoid paid overage.</p><div class="computer-select-row"><select id="computer-select" aria-label="Codespace"><option value="">Refresh to find your computers</option></select><button class="secondary-button" id="computer-refresh">Refresh</button></div><p id="computer-list-note" class="field-note"></p><a href="https://github.com/codespaces" target="_blank" rel="noopener noreferrer">Manage or create a Codespace ↗</a></div></div>
  <div class="computer-section"><span class="computer-step">3</span><div><h3>Prepare and connect</h3><p>Install Beam's worker and file-generation libraries in the selected Codespace. Setup may take a few minutes. It starts that computer and uses its running-hour allowance.</p><button class="secondary-button" id="computer-install">Install worker</button><p id="computer-setup" class="field-note" role="status"></p>
  <label class="computer-check"><input type="checkbox" id="computer-trust">Allow task commands without asking each time</label><p class="field-note">Applies to Allow project edits mode on this Codespace. Commands run under a separate task account. Plan stays read-only; obvious publishing or privilege changes still ask. Use a Codespace dedicated to Beam.</p>
  <label class="computer-check"><input type="checkbox" id="computer-auto" checked>Stop after 5 minutes with no active Beam task</label><p class="field-note">Cloud Crew can apply this while Beam is closed; Studio applies it while Beam is open. This also stops other processes on the Codespace. Saved files remain and still use storage allowance.</p>
  <div class="web-actions"><button class="primary-button" id="computer-connect">Use Codespace</button><button class="secondary-button" id="computer-resume">Resume</button><button class="secondary-button" id="computer-stop">Stop computer</button></div></div></div>
  <div class="computer-cloud-crew"><h3>Keep Crew working when Beam closes</h3><p id="computer-cloud-state">Connect a Codespace to enable Cloud Crew.</p><label class="computer-check"><input type="checkbox" id="computer-credential-consent">Store my Ollama key and GitHub connection token in this Codespace for background work</label><p class="field-note">Crew profiles, project brief and task history will live on GitHub’s computer. Credentials are kept outside task folders, readable only by the service account. Your desktop browser, Google and MCP connections stay on this PC. Private model requests and approvals pause until you return.</p><div class="web-actions"><button class="primary-button" id="computer-cloud-enable">Enable Cloud Crew</button><button class="secondary-button" id="computer-cloud-disable">Disconnect Cloud Crew</button></div><p class="field-note">This is limited background work: GitHub can stop the computer at its idle timeout, the 12-hour session limit, or when your allowance runs out. Review interrupted tasks after restarting. Studio tasks always need Beam open. <a href="https://github.com/settings/codespaces" target="_blank" rel="noopener noreferrer">Review GitHub idle timeout ↗</a></p></div>
  <div class="computer-transfer"><h3>Bring existing files</h3><p>Copy files from this project’s local folder to GitHub. Matching remote filenames will be replaced. Common credential files and dependencies are excluded; review the list before uploading.</p><button class="secondary-button" id="computer-upload-preview">Review local files…</button><div id="computer-upload-list"></div><button class="primary-button hidden" id="computer-upload">Upload listed files</button></div><details class="computer-guide"><summary>First-time setup</summary><ol><li>Create a free GitHub account.</li><li>Create a private repository named <code>beam-workspace</code>, with a README.</li><li>In the repository, choose Code → Codespaces → Create codespace on main.</li><li>Come back here, Connect GitHub, then Refresh and select that computer.</li><li>Install worker, then Use Codespace. Enable Cloud Crew for background team jobs.</li></ol><p>Each project has separate PC and cloud folders. Switching back restores your local folder; it does not copy files. Use Save a copy for cloud results. Remote browser, MCP and persistent development servers are not available in this release; web search and page reading remain available. Choose This PC for desktop integrations.</p><a href="https://docs.github.com/en/codespaces/getting-started/quickstart" target="_blank" rel="noopener noreferrer">GitHub's setup guide ↗</a></details>
  <p id="computer-error" class="error-text" role="alert"></p></div>`;
  document.body.appendChild(host);
  const transition=document.createElement('div');transition.id='computer-transition';transition.className='computer-transition hidden';transition.innerHTML='<span class="computer-switch-spinner"></span><span>Switching workspace…</span>';document.body.appendChild(transition);
  function selected(){const name=$('#computer-select').value;if(!name)throw Error('Refresh and choose a Codespace first.');return name}
  async function ensureProject(){if(!state.project){const p=await api('workspace',{});await refreshState();setProject(p);}return state.project.id}
  function project(){if(!state.project)throw Error('Open a project folder first.');return state.project.id}
  function locationKey(data=current){const target=data?.target;return state.project?.id+':'+(target?'cloud:'+target.codespace:'pc')}
  function saveWorkspaceView(){
    if(!state.project)return;
    workspaceViews.set(locationKey(),{session:state.session,events:[...state.events],after:state.after,status:state.status,activity:state.activity,terminal:state.terminal,lastStatus:state.lastStatus||'',connectionLost:!!state.connectionLost,prompt:$('#prompt').value});
  }
  function restoreWorkspaceView(){
    const view=workspaceViews.get(locationKey());
    if(!view){state.session=null;resetTranscript();$('#prompt').value='';renderSidebar();return;}
    state.epoch++;Object.assign(state,{session:view.session,events:[...view.events],after:view.after,status:view.status,activity:view.activity,terminal:view.terminal,lastStatus:view.lastStatus,connectionLost:view.connectionLost});
    $('#prompt').value=view.prompt||'';$('#terminal-output').textContent=view.terminal||'Command output appears here when Beam runs a command.';renderTimeline();updateStatus();renderSidebar();
  }
  function setSwitching(active,label='Switching workspace…'){
    switching=active;document.body.classList.toggle('computer-switching',active);transition.classList.toggle('hidden',!active);transition.querySelector('span:last-child').textContent=label;
    $('#computer-switch-status').classList.toggle('hidden',!active);$('#computer-switch-status span:last-child').textContent=label;
    for(const button of $$('#computer-dialog button'))button.disabled=active||button.dataset.computerDisabled==='true';
    if(active){$('#computer-label').textContent='Switching…';$('#computer-settings').classList.add('is-switching');}
    else{$('#computer-settings').classList.remove('is-switching');renderComputer();}
  }
  function syncPolling(){
    clearInterval(timer);timer=null;
    if(!host.open)return;
    if(current?.auth?.status==='waiting'||current?.setup?.status==='running')timer=setInterval(()=>refresh().catch(()=>{}),1500);
  }
  function renderComputer(loadOptions=false){
    if(!current)return;
    const target=current.target,saved=current.saved_target;
    $('#computer-label').textContent=target?'Codespaces':'This PC';
    $('#computer-settings').classList.toggle('is-remote',!!target);
    $('#computer-current').innerHTML=target?`<strong>Using Codespaces</strong><span>${esc(target.codespace)}${current.paused?' · stopped':''}</span>`:'<strong>Using this PC</strong><span>Commands and files stay in your local project folder.</span>';
    $('#computer-local-choice').classList.toggle('is-active',!target);$('#computer-cloud-choice').classList.toggle('is-active',!!target);
    const quickName=target?.codespace||saved?.codespace||$('#computer-select').value;
    $('#computer-quick-note').textContent=quickName?(target?'Current: ':'Ready: ')+quickName:'Connect GitHub and choose a computer';
    $('#computer-local').textContent=target?'Switch to PC':'Using this PC';$('#computer-local').disabled=!target||switching;$('#computer-local').dataset.computerDisabled=String(!target);
    $('#computer-quick-cloud').textContent=target?'Using Codespace':'Switch to cloud';$('#computer-quick-cloud').disabled=!!target||!quickName||switching;$('#computer-quick-cloud').dataset.computerDisabled=String(!!target||!quickName);
    $('#computer-setup').textContent=current.setup?.log||'';
    if(loadOptions){uploadToken=null;$('#computer-upload').classList.add('hidden');$('#computer-upload-list').textContent='';$('#computer-credential-consent').checked=false;}
    const options=target||saved;if(options&&loadOptions){$('#computer-trust').checked=!!options.trusted;$('#computer-auto').checked=!!options.auto_stop;}
    const auth=current.auth||{status:'idle'};
    $('#computer-auth').innerHTML=auth.status==='waiting'?`<p>Finish sign-in in your browser.</p>${auth.code?`<p class="computer-device-code">${esc(auth.code)}</p><button class="text-button" id="computer-open-signin">Open GitHub sign-in ↗</button>`:''}`:auth.status==='done'?'<p>GitHub connected. Refresh your computers below.</p>':auth.status==='failed'?'<p>Sign-in did not complete. Choose Connect GitHub to try again.</p>':'';
    if($('#computer-open-signin'))$('#computer-open-signin').onclick=()=>native()?.open_github_login?native().open_github_login():window.open('https://github.com/login/device','_blank','noopener');
    $('#computer-login').disabled=auth.status==='waiting'||switching;
    const hasSelection=!!$('#computer-select').value;
    $('#computer-install').disabled=current.setup?.status==='running'||!hasSelection||switching;
    $('#computer-connect').disabled=!hasSelection||switching;
    $('#computer-cloud-state').textContent=target?.cloud_crew?'Cloud Crew enabled. Team jobs run on this Codespace while it remains running.':target?'Cloud commands are connected. Enable Cloud Crew to move the team’s coordinator off this PC.':'Connect a Codespace to enable Cloud Crew.';
    $('#computer-cloud-enable').disabled=!target||!!target.cloud_crew||switching;
    $('#computer-cloud-disable').disabled=!target?.cloud_crew||switching;
    $('#computer-credential-consent').disabled=!target||!!target.cloud_crew||switching;
    const footer=$('.crew-local');if(footer)footer.innerHTML=`<span class="status-dot"></span>${target?'Codespace workspace':'Local workspace'} <span title="${target?'Commands and files run on GitHub’s computer.':'Commands and files run on this PC.'}">ⓘ</span>`;
    $('#reveal-project').disabled=!!target;
    if($('#execution-location'))$('#execution-location').textContent=target?'Codespaces':'Local workspace';
    const inspector=$('.inspector-footer');if(inspector)inspector.title=target?'Files on GitHub Codespaces':'Files on this PC';
    syncPolling();
  }
  async function refresh(loadOptions=false){
    if(!state.project)return;
    current=await api('computer?project_id='+encodeURIComponent(project()));
    renderComputer(loadOptions);
  }
  function action(fn){return async()=>{const error=$('#computer-error');error.textContent='';try{await fn()}catch(e){error.textContent=e.message}}}
  async function list(){
    const data=await api('computer/list');listing=data.computers||[];
    const old=$('#computer-select').value||current?.target?.codespace||current?.saved_target?.codespace;
    $('#computer-select').innerHTML=listing.length?listing.map(c=>`<option value="${esc(c.name)}">${esc(c.displayName||c.name)} · ${esc(c.state)} · ${esc(c.machineName||'')}</option>`).join(''):'<option value="">No Codespaces found</option>';
    if(listing.some(c=>c.name===old))$('#computer-select').value=old;
    $('#computer-list-note').textContent=data.error||(!listing.length?'Create a Codespace on GitHub, then refresh.':'Select the computer you want Beam to use.');
    lastListAt=Date.now();renderComputer();
  }
  async function switchWorkspace(destination){
    if(switching||!await leaveEditor())return;
    const toCloud=destination!=='local',name=toCloud?(destination||selected()):'';
    saveWorkspaceView();setSwitching(true,toCloud?'Connecting to '+name+'…':'Returning to this PC…');
    try{
      const data=await api('computer/target',toCloud?{project_id:project(),codespace:name,trusted:$('#computer-trust').checked,auto_stop:$('#computer-auto').checked}:{project_id:project(),target:'local'});
      current=data;closeEditor();clearContext();
      if(Array.isArray(data.files)){state.files=data.files;renderFiles();$('#file-count').textContent=data.files.length+' files';}
      else await refreshFiles();
      restoreWorkspaceView();renderComputer();
      if(document.body.classList.contains('crew-mode'))await window.beamCrew?.refresh();
      if(state.tab==='changes')gitRefresh().catch(()=>{});
      host.close();toast(toCloud?'Now working in '+name+'.':'Now working on this PC.');
    }finally{setSwitching(false)}
  }
  $('#computer-settings').onclick=action(async()=>{
    await ensureProject();host.showModal();$('#computer-current').innerHTML='<span class="computer-skeleton">Loading current workspace…</span>';
    await refresh(true);
    if(!listing.length||Date.now()-lastListAt>15000){$('#computer-list-note').textContent='Finding your Codespaces…';$('#computer-install').disabled=true;$('#computer-connect').disabled=true;list().catch(error=>{$('#computer-list-note').textContent=error.message})}
  });
  $('#computer-close').onclick=()=>host.close();host.addEventListener('close',()=>{clearInterval(timer);timer=null});
  $('#computer-login').onclick=action(async()=>{await api('computer/login',{});await refresh()});
  $('#computer-refresh').onclick=action(list);
  $('#computer-select').onchange=()=>renderComputer();
  $('#computer-install').onclick=action(async()=>{await api('computer/install',{codespace:selected()});await refresh()});
  $('#computer-connect').onclick=action(()=>switchWorkspace(selected()));
  $('#computer-quick-cloud').onclick=action(()=>switchWorkspace(current?.saved_target?.codespace||selected()));
  $('#computer-local').onclick=action(async()=>{if(current?.target?.cloud_crew)throw Error('Finish cloud tasks, then Disconnect Cloud Crew below before switching to this PC.');await switchWorkspace('local')});
  $('#computer-cloud-enable').onclick=action(async()=>{if(!$('#computer-credential-consent').checked)throw Error('Background work needs credentials on the Codespace. Read and tick the consent above to enable it.');const result=await api('computer/cloud-crew',{project_id:project(),enabled:true,credential_consent:true});await refresh();await window.beamCrew?.refresh();toast(result.warning||'Cloud Crew enabled. Team jobs can continue when Beam closes.');});
  $('#computer-cloud-disable').onclick=action(async()=>{await api('computer/cloud-crew',{project_id:project(),enabled:false});await refresh();await window.beamCrew?.refresh();toast('Cloud Crew disconnected. Credentials removed if no other project uses them.');});
  $('#computer-stop').onclick=action(async()=>{await api('computer/stop',{codespace:current?.target?.codespace||selected()});await refresh();toast('Codespace stopped. Saved files remain.');});
  $('#computer-resume').onclick=action(async()=>{setSwitching(true,'Resuming '+(current?.target?.codespace||'Codespace')+'…');try{await api('computer/resume',{project_id:project()});current.paused=false;await refreshFiles();renderComputer();toast('Codespace resumed.')}finally{setSwitching(false)}});
  $('#computer-upload-preview').onclick=action(async()=>{const data=await api('computer/upload-preview',{project_id:project()});uploadToken=data.token;$('#computer-upload-list').innerHTML=`<p>${data.files.length} files · ${(data.bytes/1000000).toFixed(1)} MB</p><pre>${data.files.map(f=>esc(f.path)).join('\n')}</pre>`;$('#computer-upload').classList.toggle('hidden',!data.files.length)});
  $('#computer-upload').onclick=action(async()=>{const data=await api('computer/upload',{project_id:project(),token:uploadToken});uploadToken=null;$('#computer-upload').classList.add('hidden');$('#computer-upload-list').textContent=data.files+' files copied.';await refreshFiles()});
  const original=setProject;
  setProject=function(p){if(state.project&&state.project.id!==p?.id)saveWorkspaceView();original(p);refresh().catch(()=>{})};
  window.beamComputer={refresh,switchWorkspace};
  if(state.project)refresh().catch(()=>{});
})();
