// ================== DONNÉES ==================
const defaultSections = [
  "Théâtre",
  "Danse",
  "Musique",
  "Mannequinat",
  "Poésie / Slam",
  "Impresario",
  "Tresse / Make-up",
  "Arts plastiques",
  "Orchestre Olatomi"
];

let stored = null;
try{
  const raw = localStorage.getItem("ucao_presence");
  if(raw) stored = JSON.parse(raw);
}catch(e){
  stored = null;
}
let data = stored || {sections: defaultSections.map(s => ({name:s, members:[]}))};
// Ajouter Orchestre Olatomi si elle n'existe pas
if (!data.sections.find(s => s.name === "Orchestre Olatomi")) {
  data.sections.push({ name: "Orchestre Olatomi", members: [], leaderPass: null });
  save(); // sauvegarde dans le localStorage
}


if(!data.sections || !Array.isArray(data.sections) || data.sections.length === 0){
  data.sections = defaultSections.map(s => ({name:s, members:[]}));
}

let currentSectionIndex = 0;
let editIndex = null;

// ================== INIT ==================
const sectionSelect = document.getElementById("sectionSelect");
const membersDiv = document.getElementById("members");

function init(){
  sectionSelect.innerHTML = "";
  data.sections.forEach((s,i)=>{
    const opt = document.createElement("option");
    opt.value=i; opt.textContent=s.name;
    sectionSelect.appendChild(opt);
  });
  sectionSelect.onchange = e => {
    currentSectionIndex = +e.target.value;
    refreshAuthUI();
    render();
  };
  if(currentSectionIndex >= data.sections.length) currentSectionIndex = 0;
  render();
}

// ================== AUTH PAR SECTION ==================
function isSectionLogged(){
  return sessionStorage.getItem('ucao_section_logged') === String(currentSectionIndex);
}

function openAuth(){
  const section = data.sections[currentSectionIndex];
  const storedPass = section && section.leaderPass;
  
  document.getElementById('authTitle').textContent = storedPass 
      ? 'Connexion chef de section' 
      : 'Créer mot de passe (chef de section)';

  document.getElementById('authPass').value = '';
  document.getElementById('authModal').style.display = 'flex';

  // Montrer le bouton "Mot de passe oublié ?" seulement si mot de passe déjà créé
  document.getElementById('forgotPassWrapper').style.display = storedPass ? 'block' : 'none';

  // on change temporairement l'action du bouton
  document.getElementById('authConfirmBtn').onclick = doAuth;
}

function openChangePass(){
  if(!isSectionLogged()) return alert("Vous devez être connecté.");

  document.getElementById('authTitle').textContent = 'Nouveau mot de passe';
  document.getElementById('authPass').value = '';
  document.getElementById('authModal').style.display = 'flex';

  // on change temporairement l'action du bouton
  document.getElementById('authConfirmBtn').onclick = changePassword;
}

function changePassword(){
  const val = document.getElementById('authPass').value;
  if(!val) return alert('Entrez le nouveau mot de passe');

  const section = data.sections[currentSectionIndex];
  section.leaderPass = val;
  save();

  closeAuth();

  // remettre le bouton à sa fonction normale
  document.getElementById('authConfirmBtn').onclick = doAuth;

  alert("Mot de passe modifié avec succès ✅");
}


function closeAuth(){ document.getElementById('authModal').style.display='none'; }

function doAuth(){
  const val = document.getElementById('authPass').value;
  if(!val) return alert('Entrez le mot de passe');
  const section = data.sections[currentSectionIndex];
  const stored = section.leaderPass;
  if(!stored){
    // create leader password for this section
    section.leaderPass = val;
    save();
    sessionStorage.setItem('ucao_section_logged', String(currentSectionIndex));
    closeAuth();
    refreshAuthUI();
    return alert('Mot de passe créé — vous êtes connecté pour cette section');
  }
  if(val === stored){
    sessionStorage.setItem('ucao_section_logged', String(currentSectionIndex));
    closeAuth();
    refreshAuthUI();
    return;
  }
  alert('Mot de passe incorrect');
}

