
const DB_KEY = "gymlog_v3";

const state = {
  route: { name: "list", id: null }, // list | workout | stats | settings
  data: load() || { workouts: [] },
};

function save(){ localStorage.setItem(DB_KEY, JSON.stringify(state.data)); }
function load(){ try { return JSON.parse(localStorage.getItem(DB_KEY)); } catch { return null; } }
function isoDate(d){ return d.toISOString().slice(0,10); }

function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function escapeAttr(s){ return escapeHtml(s).replaceAll('"',"&quot;"); }
function el(html){ const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstElementChild; }

function pushRoute(name, id=null){
  state.route = { name, id };
  render();
}

function prettyDate(iso){
  if(!iso) return "";
  const d = new Date(iso+"T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
}
function durationMinutes(start, end){
  if(!start || !end) return "";
  const [sh,sm]=start.split(":").map(Number);
  const [eh,em]=end.split(":").map(Number);
  const a=sh*60+sm, b=eh*60+em;
  const m=b-a;
  return m>0 ? m : "";
}
function toNumber(x){
  if(x === null || x === undefined) return NaN;
  const s = String(x).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function epley1RM(weight, reps){
  const w = toNumber(weight);
  const r = toNumber(reps);
  if(!Number.isFinite(w) || !Number.isFinite(r) || r<=0) return NaN;
  return w * (1 + r/30);
}

function appRoot(){ return document.getElementById("app"); }

function setNavCurrent(name){
  document.querySelectorAll(".navbtn").forEach(b=>{
    const is = b.dataset.nav === name;
    if(is) b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
}

function render(){
  const root = appRoot();
  root.innerHTML = "";

  const titleEl = document.getElementById("title");
  const backBtn = document.getElementById("btnBack");
  const fab = document.getElementById("fab");

  if(state.route.name === "workout"){
    titleEl.textContent = "Allenamento";
    backBtn.style.display = "inline-block";
    fab.style.display = "none";
    setNavCurrent("list");
    root.appendChild(renderWorkout(state.route.id));
    return;
  }

  backBtn.style.display = "none";
  fab.style.display = state.route.name === "list" ? "block" : "none";

  if(state.route.name === "list"){
    titleEl.textContent = "Registro";
    setNavCurrent("list");
    root.appendChild(renderList());
  } else if(state.route.name === "stats"){
    titleEl.textContent = "Statistiche";
    setNavCurrent("stats");
    root.appendChild(renderStats());
  } else if(state.route.name === "settings"){
    titleEl.textContent = "Impostazioni";
    setNavCurrent("settings");
    root.appendChild(renderSettings());
  }
}

function renderList(){
  const wrap = el(`<div></div>`);
  const workouts = [...state.data.workouts].sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  if(workouts.length === 0){
    wrap.appendChild(el(`<div class="card"><div class="title">Nessun allenamento</div><div class="small">Premi + per crearne uno.</div></div>`));
    return wrap;
  }
  workouts.forEach(w=>{
    const mins = durationMinutes(w.start, w.end);
    const preview = (w.exercises||[]).slice(0,5).map(ex=>`${(ex.sets||[]).length}x ${ex.name}`);
    const card = el(`
      <div class="card" role="button" tabindex="0">
        <div class="row">
          <div>
            <div class="small">${prettyDate(w.date)}</div>
            <div class="title">${escapeHtml(w.name||"Allenamento")}</div>
          </div>
          <div class="badge">${mins ? `${mins} min.` : ""}</div>
        </div>
        <ul class="list">${preview.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </div>
    `);
    card.addEventListener("click", ()=> pushRoute("workout", w.id));
    wrap.appendChild(card);
  });
  return wrap;
}

function bindInput(scope, sel, setter){
  const node = scope.querySelector(sel);
  node.addEventListener("input", ()=>{ setter(node.value); save(); });
}

function renderWorkout(id){
  const w = state.data.workouts.find(x=>x.id===id);
  if(!w) return el(`<div class="card">Allenamento non trovato.</div>`);

  const wrap = el(`<div></div>`);

  const header = el(`
    <div class="card">
      <div class="fieldgrid">
        <input class="input" id="w_name" placeholder="Nome" value="${escapeAttr(w.name||"")}" />
        <input class="input" id="w_bw" placeholder="Mi peso" value="${escapeAttr(w.bodyweight||"")}" />
        <input class="input" id="w_date" type="date" value="${escapeAttr(w.date||"")}" />
        <input class="input" id="w_start" type="time" value="${escapeAttr(w.start||"")}" />
        <input class="input" id="w_end" type="time" value="${escapeAttr(w.end||"")}" />
        <textarea class="input" id="w_notes" placeholder="Note">${escapeHtml(w.notes||"")}</textarea>
      </div>
      <div class="actions">
        <button class="btn accent" id="btnAddEx">+ Esercizio</button>
        <button class="btn" id="btnDuplicate">Duplica allenamento</button>
        <button class="btn danger" id="btnDelete">Elimina</button>
      </div>
    </div>
  `);

  wrap.appendChild(header);

  bindInput(header, "#w_name", v=>w.name=v);
  bindInput(header, "#w_bw", v=>w.bodyweight=v);
  bindInput(header, "#w_date", v=>w.date=v);
  bindInput(header, "#w_start", v=>w.start=v);
  bindInput(header, "#w_end", v=>w.end=v);
  bindInput(header, "#w_notes", v=>w.notes=v);

  header.querySelector("#btnAddEx").addEventListener("click", ()=>{
    w.exercises.push({ id: crypto.randomUUID(), name: "Nuovo esercizio", sets: [] });
    save(); render();
  });

  header.querySelector("#btnDuplicate").addEventListener("click", ()=>{
    const newid = crypto.randomUUID();
    const clone = JSON.parse(JSON.stringify(w));
    clone.id = newid;
    clone.date = isoDate(new Date());
    for(const ex of clone.exercises||[]){
      ex.id = crypto.randomUUID();
      for(const s of ex.sets||[]){
        s.id = crypto.randomUUID();
        s.done = false;
      }
    }
    state.data.workouts.push(clone);
    save();
    pushRoute("workout", newid);
  });

  header.querySelector("#btnDelete").addEventListener("click", ()=>{
    if(!confirm("Eliminare questo allenamento?")) return;
    state.data.workouts = state.data.workouts.filter(x=>x.id!==w.id);
    save(); pushRoute("list");
  });

  (w.exercises||[]).forEach(ex=>{
    const exBox = el(`
      <div class="card exercise">
        <div class="row">
          <h3 contenteditable="true" class="exname">${escapeHtml(ex.name||"Esercizio")}</h3>
          <button class="kebab" title="Elimina esercizio">✕</button>
        </div>
        <div class="small">Peso / Rip. / Note</div>
        <div class="sets"></div>
        <div class="actions">
          <button class="btn" data-addset>+ Aggiungi set</button>
          <button class="btn" data-clone>Duplica ultimo set</button>
        </div>
      </div>
    `);

    const nameEl = exBox.querySelector(".exname");
    nameEl.addEventListener("input", ()=>{ ex.name = nameEl.textContent.trim(); save(); });

    exBox.querySelector(".kebab").addEventListener("click", ()=>{
      if(!confirm("Eliminare questo esercizio?")) return;
      w.exercises = w.exercises.filter(x=>x.id!==ex.id);
      save(); render();
    });

    const setsEl = exBox.querySelector(".sets");
    ex.sets.forEach(s=> setsEl.appendChild(renderSetRow(ex, s)));

    exBox.querySelector("[data-addset]").addEventListener("click", ()=>{
      ex.sets.push({ id: crypto.randomUUID(), done:false, weight:"", reps:"", note:"" });
      save(); render();
    });

    exBox.querySelector("[data-clone]").addEventListener("click", ()=>{
      const last = ex.sets[ex.sets.length-1];
      if(!last){
        ex.sets.push({ id: crypto.randomUUID(), done:false, weight:"", reps:"", note:"" });
      } else {
        ex.sets.push({ id: crypto.randomUUID(), done:false, weight:last.weight, reps:last.reps, note:"" });
      }
      save(); render();
    });

    wrap.appendChild(exBox);
  });

  return wrap;
}

function renderSetRow(ex, s){
  const row = el(`
    <div class="setrow">
      <span class="chk ${s.done ? "done":""}" role="button" aria-label="Fatto"></span>
      <input class="mini" inputmode="decimal" placeholder="+Peso" value="${escapeAttr(s.weight ?? "")}">
      <input class="mini" inputmode="numeric" placeholder="Rip." value="${escapeAttr(s.reps ?? "")}">
      <input class="mini" placeholder="Note" value="${escapeAttr(s.note ?? "")}">
      <button class="kebab" title="Elimina set">✕</button>
    </div>
  `);

  row.querySelector(".chk").addEventListener("click", ()=>{ s.done=!s.done; save(); render(); });

  const [wEl, rEl, nEl] = row.querySelectorAll("input.mini");
  wEl.addEventListener("input", ()=>{ s.weight=wEl.value; save(); });
  rEl.addEventListener("input", ()=>{ s.reps=rEl.value; save(); });
  nEl.addEventListener("input", ()=>{ s.note=nEl.value; save(); });

  row.querySelector("button").addEventListener("click", ()=>{
    ex.sets = ex.sets.filter(x=>x.id!==s.id);
    save(); render();
  });

  return row;
}

function renderStats(){
  const wrap = el(`<div></div>`);
  const workouts = state.data.workouts || [];
  const totalW = workouts.length;
  const totalSets = workouts.reduce((acc,w)=> acc + (w.exercises||[]).reduce((a,e)=> a + (e.sets||[]).length, 0), 0);
  const totalReps = workouts.reduce((acc,w)=> acc + (w.exercises||[]).reduce((a,e)=> a + (e.sets||[]).reduce((b,s)=> b + (toNumber(s.reps)||0), 0), 0), 0);

  const prs = new Map();
  for(const w of workouts){
    for(const ex of w.exercises||[]){
      const key = (ex.name||"").trim();
      if(!key) continue;
      for(const s of ex.sets||[]){
        const wt = toNumber(s.weight);
        const rp = toNumber(s.reps);
        const one = epley1RM(wt, rp);
        const cur = prs.get(key) || { maxWeight: -Infinity, best1RM: -Infinity };
        if(Number.isFinite(wt) && wt > cur.maxWeight) cur.maxWeight = wt;
        if(Number.isFinite(one) && one > cur.best1RM) cur.best1RM = one;
        prs.set(key, cur);
      }
    }
  }
  const prList = [...prs.entries()].sort((a,b)=> (b[1].best1RM||-1) - (a[1].best1RM||-1));

  wrap.appendChild(el(`
    <div class="card">
      <div class="grid2">
        <div><div class="small">Allenamenti</div><div class="kpi">${totalW}</div></div>
        <div><div class="small">Set totali</div><div class="kpi">${totalSets}</div></div>
        <div><div class="small">Ripetizioni</div><div class="kpi">${totalReps}</div></div>
        <div><div class="small">Esercizi unici</div><div class="kpi">${prs.size}</div></div>
      </div>
    </div>
  `));

  const prCard = el(`<div class="card"><div class="title">PR stimati (Epley 1RM)</div><div class="small">Stima = peso × (1 + reps/30).</div><div id="prlist"></div></div>`);
  const list = prCard.querySelector("#prlist");

  if(prList.length === 0){
    list.appendChild(el(`<div class="small">Inserisci almeno un set con peso e ripetizioni per vedere i PR.</div>`));
  } else {
    const ul = el(`<ul class="list"></ul>`);
    for(const [name, pr] of prList.slice(0, 30)){
      const one = Number.isFinite(pr.best1RM) ? pr.best1RM.toFixed(1) : "-";
      const mw = Number.isFinite(pr.maxWeight) ? pr.maxWeight.toFixed(1) : "-";
      ul.appendChild(el(`<li><b>${escapeHtml(name)}</b> — 1RM: <span class="mono">${one}</span> | max peso: <span class="mono">${mw}</span></li>`));
    }
    list.appendChild(ul);
  }
  wrap.appendChild(prCard);

  const exCard = el(`
    <div class="card">
      <div class="title">Export</div>
      <div class="small">CSV = un record per set (utile per Excel/Sheets). JSON = backup completo.</div>
      <div class="actions">
        <button class="btn accent" id="btnCsv">Esporta CSV (set)</button>
        <button class="btn" id="btnJson">Esporta JSON</button>
      </div>
    </div>
  `);
  exCard.querySelector("#btnCsv").addEventListener("click", exportCSV);
  exCard.querySelector("#btnJson").addEventListener("click", exportJSON);
  wrap.appendChild(exCard);

  return wrap;
}

function renderSettings(){
  const wrap = el(`<div></div>`);

  const backup = el(`
    <div class="card">
      <div class="title">Backup & Ripristino</div>
      <div class="small">Consiglio: fai export JSON e salvalo su Drive.</div>
      <div class="actions">
        <button class="btn accent" id="btnJson2">Esporta JSON</button>
        <button class="btn" id="btnCsv2">Esporta CSV (set)</button>
      </div>
    </div>
  `);
  backup.querySelector("#btnJson2").addEventListener("click", exportJSON);
  backup.querySelector("#btnCsv2").addEventListener("click", exportCSV);
  wrap.appendChild(backup);

  const maint = el(`
    <div class="card">
      <div class="title">Manutenzione</div>
      <div class="small">Attenzione: cancella tutti i dati locali.</div>
      <div class="actions">
        <button class="btn danger" id="btnReset">Reset dati</button>
      </div>
    </div>
  `);
  maint.querySelector("#btnReset").addEventListener("click", ()=>{
    if(!confirm("Cancellare TUTTI i dati?")) return;
    state.data = { workouts: [] };
    save();
    render();
  });
  wrap.appendChild(maint);

  wrap.appendChild(el(`
    <div class="card">
      <div class="title">Offline</div>
      <div class="small">Service worker disattivato durante sviluppo (GitHub Pages) per evitare cache “incollate”. Quando vuoi offline, lo riattiviamo con update automatico.</div>
    </div>
  `));

  return wrap;
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:"application/json"});
  downloadBlob(blob, "gymlog-backup.json");
}

function exportCSV(){
  const rows = [["workout_id","workout_name","date","start","end","bodyweight","exercise","set_done","weight","reps","note"]];
  for(const w of state.data.workouts||[]){
    for(const ex of w.exercises||[]){
      for(const s of ex.sets||[]){
        rows.push([
          w.id||"", w.name||"", w.date||"", w.start||"", w.end||"", w.bodyweight||"",
          ex.name||"", s.done ? "1":"0", s.weight ?? "", s.reps ?? "", s.note ?? ""
        ]);
      }
    }
  }
  const csv = rows.map(r=> r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  downloadBlob(blob, "gymlog-sets.csv");
}

function csvCell(x){
  const s = String(x ?? "");
  if(s.includes('"') || s.includes(",") || s.includes("\n")){
    return '"' + s.replaceAll('"','""') + '"';
  }
  return s;
}

function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Topbar
document.getElementById("btnBack").addEventListener("click", ()=> pushRoute("list"));
document.getElementById("btnExport").addEventListener("click", exportJSON);

document.getElementById("fileImport").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    if(!obj?.workouts) throw new Error("Formato non valido");
    state.data = obj;
    save(); render();
  } catch(err){
    alert("Import fallito: " + err.message);
  }
  e.target.value = "";
});

// Bottom nav
document.querySelectorAll(".navbtn").forEach(b=>{
  b.addEventListener("click", ()=>{
    const dest = b.dataset.nav;
    if(dest === "list") pushRoute("list");
    if(dest === "stats") pushRoute("stats");
    if(dest === "settings") pushRoute("settings");
  });
});

// FAB new workout
document.getElementById("fab").addEventListener("click", ()=>{
  const id = crypto.randomUUID();
  const today = isoDate(new Date());
  state.data.workouts.push({
    id, name:"Allenamento del mattino", date:today, start:"", end:"", bodyweight:"", notes:"",
    exercises:[
      { id: crypto.randomUUID(), name:"Trazioni", sets:[{id:crypto.randomUUID(),done:false,weight:0,reps:8,note:"Riscaldamento"}] },
      { id: crypto.randomUUID(), name:"Panca piana", sets:[{id:crypto.randomUUID(),done:false,weight:40,reps:8,note:""}] }
    ]
  });
  save();
  pushRoute("workout", id);
});

render();
