'use strict';
(() => {
  function checkpoint(event, events, sessionId, pending) {
    const decision=events.find(e=>e.type==='privacy_decision'&&e.action_id===event.action_id);
    const active=!decision&&pending?.action_id===event.action_id;
    return `<section class="privacy-checkpoint" data-cloud-privacy="${esc(event.action_id)}" data-session="${esc(sessionId)}"><div class="privacy-heading">${icon('shield')}<strong>Private details found</strong><span class="privacy-paused">${active?'Paused':decision?'Decision saved':'Closed'}</span></div><p>Beam paused before sending these details to Ollama Cloud. They are already stored in your Codespace.</p><p class="privacy-categories">Detected: ${esc((event.categories||[]).join(', '))}</p>${event.preview?`<details><summary>Redacted preview</summary><pre>${esc(event.preview)}</pre></details>`:''}${active?'<div class="privacy-actions"><button class="secondary-button" data-choice="cloud">Allow cloud for these details</button><button class="text-button" data-choice="stop">Stop task</button></div><p class="privacy-choice-error" role="alert"></p>':`<p>${decision?.choice==='cloud'?'Cloud authorized for these details':decision?'Task stopped':'This checkpoint is closed'}</p>`}</section>`;
  }
  function pendingFor(data,status,events){const p=data?.privacy_pending||data?.run?.privacy_pending||(data?.pending?.type==='privacy'?data.pending:null);if(p)return p;if(status!=='privacy')return null;return events.filter(e=>e.type==='privacy'&&!events.some(d=>d.type==='privacy_decision'&&d.action_id===e.action_id)).at(-1)||null;}
  function bind(container,refresh){container.querySelectorAll('[data-cloud-privacy]').forEach(card=>card.querySelectorAll('[data-choice]').forEach(button=>button.onclick=async()=>{card.querySelectorAll('button').forEach(b=>b.disabled=true);try{await api(`sessions/${encodeURIComponent(card.dataset.session)}/privacy`,{action_id:card.dataset.cloudPrivacy,choice:button.dataset.choice});await refresh();}catch(e){card.querySelector('.privacy-choice-error').textContent=e.message;card.querySelectorAll('button').forEach(b=>b.disabled=false);}}));}
  window.beamPrivacy={checkpoint,pendingFor,bind,summary:()=>''};
})();