function logout(){
  sessionStorage.removeItem('ucao_section_logged');
  refreshAuthUI();
}

function refreshAuthUI(){
  const authBtn = document.getElementById('authBtn');
  const btnAdd = document.getElementById('btnAdd');
  const btnReset = document.getElementById('btnReset');
  const changePassBtn = document.getElementById('changePassBtn');

  if(isSectionLogged()){
    authBtn.textContent = 'Déconnexion';
    authBtn.onclick = logout;
    btnAdd.disabled = false; 
    btnReset.disabled = false;
    changePassBtn.style.display = 'inline-block';
  } else {
    authBtn.textContent = '🔒 Se connecter (chef section)';
    authBtn.onclick = openAuth;
    btnAdd.disabled = true; 
    btnReset.disabled = true;
    changePassBtn.style.display = 'none';
  }
  render();
}


// Init auth UI state
window.addEventListener('load', ()=> refreshAuthUI());

// ================== RENDER ==================
function render(){
  const section = data.sections[currentSectionIndex];
  membersDiv.innerHTML = "";

  section.members.forEach((m,i)=>{
    const card = document.createElement('div');
    card.className = `card ${m.status || ''}`;
    let actions = '';
    if(isSectionLogged()){
      actions = `
        <button class="btn-present" onclick="setStatus(${i},'present')">Présent</button>
        <button class="btn-absent" onclick="setStatus(${i},'absent')">Absent</button>
        <button class="btn-perm" onclick="setStatus(${i},'permission')">Permission</button>
        <button class="btn-edit" onclick="editMember(${i})">Modifier</button>
        <button class="btn-del" onclick="deleteMember(${i})">Supprimer</button>
      `;
    } else {
      actions = `<div style="opacity:.7;font-size:.9rem">Connectez-vous pour modifier</div>`;
    }
    // ensure presences array exists
    m.presences = m.presences || [];
    const last = m.presences.length ? new Date(m.presences[m.presences.length-1].ts) : null;
    const lastText = last ? `${last.toLocaleDateString()} ${last.toLocaleTimeString()}` : 'Aucune présence';
    const totalPres = m.presences.length;

    card.innerHTML = `
      <div class="name">${m.name}</div>
      <div class="status">Statut: <b>${labelStatus(m.status)}</b></div>
      <div class="presence-info">Dernière présence: <span class="last">${lastText}</span> &nbsp;(<span class="count">${totalPres}</span>)</div>
      <div class="actions">${actions}</div>
      <div style="margin-top:8px"><button onclick="openHistory(${i})">Historique</button></div>
    `;
    membersDiv.appendChild(card);
  });

  save();
}

// ================== STATS / EXPORT / PRINT ==================
function computeStats(){
  const totals = {present:0,absent:0,permission:0,unmarked:0};
  const bySection = data.sections.map(s => ({name:s.name,present:0,absent:0,permission:0,unmarked:0,total: s.members.length}));
  data.sections.forEach((s,si)=>{
    s.members.forEach(m=>{
      const st = m.status || 'unmarked';
      if(st==='present') totals.present++;
      else if(st==='absent') totals.absent++;
      else if(st==='permission') totals.permission++;
      else totals.unmarked++;
      bySection[si][st === 'unmarked' ? 'unmarked' : st]++;
    });
  });
  return {totals,bySection};
}

function openStats(){
  const s = computeStats();
  let html = `<p><b>Total présents:</b> ${s.totals.present} — <b>Total absents:</b> ${s.totals.absent} — <b>Permission:</b> ${s.totals.permission} — <b>Non marqués:</b> ${s.totals.unmarked}</p>`;
  html += '<h4>Par section</h4><ul>';
  s.bySection.forEach(b=>{
    html += `<li><b>${b.name}</b>: présents ${b.present}, absents ${b.absent}, permission ${b.permission}, non marqués ${b.unmarked} (total ${b.total})</li>`;
  });
  html += '</ul>';
  document.getElementById('statsContent').innerHTML = html;
  document.getElementById('statsModal').style.display = 'flex';
}
function closeStats(){ document.getElementById('statsModal').style.display='none'; }

