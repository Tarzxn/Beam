'use strict';
const originalOpenFile=openFile;
openFile=async function(path){await originalOpenFile(path);if(!state.editor||state.editor.path!==path||!(/\.(docx|xlsx|pptx)$/i.test(path)))return;
 const holder=$('#binary-view');holder.classList.remove('hidden');holder.innerHTML='<p>Reading file contents…</p>';
 try{const report=await api(`projects/${state.project.id}/inspect-artifact?path=${encodeURIComponent(path)}`);if(state.editor?.path!==path)return;holder.innerHTML=renderArtifactPreview(report);$('#editor-info').textContent='Content preview · open the native file to review layout';}
 catch(error){holder.innerHTML='<p>'+esc(error.message)+'</p>'}
};
function previewTable(rows){return '<table>'+rows.map((row,i)=>'<tr>'+row.map(v=>`<${i?'td':'th'}>${esc(v??'')}</${i?'td':'th'}>`).join('')+'</tr>').join('')+'</table>'}
function renderArtifactPreview(r){let body='<h2>'+esc(r.name)+'</h2><p class="field-note">'+esc(r.preview_note)+'</p><div class="quality-metrics">'+Object.entries(r.metrics||{}).map(([k,v])=>'<span>'+esc(k)+': '+esc(v)+'</span>').join('')+'</div>';
 if(r.paragraphs)body+=r.paragraphs.map(p=>/^Heading/.test(p.style)?'<h3>'+esc(p.text)+'</h3>':'<p>'+esc(p.text)+'</p>').join('');if(r.tables)body+=r.tables.map(previewTable).join('');
 if(r.sheets)body+=r.sheets.map(s=>'<h3>'+esc(s.name)+'</h3>'+previewTable(s.rows)).join('')+'<p class="field-note">'+esc(r.formula_note)+'</p>';
 if(r.slides)body+=r.slides.map(s=>'<section class="slide-content-preview"><h3>Slide '+s.number+'</h3>'+s.text.map(t=>'<p>'+esc(t)+'</p>').join('')+s.tables.map(previewTable).join('')+(s.charts?'<p class="field-note">'+s.charts+' native chart(s)</p>':'')+(s.notes?'<details><summary>Speaker notes</summary><p>'+esc(s.notes)+'</p></details>':'')+'</section>').join('');
 body+=(r.checks||[]).map(c=>'<p class="quality-check">✓ '+esc(c.check)+' · '+esc(c.detail)+'</p>').join('')+(r.warnings||[]).map(w=>'<p>'+esc(w)+'</p>').join('');return '<div class="quality-preview">'+body+'</div>';
}
