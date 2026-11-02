'use strict';
/* Sensitive-data choices are run-scoped. Local summaries are display-only. */
(() => {
  let cached=null,loadedAt=0,loading=null;
  const choices=new Map();
  const modelNames=data=>(data?.models||[]).map(m=>typeof m==='string'?m:m.name).filter(n=>typeof n==='string'&&n);
  async function models(force=false){
    if(!force&&cached&&Date.now()-loadedAt<30000)return cached;
    if(loading)return loading;
    loading=api('privacy/models').then(data=>{cached=data;loadedAt=Date.now();return data}).finally(()=>{loading=null});
    return loading;
  }
  const choiceLabel=c=>c==='local'?'Local processing selected':c==='cloud'?'Cloud authorized for these detected details':c==='stop'?'Task stopped':'This privacy request is no longer pending';
  function checkpoint(event,events,sessionId,pending){
    const decision=events.find(e=>e.type==='privacy_decision'&&e.action_id===event.action_id);
    const active=!decision&&!!pending&&pending.action_id===event.action_id;
    const cats=Array.isArray(event.categories)?event.categories.map(c=>String(c)).join(', '):'Sensitive information';
    return `<section class="privacy-checkpoint" data-privacy-card="${esc(event.action_id)}" data-privacy-session="${esc(sessionId||'')}"><div class="privacy-heading">${icon('shield')}<strong>Private details found</strong><span class="privacy-paused">${active?'Paused':decision?'Decision saved':'Closed'}</span></div><p>Beam paused before sending these detected details to Ollama Cloud.</p><p class="privacy-categories">Detected: ${esc(cats)}</p>${event.preview?`<details class="privacy-preview"><summary>Redacted preview</summary><pre>${esc(event.preview)}</pre></details>`:''}${active?`<div class="privacy-local-choice"><strong>Keep private analysis on this computer</strong><p>Use local Ollama for the sensitive details. Beam continues cloud coding with redacted content; the local result stays separate in this chat.</p><div class="privacy-model-row"><select class="privacy-model" aria-label="Local Ollama model"><option value="">Loading local models…</option></select><button class="text-button" data-privacy-refresh>Refresh</button></div><p class="privacy-model-status" role="status">Checking local Ollama…</p><button class="primary-button" data-privacy-choice="local" disabled>Use local Ollama</button></div><div class="privacy-cloud-choice"><p>You can explicitly allow these detected details to be sent to the cloud for this run.</p><div class="privacy-actions"><button class="secondary-button" data-privacy-choice="cloud">Allow cloud for these details</button><button class="text-button" data-privacy-choice="stop">Stop task</button></div></div><p class="privacy-choice-error" role="alert"></p>`:`<p class="privacy-decision">${esc(decision?choiceLabel(decision.choice):choiceLabel(''))}</p>`}</section>`;
  }
  function summary(event){
    return `<details class="private-summary"><summary>${icon('shield')}<span>Processed locally · Not sent to cloud</span></summary><div class="private-summary-content"><p class="private-summary-model">Local Ollama${event.model?' · '+esc(event.model):''}</p><div class="message assistant">${markdown(event.text||'')}</div><p class="field-note">This result is shown separately and is not added to cloud model context or Crew handoffs.</p></div></details>`;
  }
  function pendingFor(data,status,events){
    const pending=data?.privacy_pending||data?.run?.privacy_pending||(data?.pending?.type==='privacy'?data.pending:null);
    if(pending)return pending;
    if(status!=='privacy')return null;
    const event=events.filter(e=>e.type==='privacy').at(-1);
    return event&&!events.some(e=>e.type==='privacy_decision'&&e.action_id===event.action_id)?event:null;
  }
  function renderModelChoices(select,note,button,data,configured,actionId){
    const names=modelNames(data),choice=choices.get(actionId)||configured||data.model;
    select.innerHTML=names.length?names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join(''):'<option value="">No local models available</option>';
    select.value=names.includes(choice)?choice:(names[0]||'');
    if(select.value)choices.set(actionId,select.value);
    select.disabled=!names.length;
    button.disabled=!(data.available&&names.length);
    note.classList.toggle('unavailable',!data.available||!names.length);
    note.innerHTML=data.available&&names.length?'Local Ollama is available on this computer.':'Local processing is unavailable. Start <a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer">Ollama</a> and download a local model, then refresh. Beam will wait for your choice.';
  }
  async function populate(card,force){
    const select=card.querySelector('.privacy-model'),note=card.querySelector('.privacy-model-status'),button=card.querySelector('[data-privacy-choice="local"]');
    if(!select)return;
    button.disabled=true;note.textContent='Checking local Ollama…';
    try{const data=await models(force);if(!card.isConnected)return;renderModelChoices(select,note,button,data,'',card.dataset.privacyCard);}
    catch(error){if(!card.isConnected)return;select.innerHTML='<option value="">Local Ollama unavailable</option>';select.disabled=true;button.disabled=true;note.classList.add('unavailable');note.textContent='Could not check local Ollama. Start Ollama, install a local model, then refresh. No cloud permission has been granted.';}
  }
  function bind(container,refresh){
    container.querySelectorAll('[data-privacy-card]').forEach(card=>{
      const select=card.querySelector('.privacy-model');
      if(!select)return;
      select.onchange=()=>choices.set(card.dataset.privacyCard,select.value);
      card.querySelector('[data-privacy-refresh]').onclick=()=>populate(card,true);
      card.querySelectorAll('[data-privacy-choice]').forEach(button=>button.onclick=async()=>{
        const choice=button.dataset.privacyChoice,model=select.value;
        const error=card.querySelector('.privacy-choice-error');error.textContent='';
        if(choice==='local'&&!model){error.textContent='Choose an installed local Ollama model first.';return;}
        card.querySelectorAll('button,select').forEach(el=>el.disabled=true);
        try{await api(`sessions/${encodeURIComponent(card.dataset.privacySession)}/privacy`,{action_id:card.dataset.privacyCard,choice,...(choice==='local'?{model}:{})});await refresh();}
        catch(problem){error.textContent=problem.message;card.querySelectorAll('button,select').forEach(el=>el.disabled=false);const data=cached;if(data&&(!data.available||!modelNames(data).length))card.querySelector('[data-privacy-choice="local"]').disabled=true;}
      });
      populate(card,false);
    });
  }
  async function refreshSettings(force){
    const select=$('#privacy-settings-model'),note=$('#privacy-settings-status'),save=$('#privacy-save-model');
    if(!select)return;save.disabled=true;note.textContent='Checking local Ollama…';
    try{
      const data=await models(force),names=modelNames(data);
      select.innerHTML=names.length?names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join(''):'<option value="">No local models available</option>';
      if(names.includes(data.model))select.value=data.model;
      select.disabled=!names.length;save.disabled=!(data.available&&names.length);
      note.innerHTML=data.available&&names.length?'Choose the model used when you select local processing at a privacy checkpoint.':'Start <a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer">Ollama</a>, download a local model, then refresh. Cloud use still requires your choice at the checkpoint.';
    }catch(error){select.innerHTML='<option value="">Local Ollama unavailable</option>';select.disabled=true;note.textContent='Could not reach local Ollama. Start it and install a model, then refresh.';}
  }
  $('#privacy-refresh-models').onclick=()=>refreshSettings(true);
  $('#privacy-save-model').onclick=safely(async()=>{const model=$('#privacy-settings-model').value;if(!model)return;await api('privacy/settings',{model});if(cached)cached.model=model;$('#privacy-settings-status').textContent='Local model saved.';});
  new MutationObserver(records=>{if(records.some(r=>r.attributeName==='open')&&$('#settings-dialog').open)refreshSettings(false);}).observe($('#settings-dialog'),{attributes:true,attributeFilter:['open']});
  window.beamPrivacy={checkpoint,summary,pendingFor,bind,models};
})();