function exportCSV(){
  let rows = [['Section','Nom','Statut']];
  data.sections.forEach(s=>{
    s.members.forEach(m=> rows.push([s.name, m.name, labelStatus(m.status)]));
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ucao_presence.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function exportPDF(){
  // Simple approach: open stats in new window and trigger print (user can Save as PDF)
  const s = computeStats();
  let content = `<h1>UCAO - Liste de présence</h1>`;
  data.sections.forEach(sct=>{
    content += `<h3>${sct.name}</h3><ul>`;
    sct.members.forEach(m=> content += `<li>${m.name} — ${labelStatus(m.status)}</li>`);
    content += `</ul>`;
  });
  const w = window.open('','_blank');
  w.document.write(`<html><head><title>Liste</title></head><body>${content}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=> w.print(), 300);
}

function printList(){ exportPDF(); }

// ================== HISTORIQUE ==================
function openHistory(i){
  const member = data.sections[currentSectionIndex].members[i];
  if(!member) return;
  const rows = member.presences || [];
  let html = '<div style="max-height:320px;overflow:auto;padding-right:6px">';
  if(rows.length === 0) html += '<p>Aucune présence enregistrée.</p>';
  else{
    html += '<ol>';
    rows.slice().reverse().forEach(r=>{
      const d = new Date(r.ts);
      const fmt = d.toLocaleString(undefined, { weekday:'long', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const tlabel = r.type ? labelStatus(r.type) : 'Présent';
      html += `<li><b>${tlabel}</b> — ${fmt}</li>`;
    });
    html += '</ol>';
  }
  html += '</div>';
  document.getElementById('historyContent').innerHTML = html;
  document.getElementById('historyModal').style.display = 'flex';
}
function closeHistory(){ document.getElementById('historyModal').style.display='none'; }

// ================== EDIT PRESENCE (CORRECTION) ==================
function openEditPresence(){
  if(!isSectionLogged()) return alert('Connectez-vous en tant que chef de cette section pour modifier les présences.');
  const sel = document.getElementById('editMemberSelect');
  sel.innerHTML = '';
  const members = data.sections[currentSectionIndex].members || [];
  members.forEach((m,i)=>{
    const opt = document.createElement('option'); opt.value = i; opt.textContent = m.name; sel.appendChild(opt);
  });
  document.getElementById('editPresenceModal').style.display = 'flex';
}

function closeEditPresence(){ document.getElementById('editPresenceModal').style.display='none'; }

function saveEditPresence(status){
  const sel = document.getElementById('editMemberSelect');
  const idx = +sel.value;
  if(isNaN(idx)) return alert('Sélectionnez un membre');
  const member = data.sections[currentSectionIndex].members[idx];
  if(!member) return alert('Membre introuvable');

  if(status === 'delete'){
    if(!member.presences || member.presences.length === 0) return alert('Aucune entrée à supprimer pour ce membre.');
    if(!confirm('Supprimer la dernière entrée pour "' + member.name + '" ?')) return;
    const removed = member.presences.pop();
    // update current status to last remaining entry's type or null
    const last = member.presences.length ? member.presences[member.presences.length-1].type : null;
    member.status = last || null;
    save();
    render();
    closeEditPresence();
    return alert('Dernière entrée supprimée.');
  }

  // apply correction: change status and push a correction entry
  member.status = status;
  member.presences = member.presences || [];
  member.presences.push({ ts: Date.now(), type: status, correction: true });

  save();
  render();
  closeEditPresence();
  alert('Correction enregistrée dans l\'historique');
}

function labelStatus(s){
  if(s==='present') return 'Présent';
  if(s==='absent') return 'Absent';
  if(s==='permission') return 'Permissionnaire';
  return 'Non marqué';
}

// ================== ACTIONS ==================
function setStatus(i,status){
  // update data
  const member = data.sections[currentSectionIndex].members[i];
  member.status = status;
  // record event for any status change (present/absent/permission)
  member.presences = member.presences || [];
  member.presences.push({ ts: Date.now(), type: status });
  // update the specific card immediately so the interior color changes without waiting
  const card = membersDiv.children[i];
  if(card){
    // ensure correct status class
    card.classList.remove('present','absent','permission');
    card.classList.add(status);
    // update presence info displayed
    const pres = member.presences || [];
    const lastEntry = pres.length ? pres[pres.length-1] : null;
    let lastText = 'Aucun enregistrement';
    if(lastEntry){
      const d = new Date(lastEntry.ts);
      const fmt = d.toLocaleString(undefined, { weekday:'long', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      lastText = `${labelStatus(lastEntry.type)} — ${fmt}`;
    }
    const lastSpan = card.querySelector('.presence-info .last') || card.querySelector('.last');
    const countSpan = card.querySelector('.presence-info .count') || card.querySelector('.count');
    if(lastSpan) lastSpan.textContent = lastText;
    if(countSpan) countSpan.textContent = pres.length;
  }
  // persist and rerender to keep DOM in sync
  save();
  render();
}

function deleteMember(i){
  if(confirm("Supprimer ce membre ?")){
    data.sections[currentSectionIndex].members.splice(i,1);
    render();
  }
}

function editMember(i){
  editIndex = i;
  const m = data.sections[currentSectionIndex].members[i];
  document.getElementById("memberName").value = m.name;
  document.getElementById("modalTitle").textContent = "Modifier le membre";
  openModal();
}

// ================== MODAL ==================
function openModal(){
  document.getElementById("modal").style.display="flex";
}
function closeModal(){
  document.getElementById("modal").style.display="none";
  document.getElementById("memberName").value="";
  document.getElementById("modalTitle").textContent = "Ajouter un membre";
  editIndex = null;
}

function saveMember(){
  const name = document.getElementById("memberName").value.trim();
  if(!name) return alert("Entrez le nom du membre");

  const section = data.sections[currentSectionIndex];

  if(editIndex !== null){
    section.members[editIndex].name = name;
  }else{
    section.members.push({name, status:null, presences: []});
  }
  closeModal();
  render();
}

function resetSections(){
  if(!confirm('Réinitialiser les sections par défaut ?')) return;
  const existing = data.sections || [];
  // Build new sections list: for each default, keep members/leader if name matches an existing section
  const newSections = defaultSections.map(name => {
    const found = existing.find(s => s.name === name);
    if(found){
      return { name: found.name, members: found.members || [], leaderPass: found.leaderPass };
    }
    return { name, members: [], leaderPass: null };
  });
  // Preserve any custom/extra sections (those not in defaults) by appending them
  const extras = existing.filter(s => !defaultSections.includes(s.name));
  if(extras.length) newSections.push(...extras);
  data.sections = newSections;
  currentSectionIndex = 0;
  init();
  save();
}



// ================== STORAGE ==================
function save(){
  localStorage.setItem("ucao_presence", JSON.stringify(data));
}

// Ouvre le modal admin
function openAdminReset(){
  document.getElementById('adminModal').style.display = 'flex';

  // remplir la liste des sections
  const sel = document.getElementById('adminSectionSelect');
  sel.innerHTML = '';
  data.sections.forEach((s,i)=>{
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

// Fermer le modal admin
function closeAdminReset(){
  document.getElementById('adminModal').style.display = 'none';
  document.getElementById('adminPass').value = '';
  document.getElementById('newLeaderPass').value = '';
}

// Réinitialiser le mot de passe chef de section
function doAdminReset(){
  const adminPass = document.getElementById('adminPass').value;
  if(adminPass !== 'ucao') return alert('Mot de passe admin incorrect');

  const secIndex = +document.getElementById('adminSectionSelect').value;
  const newPass = document.getElementById('newLeaderPass').value.trim();
  if(!newPass) return alert('Entrez un nouveau mot de passe pour la section');

  data.sections[secIndex].leaderPass = newPass;
  save();
  closeAdminReset();
  alert(`Mot de passe de la section "${data.sections[secIndex].name}" réinitialisé ✅`);
}

init();
