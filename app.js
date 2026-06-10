const SB_URL='https://andtyljudrsymincblaf.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuZHR5bGp1ZHJzeW1pbmNibGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTUzNDUsImV4cCI6MjA5NjIzMTM0NX0.VN1gIifS7T_KX89_LOaIDbGAaPuEgR_gWLibT6mOhR4';
const HEADERS={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'};
const TEAM_CONTACTS={'Samuel Mejia':{wa:'524424512999',email:'samuel.mejia@bombardier.com'},'Omar Balderas':{wa:'524427226388',email:'omar.balderas@bombardier.com'}};
const SECTION_ORDER=['Quality Leader','Focales','650','3500','CHECO 2'];
const MONTHS_ES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let cursosData=[],empleadosData=[],turnosData=[];
let activeCursoTab='agente',activeEquipoTab='directorio',activeMainTab='cursos';
let openGroups={},openEmps={};
let editCursosMode=false;
let pendingCurso=null;

async function sb(table,params=''){
  const res=await fetch(`${SB_URL}/rest/v1/${table}?${params}`,{headers:HEADERS});
  if(!res.ok){const t=await res.text();throw new Error(`${res.status}: ${t}`);}
  return res.json();
}

async function loadAll(){
  try{
    const[cursos,empleados]=await Promise.all([
      sb('Cursos','select=*&order=fecha_inicio.asc'),
      sb('Empleados','select=*&order=seccion.asc,nombre.asc&activo=eq.true')
    ]);
    cursosData=cursos;empleadosData=empleados;
    sb('Turnos','select=*').then(t=>{turnosData=t;}).catch(e=>console.warn('Turnos:',e));
    const areas=new Set(empleados.map(e=>e.seccion)).size;
    animCount('stat-miembros',empleados.length);
    animCount('stat-cursos',cursos.length);
    animCount('stat-areas',areas);
    setSyncState('live','En vivo');
  }catch(e){
    console.error('[Portal]',e);
    setSyncState('err','Error');
    ['content-cursos','content-equipo'].forEach(id=>{
      document.getElementById(id).innerHTML='<div class="state-msg"><span class="icon">⚠️</span>Error al conectar.</div>';
    });
  }
}

function setSyncState(s,t){document.getElementById('dot').className='dot '+s;document.getElementById('sync-text').textContent=t;}
function animCount(id,target){
  const el=document.getElementById(id);if(!el)return;
  let i=0;const steps=30,dur=900;
  const iv=setInterval(()=>{i++;el.textContent=Math.round(target*(i/steps));if(i>=steps){el.textContent=target;clearInterval(iv);}},dur/steps);
}

function switchMain(tab,btn){
  activeMainTab=tab;
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-'+tab).classList.add('active');
  if(tab==='cursos')renderCursos();
  if(tab==='equipo')renderEquipo();
  if(tab==='cumple')renderCumple();
}

function switchSub(page,tab,btn){
  btn.closest('.sub-tabs').querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  if(page==='cursos'){activeCursoTab=tab;openGroups={};renderCursos();}
  if(page==='equipo'){
    activeEquipoTab=tab;
    const searchWrap=document.getElementById('search-wrap-equipo');
    searchWrap.style.display=(tab==='responsables'||tab==='vista'||tab==='antiguedad')?'none':'';
    openEmps={};renderEquipo();
  }
}

function parseDate(s){
  if(!s)return null;
  if(s.includes('/')){const[m,d,y]=s.split('/');return new Date(+y,+m-1,+d);}
  const[y,m,d]=s.split('-');return new Date(+y,+m-1,+d);
}
function fmtDate(s){const d=parseDate(s);if(!d)return s||'—';return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'});}
function fmtTime(t){if(!t)return'—';const[h,m]=t.split(':');let hh=parseInt(h);const ap=hh>=12?'PM':'AM';hh=hh%12||12;return`${hh}:${m||'00'} ${ap}`;}
function endTime(hora,dur){if(!hora||!dur)return null;const[h,m]=hora.split(':').map(Number);const tot=h*60+m+Math.round(parseFloat(dur)*60);const eh=Math.floor(tot/60)%24,em=tot%60;return`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`;}
function initials(n){return(n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function getWeekDates(){
  const today=new Date();today.setHours(0,0,0,0);
  const dow=today.getDay();
  const mon=new Date(today);mon.setDate(today.getDate()-(dow===0?6:dow-1));
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}

function buildWeekStrip(empId){
  const days=getWeekDates();
  const today=new Date();today.setHours(0,0,0,0);
  const DAY_NAMES=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let html='<div class="week-box"><div class="wl">Esta semana</div><div class="wdays">';
  days.forEach((d,i)=>{
    const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const turno=turnosData.find(t=>t.empleado_id===empId&&t.fecha===iso);
    const code=turno?turno.codigo:(i>=5?'off':'—');
    const cls=turno?`dc-${esc(turno.codigo)}`:'dc-off';
    const todayCls=d.getTime()===today.getTime()?' dc-today':'';
    html+=`<div class="wd"><div class="wdn">${DAY_NAMES[i]}</div><div class="wdc ${cls}${todayCls}">${esc(code)}</div></div>`;
  });
  html+='</div></div>';return html;
}

function buildNextCourse(nombre){
  const today=new Date();today.setHours(0,0,0,0);
  const next=cursosData.filter(r=>{
    if((r.status||'pendiente')==='completado')return false;
    if((r.usuario||'').toLowerCase()!==nombre.toLowerCase())return false;
    const d=parseDate(r.fecha_inicio);return d&&d>=today;
  }).sort((a,b)=>parseDate(a.fecha_inicio)-parseDate(b.fecha_inicio))[0];
  if(!next)return'';
  const fin=endTime(next.hora_inicio,next.duracion);
  return`<div class="nc-box"><div class="ncl">Próximo curso</div><div class="nct">${esc(next.nombre_curso||'—')}</div><div class="ncm">${fmtDate(next.fecha_inicio)} · ${fmtTime(next.hora_inicio)}${fin?' – '+fmtTime(fin):''} · ${esc(next.modalidad||'—')}</div></div>`;
}

function renderCursos(){
  const q=(document.getElementById('search-cursos').value||'').toLowerCase().trim();
  const content=document.getElementById('content-cursos');
  const isComp=activeCursoTab==='completados';
  // Inject edit bar above content
  let editBar=document.getElementById('cursos-edit-bar');
  if(!editBar){
    editBar=document.createElement('div');editBar.id='cursos-edit-bar';
    editBar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);';
    content.parentElement.insertBefore(editBar,content);
  }
  editBar.innerHTML=editCursosMode
    ?'<span style="font-size:10px;font-weight:700;color:var(--green);background:rgba(45,106,63,.1);border:1px solid rgba(45,106,63,.2);border-radius:5px;padding:4px 10px;letter-spacing:.06em">✓ Modo edición</span><div style="display:flex;gap:8px"><button onclick="showCursoSheet(null)" style="font-family:Syne,sans-serif;font-size:11px;font-weight:700;background:var(--yellow);color:var(--ytext);border:none;padding:7px 14px;border-radius:7px;cursor:pointer">+ Nuevo curso</button><button onclick="toggleEditCursos()" style="font-family:Syne,sans-serif;font-size:11px;font-weight:700;background:var(--bg);color:var(--text3);border:1px solid var(--border);padding:7px 14px;border-radius:7px;cursor:pointer">Salir</button></div>'
    :'<span style="font-size:12px;color:var(--text3)">'+cursosData.filter(r=>(r.status||'pendiente')!=='completado').length+' cursos activos'</span><button onclick="toggleEditCursos()" style="font-family:Syne,sans-serif;font-size:11px;font-weight:700;background:var(--yellow);color:var(--ytext);border:none;padding:7px 14px;border-radius:7px;cursor:pointer">Editar cursos</button>';
  let data=cursosData.filter(r=>{
    const status=(r.status||'pendiente').toLowerCase();
    if(isComp&&status!=='completado')return false;
    if(!isComp&&status==='completado')return false;
    if(!q)return true;
    return(r.nombre_curso||'').toLowerCase().includes(q)||(r.usuario||'').toLowerCase().includes(q)||(r.modalidad||'').toLowerCase().includes(q);
  });
  if(!data.length){content.innerHTML=`<div class="state-msg"><span class="icon">${isComp?'✅':'🔍'}</span>${isComp?'No hay cursos completados aún.':'Sin resultados.'}</div>`;return;}
  if(activeCursoTab==='agente')renderCursosByKey(data,content,r=>r.usuario||'Sin asignar','agente');
  else if(activeCursoTab==='curso')renderCursosByKey(data,content,r=>r.nombre_curso||'Sin nombre','curso');
  else if(activeCursoTab==='fecha')renderCursosByFecha(data,content);
  else renderCursosByKey(data,content,r=>r.usuario||'Sin asignar','completados');
}

function renderCursosByKey(data,container,keyFn,prefix){
  const groups={};
  data.forEach(r=>{const k=keyFn(r);if(!groups[k])groups[k]=[];groups[k].push(r);});
  let html='';
  Object.keys(groups).sort().forEach(k=>{const gkey=prefix+':'+k;html+=buildGroupCard(gkey,initials(k),k,groups[k],openGroups[gkey]);});
  container.innerHTML=html;attachGroupListeners();scheduleReveal();
}

function renderCursosByFecha(data,container){
  const months={};
  data.forEach(r=>{
    const d=parseDate(r.fecha_inicio);
    const mk=d?`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`:'zzz';
    const ml=d?MONTHS_ES[d.getMonth()]+' '+d.getFullYear():'Sin fecha';
    if(!months[mk])months[mk]={label:ml,courses:{}};
    const ck=r.nombre_curso||'(sin nombre)';
    if(!months[mk].courses[ck])months[mk].courses[ck]=[];
    months[mk].courses[ck].push(r);
  });
  let html='';
  Object.keys(months).sort().forEach(mk=>{
    const{label,courses}=months[mk];
    html+=`<div class="section-heading">${esc(label)}</div>`;
    Object.keys(courses).sort().forEach(ck=>{const gkey=`fecha:${mk}:${ck}`;html+=buildGroupCard(gkey,initials(ck),ck,courses[ck],openGroups[gkey],true);});
  });
  container.innerHTML=html;attachGroupListeners();scheduleReveal();
}

function buildGroupCard(gkey,av,name,items,isOpen,byFecha){
  const openCls=isOpen?' open':'';
  const count=`${items.length} ${items.length===1?'elemento':'elementos'}`;
  let rows='';
  items.forEach(r=>{
    const fin=endTime(r.hora_inicio,r.duracion);
    const mod=(r.modalidad||'').toLowerCase();
    const modCls=mod.includes('virtual')?'badge-virtual':mod.includes('presencial')?'badge-presencial':'badge-gray';
    const dateStr=r.fecha_inicio&&r.fecha_final&&r.fecha_inicio!==r.fecha_final?`${fmtDate(r.fecha_inicio)} – ${fmtDate(r.fecha_final)}`:fmtDate(r.fecha_inicio);
    const sub2=byFecha?esc(r.usuario||'—'):dateStr;
    const isComp=r.status==='completado';
    const statusBadge=isComp?'<span class="badge badge-completado">Completado</span>':'';
    const editBtns=editCursosMode?`
      <div style="display:flex;gap:5px;margin-top:4px">
        <button onclick="showCursoSheet(${r.id})" style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:5px;border:1px solid var(--border);background:var(--bg);color:var(--text2);cursor:pointer">Editar</button>
        <button onclick="toggleCompletado(${r.id},${isComp})" style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:5px;border:1px solid ${isComp?'rgba(45,106,63,.3)':'rgba(133,79,11,.3)'};background:${isComp?'rgba(45,106,63,.1)':'rgba(133,79,11,.1)'};color:${isComp?'var(--green)':'var(--amber)'};cursor:pointer">${isComp?'Pendiente':'Completar'}</button>
        <button onclick="deleteCurso(${r.id})" style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:5px;border:1px solid rgba(226,75,74,.3);background:rgba(226,75,74,.08);color:#E24B4A;cursor:pointer">Eliminar</button>
      </div>`:'';
    rows+=`<div class="row"><div><div class="row-title">${esc(byFecha?r.usuario:r.nombre_curso)}</div><div class="row-sub"><span>${sub2}</span>${r.ubicacion?`<span class="row-sub-dot"></span><span>${esc(r.ubicacion)}</span>`:''}</div>${editBtns}</div><div class="row-right">${statusBadge}<span class="badge ${modCls}">${esc(r.modalidad||'—')}</span><span class="time-text">${fmtTime(r.hora_inicio)}${fin?' – '+fmtTime(fin):''}</span></div></div>`;
  });
  return`<div class="group-card reveal${openCls}" data-gkey="${esc(gkey)}"><div class="group-header${isOpen?' open':''}"><div class="group-left"><div class="group-avatar">${esc(av)}</div><div class="group-name">${esc(name)}</div></div><div class="group-meta"><span class="group-count">${count}</span><span class="chevron">▾</span></div></div><div class="group-body"><div class="group-body-inner">${rows}</div></div></div>`;
}

function attachGroupListeners(){
  document.querySelectorAll('.group-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const card=h.closest('.group-card');const gkey=card.dataset.gkey;
      const isNowOpen=card.classList.toggle('open');
      h.classList.toggle('open',isNowOpen);openGroups[gkey]=isNowOpen;
    });
  });
}

function renderEquipo(){
  const content=document.getElementById('content-equipo');
  if(activeEquipoTab==='responsables'){renderResponsables(content);return;}
  if(activeEquipoTab==='vista'){renderVistaGeneral();return;}
  if(activeEquipoTab==='antiguedad'){renderAntiguedad(content);return;}
  const q=(document.getElementById('search-equipo').value||'').toLowerCase().trim();
  const filtered=empleadosData.filter(e=>!q||e.nombre.toLowerCase().includes(q)||e.seccion.toLowerCase().includes(q)||e.rol.toLowerCase().includes(q));
  if(!filtered.length){content.innerHTML='<div class="state-msg"><span class="icon">🔍</span>Sin resultados.</div>';return;}
  const grouped={};SECTION_ORDER.forEach(s=>{grouped[s]=[];});
  filtered.forEach(e=>{if(!grouped[e.seccion])grouped[e.seccion]=[];grouped[e.seccion].push(e);});
  let html='';
  SECTION_ORDER.forEach(sec=>{
    const emps=grouped[sec];if(!emps||!emps.length)return;
    html+=`<div class="section-heading">${esc(sec==='650'?'Área 650':sec==='3500'?'Área 3500':sec)}</div>`;
    emps.forEach(e=>{html+=buildEmpCard(e);});
  });
  content.innerHTML=html;attachEmpListeners();scheduleReveal();
}

function buildEmpCard(emp){
  const avCls=emp.seccion==='Quality Leader'?'leader':emp.seccion==='Focales'?'focal':'';
  const rolBadge=emp.our_people?'<span class="badge badge-pendiente" style="font-size:9px">Our People</span>':'';
  return`<div class="emp-row reveal" data-empid="${emp.id}"><div class="emp-header"><div class="emp-av ${avCls}">${esc(initials(emp.nombre))}</div><div class="emp-info"><div class="emp-name">${esc(emp.nombre)}</div><div class="emp-role">${esc(emp.rol)}</div></div><div class="emp-right">${rolBadge}<span class="emp-chevron">&#9662;</span></div></div><div class="emp-detail"></div></div>`;
}

function attachEmpListeners(){
  document.querySelectorAll('.emp-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const card=h.closest('.emp-row');const empId=parseInt(card.dataset.empid);
      const isNowOpen=!openEmps[empId];
      document.querySelectorAll('.emp-row').forEach(r=>{
        const rid=parseInt(r.dataset.empid);
        if(rid!==empId){openEmps[rid]=false;r.classList.remove('open');r.querySelector('.emp-header').classList.remove('open');r.querySelector('.emp-detail').innerHTML='';}
      });
      openEmps[empId]=isNowOpen;card.classList.toggle('open',isNowOpen);h.classList.toggle('open',isNowOpen);
      const det=card.querySelector('.emp-detail');
      if(isNowOpen){
        const emp=empleadosData.find(e=>e.id===empId);if(!emp)return;
        const today=new Date();
        const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const tMes=turnosData.filter(t=>{if(t.empleado_id!==emp.id)return false;const d=new Date(t.fecha);return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();});
        const vacs=tMes.filter(t=>t.codigo==='V').length;const perms=tMes.filter(t=>t.codigo==='P').length;
        const todayT=turnosData.find(t=>t.empleado_id===emp.id&&t.fecha===todayIso);
        const eHoy=todayT?todayT.codigo:'T1';const eCls=eHoy==='V'?'pk':eHoy==='P'?'am':eHoy==='I'?'pk':'gr';
        det.innerHTML=`<div class="emp-detail-inner"><div class="info-grid"><div class="ic"><div class="il">Estado hoy</div><div class="iv ${eCls}">${esc(eHoy==='V'?'Vacaciones':eHoy==='P'?'Permiso':eHoy==='I'?'Incapacidad':'Activo')}</div></div><div class="ic"><div class="il">Área</div><div class="iv">${esc(emp.seccion)}</div></div><div class="ic"><div class="il">Vac. este mes</div><div class="iv ${vacs>0?'pk':'gr'}">${vacs} día${vacs!==1?'s':''}</div></div><div class="ic"><div class="il">Permisos</div><div class="iv ${perms>0?'am':'gr'}">${perms} día${perms!==1?'s':''}</div></div></div>${buildWeekStrip(emp.id)}${buildNextCourse(emp.nombre)}</div>`;
        det.style.opacity='0';det.style.transform='translateY(8px)';
        requestAnimationFrame(()=>{det.style.transition='opacity 0.3s ease,transform 0.3s cubic-bezier(0.22,1,0.36,1)';det.style.opacity='1';det.style.transform='translateY(0)';});
      }else{det.innerHTML='';}
    });
  });
}

function renderResponsables(container){
  const resp=empleadosData.filter(e=>e.our_people);
  let html='<div class="section-heading">Responsables Our People</div>';
  resp.forEach(e=>{
    const c=TEAM_CONTACTS[e.nombre]||{};
    html+=`<div class="resp-card reveal"><div class="resp-top"><div class="resp-av">${esc(initials(e.nombre))}</div><div><div class="resp-name">${esc(e.nombre)}</div><div class="resp-role">${esc(e.rol)} · Our People</div></div></div><div class="resp-links">${c.wa?`<a class="plink wa" href="https://wa.me/${c.wa}" target="_blank" rel="noopener">&#128172; WhatsApp</a>`:''} ${c.email?`<a class="plink em" href="mailto:${c.email}" target="_blank" rel="noopener">&#9993; Email</a>`:''}</div></div>`;
  });
  container.innerHTML=html;scheduleReveal();
}

function scheduleReveal(){
  requestAnimationFrame(()=>{
    const els=document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window)){els.forEach(el=>el.classList.add('visible'));return;}
    const obs=new IntersectionObserver((entries)=>{entries.forEach((e,i)=>{if(e.isIntersecting){setTimeout(()=>e.target.classList.add('visible'),i*30);obs.unobserve(e.target);}});},{threshold:.05});
    els.forEach(el=>obs.observe(el));
  });
}

function enterApp(){
  document.getElementById('splash').classList.add('hide');
  setTimeout(()=>{
    document.getElementById('splash').style.display='none';
    const app=document.getElementById('app');app.style.display='block';
    renderCursos();
  },520);
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',loadAll);}else{loadAll();}
const PIN='1108';
let editMode=false;
let vgYear=new Date().getFullYear();
let vgMonth=new Date().getMonth();
let pendingCell=null;
const SECTION_ORDER_VG=['Quality Leader','Focales','650','3500','CHECO 2'];
const SECTION_LABELS={'Quality Leader':'Quality Leader','Focales':'Focales','650':'Área 650','3500':'Área 3500','CHECO 2':'CHECO 2'};
const CODES=[
  {code:'1',label:'Turno 1',cls:'dc-1'},{code:'2',label:'Turno 2',cls:'dc-2'},
  {code:'3',label:'Turno 3',cls:'dc-3'},{code:'4',label:'T4 8-20h',cls:'dc-4'},
  {code:'V',label:'Vacación',cls:'dc-V'},{code:'P',label:'Permiso',cls:'dc-P'},
  {code:'I',label:'Incapacidad',cls:'dc-I'},{code:'C',label:'Curso',cls:'dc-C'},
  {code:'S',label:'Sábado',cls:'dc-S'},{code:'D',label:'Domingo',cls:'dc-D'},
  {code:'X',label:'No requerido',cls:'dc-X'},{code:'VP',label:'Vac. Planeada',cls:'dc-VP'},
];

function renderVistaGeneral(){
  const content=document.getElementById('content-equipo');
  const today=new Date();today.setHours(0,0,0,0);
  const daysInMonth=new Date(vgYear,vgMonth+1,0).getDate();
  const monthName=MONTHS_ES[vgMonth]+' '+vgYear;
  let thDays='';
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(vgYear,vgMonth,d);const dow=date.getDay();
    const isWknd=dow===0||dow===6;const isToday=date.getTime()===today.getTime();
    thDays+=`<th style="${isToday?'color:var(--ytext)':''}${isWknd?';opacity:.5':''}">${d}</th>`;
  }
  const grouped={};SECTION_ORDER_VG.forEach(s=>grouped[s]=[]);
  empleadosData.forEach(e=>{if(grouped[e.seccion])grouped[e.seccion].push(e);});
  let bodyRows='';
  SECTION_ORDER_VG.forEach(sec=>{
    const emps=grouped[sec];if(!emps||!emps.length)return;
    bodyRows+=`<tr class="vg-section-row"><td colspan="${daysInMonth+1}">${esc(SECTION_LABELS[sec]||sec)}</td></tr>`;
    emps.forEach(emp=>{
      let cells=`<td class="name-cell">${esc(emp.nombre.split(' ').slice(0,2).join(' '))}</td>`;
      for(let d=1;d<=daysInMonth;d++){
        const date=new Date(vgYear,vgMonth,d);const dow=date.getDay();const isWknd=dow===0||dow===6;
        const iso=`${vgYear}-${String(vgMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const turno=turnosData.find(t=>t.empleado_id===emp.id&&t.fecha===iso);
        const code=turno?turno.codigo:'';
        const cls=code?`dc-${code}`:(isWknd?'dc-off':'');
        const isToday=date.getTime()===today.getTime();
        const editCls=editMode&&!isWknd?' editable':'';
        const todayCls=isToday?' today-vg':'';
        const wkndCls=isWknd?' weekend':'';
        const dataAttr=editMode&&!isWknd?`data-emp="${emp.id}" data-fecha="${iso}"`:'';
        cells+=`<td class="vg-td"><div class="day-cell-vg ${cls}${editCls}${todayCls}${wkndCls}" ${dataAttr}>${esc(code)}</div></td>`;
      }
      bodyRows+=`<tr>${cells}</tr>`;
    });
  });
  content.innerHTML=`
    <div class="edit-bar">
      <span style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text)">${esc(monthName)}</span>
      <div style="display:flex;gap:8px;align-items:center">
        ${editMode?'<span class="edit-badge">✓ Modo edición</span><button class="edit-btn off" onclick="toggleEdit()">Salir</button>':'<button class="edit-btn" onclick="toggleEdit()">Editar turnos</button>'}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button class="vg-nav-btn" onclick="changeMonth(-1)">&#8592; ${MONTHS_ES[(vgMonth-1+12)%12].slice(0,3)}</button>
      <button class="vg-nav-btn" onclick="changeMonth(1)">${MONTHS_ES[(vgMonth+1)%12].slice(0,3)} &#8594;</button>
    </div>
    <div class="vg-wrap">
      <table class="vg-table">
        <thead><tr><th class="name-col">Empleado</th>${thDays}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
  if(editMode){
    content.querySelectorAll('.day-cell-vg.editable').forEach(cell=>{
      cell.addEventListener('click',()=>{pendingCell={empId:parseInt(cell.dataset.emp),fecha:cell.dataset.fecha};showCodePicker();});
    });
  }
}

function changeMonth(dir){
  vgMonth+=dir;
  if(vgMonth>11){vgMonth=0;vgYear++;}
  if(vgMonth<0){vgMonth=11;vgYear--;}
  renderVistaGeneral();
}

let pinBuffer='';
function toggleEdit(){if(editMode){editMode=false;renderVistaGeneral();return;}showPin();}
function showPin(){
  pinBuffer='';
  const overlay=document.createElement('div');overlay.className='pin-overlay';overlay.id='pin-overlay';
  overlay.innerHTML=`<div class="pin-card"><div class="pin-title">Modo edición</div><div class="pin-sub">Ingresa el PIN de 4 dígitos</div><div class="pin-dots"><div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div><div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div></div><div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" onclick="pinKey('${n}')">${n}</button>`).join('')}<button class="pin-key" onclick="pinKey('0')" style="grid-column:2">0</button><button class="pin-key del" onclick="pinDel()">&#9003;</button></div><div class="pin-error" id="pin-error"></div><span class="pin-cancel" onclick="closePin()">Cancelar</span></div>`;
  document.body.appendChild(overlay);
}
function pinKey(k){
  if(pinBuffer.length>=4)return;
  pinBuffer+=k;document.getElementById('pd'+(pinBuffer.length-1)).classList.add('filled');
  if(pinBuffer.length===4){
    setTimeout(()=>{
      if(pinBuffer===PIN){closePin();editMode=true;renderVistaGeneral();}
      else{pinBuffer='';for(let i=0;i<4;i++)document.getElementById('pd'+i).classList.remove('filled');document.getElementById('pin-error').textContent='PIN incorrecto, intenta de nuevo';}
    },200);
  }
}
function pinDel(){if(!pinBuffer.length)return;document.getElementById('pd'+(pinBuffer.length-1)).classList.remove('filled');pinBuffer=pinBuffer.slice(0,-1);const err=document.getElementById('pin-error');if(err)err.textContent='';}
function closePin(){const el=document.getElementById('pin-overlay');if(el)el.remove();pinBuffer='';}

function showCodePicker(){
  const overlay=document.createElement('div');overlay.className='code-overlay';overlay.id='code-overlay';
  const opts=CODES.map(c=>`<div class="code-opt ${c.cls}" onclick="selectCode('${c.code}')"><span class="code-opt-val">${c.code}</span><span class="code-opt-lbl">${c.label}</span></div>`).join('');
  overlay.innerHTML=`<div class="code-sheet"><div class="code-sheet-title">Selecciona código</div><div class="code-grid">${opts}</div><button class="code-cancel" onclick="closeCodePicker()">Cancelar</button></div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCodePicker();});
  document.body.appendChild(overlay);
}
async function selectCode(code){
  closeCodePicker();if(!pendingCell)return;
  const{empId,fecha}=pendingCell;pendingCell=null;
  const existing=turnosData.find(t=>t.empleado_id===empId&&t.fecha===fecha);
  if(existing){existing.codigo=code;}else{turnosData.push({empleado_id:empId,fecha,codigo:code});}
  renderVistaGeneral();
  try{
    if(existing){
      await fetch(`${SB_URL}/rest/v1/Turnos?empleado_id=eq.${empId}&fecha=eq.${fecha}`,{method:'PATCH',headers:{...HEADERS,Prefer:'return=minimal'},body:JSON.stringify({codigo:code})});
    }else{
      await fetch(`${SB_URL}/rest/v1/Turnos`,{method:'POST',headers:{...HEADERS,Prefer:'return=minimal'},body:JSON.stringify({empleado_id:empId,fecha,codigo:code})});
    }
  }catch(e){console.error('[Portal] Save error:',e);setSyncState('err','Error al guardar');}
}
function closeCodePicker(){const el=document.getElementById('code-overlay');if(el)el.remove();}


// ── EDICION DE CURSOS ──
const PIN_CURSOS='1108';
let pinBufCursos='';

function toggleEditCursos(){
  if(editCursosMode){editCursosMode=false;renderCursos();return;}
  showPinCursos();
}

function showPinCursos(){
  pinBufCursos='';
  const overlay=document.createElement('div');overlay.className='pin-overlay';overlay.id='pin-overlay-cursos';
  overlay.innerHTML=`<div class="pin-card"><div class="pin-title">Editar cursos</div><div class="pin-sub">Ingresa el PIN de 4 dígitos</div><div class="pin-dots"><div class="pin-dot" id="cpd0"></div><div class="pin-dot" id="cpd1"></div><div class="pin-dot" id="cpd2"></div><div class="pin-dot" id="cpd3"></div></div><div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" onclick="pinKeyCursos('${n}')">${n}</button>`).join('')}<button class="pin-key" onclick="pinKeyCursos('0')" style="grid-column:2">0</button><button class="pin-key del" onclick="pinDelCursos()">&#9003;</button></div><div class="pin-error" id="cpin-error"></div><span class="pin-cancel" onclick="closePinCursos()">Cancelar</span></div>`;
  document.body.appendChild(overlay);
}

function pinKeyCursos(k){
  if(pinBufCursos.length>=4)return;
  pinBufCursos+=k;document.getElementById('cpd'+(pinBufCursos.length-1)).classList.add('filled');
  if(pinBufCursos.length===4){
    setTimeout(()=>{
      if(pinBufCursos===PIN_CURSOS){closePinCursos();editCursosMode=true;renderCursos();}
      else{pinBufCursos='';for(let i=0;i<4;i++)document.getElementById('cpd'+i).classList.remove('filled');document.getElementById('cpin-error').textContent='PIN incorrecto';}
    },200);
  }
}
function pinDelCursos(){if(!pinBufCursos.length)return;document.getElementById('cpd'+(pinBufCursos.length-1)).classList.remove('filled');pinBufCursos=pinBufCursos.slice(0,-1);}
function closePinCursos(){const el=document.getElementById('pin-overlay-cursos');if(el)el.remove();pinBufCursos='';}

// ── SHEET DE CURSO ──
function showCursoSheet(id){
  const curso=id?cursosData.find(c=>c.id===id):null;
  const overlay=document.createElement('div');overlay.className='code-overlay';overlay.id='curso-sheet';
  const agentes=[...new Set(empleadosData.map(e=>e.nombre))].sort();
  const agentOpts=agentes.map(a=>`<option value="${esc(a)}" ${curso&&curso.usuario===a?'selected':''}>${esc(a)}</option>`).join('');
  overlay.innerHTML=`
    <div class="code-sheet" style="width:360px;max-height:85vh;overflow-y:auto">
      <div class="code-sheet-title">${curso?'Editar curso':'Nuevo curso'}</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Nombre del curso</div>
          <input id="cs-nombre" type="text" value="${esc(curso?.nombre_curso||'')}" placeholder="Nombre del curso" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Agente</div>
          <select id="cs-usuario" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
            <option value="">Seleccionar…</option>${agentOpts}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Fecha inicio</div>
            <input id="cs-finicio" type="date" value="${esc(curso?.fecha_inicio||'')}" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Fecha fin</div>
            <input id="cs-ffinal" type="date" value="${esc(curso?.fecha_final||'')}" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Hora inicio</div>
            <input id="cs-hora" type="time" value="${esc(curso?.hora_inicio||'')}" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Duración (hrs)</div>
            <input id="cs-dur" type="number" step="0.5" min="0.5" value="${esc(curso?.duracion||'')}" placeholder="2" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
          </div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Modalidad</div>
          <select id="cs-modalidad" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
            <option value="Virtual" ${curso?.modalidad==='Virtual'?'selected':''}>Virtual</option>
            <option value="Presencial" ${curso?.modalidad==='Presencial'?'selected':''}>Presencial</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Ubicación / Plataforma</div>
          <input id="cs-ubi" type="text" value="${esc(curso?.ubicacion||'')}" placeholder="Teams / Sala B4…" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:9px 12px;font-family:DM Sans,sans-serif;font-size:13px;color:var(--text);outline:none">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="code-cancel" onclick="closeCursoSheet()">Cancelar</button>
        <button onclick="saveCurso(${id||'null'})" style="font-family:Syne,sans-serif;font-size:12px;font-weight:700;background:var(--yellow);color:var(--ytext);border:none;padding:10px;border-radius:8px;cursor:pointer">${curso?'Guardar':'Agregar'}</button>
      </div>
    </div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCursoSheet();});
  document.body.appendChild(overlay);
}

function closeCursoSheet(){const el=document.getElementById('curso-sheet');if(el)el.remove();}

async function saveCurso(id){
  const data={
    nombre_curso:document.getElementById('cs-nombre').value.trim(),
    usuario:document.getElementById('cs-usuario').value,
    fecha_inicio:document.getElementById('cs-finicio').value,
    fecha_final:document.getElementById('cs-ffinal').value||document.getElementById('cs-finicio').value,
    hora_inicio:document.getElementById('cs-hora').value,
    duracion:parseFloat(document.getElementById('cs-dur').value)||null,
    modalidad:document.getElementById('cs-modalidad').value,
    ubicacion:document.getElementById('cs-ubi').value.trim(),
  };
  if(!data.nombre_curso||!data.usuario){alert('Nombre y agente son requeridos');return;}
  closeCursoSheet();
  try{
    if(id){
      await fetch(`${SB_URL}/rest/v1/Cursos?id=eq.${id}`,{method:'PATCH',headers:{...HEADERS,Prefer:'return=minimal'},body:JSON.stringify(data)});
      const idx=cursosData.findIndex(c=>c.id===id);
      if(idx>=0)cursosData[idx]={...cursosData[idx],...data};
    }else{
      const res=await fetch(`${SB_URL}/rest/v1/Cursos`,{method:'POST',headers:{...HEADERS,Prefer:'return=representation'},body:JSON.stringify(data)});
      const newC=await res.json();
      if(Array.isArray(newC)&&newC[0])cursosData.push(newC[0]);
      else cursosData.push({...data,id:Date.now(),status:'pendiente'});
    }
    renderCursos();
  }catch(e){console.error('[Portal] Save curso:',e);setSyncState('err','Error al guardar');}
}

async function toggleCompletado(id,isComp){
  const newStatus=isComp?'pendiente':'completado';
  try{
    await fetch(`${SB_URL}/rest/v1/Cursos?id=eq.${id}`,{method:'PATCH',headers:{...HEADERS,Prefer:'return=minimal'},body:JSON.stringify({status:newStatus})});
    const idx=cursosData.findIndex(c=>c.id===id);
    if(idx>=0)cursosData[idx].status=newStatus;
    renderCursos();
  }catch(e){console.error('[Portal] Toggle completado:',e);}
}

async function deleteCurso(id){
  if(!confirm('¿Eliminar este curso? Esta acción no se puede deshacer.'))return;
  try{
    await fetch(`${SB_URL}/rest/v1/Cursos?id=eq.${id}`,{method:'DELETE',headers:HEADERS});
    cursosData=cursosData.filter(c=>c.id!==id);
    renderCursos();
  }catch(e){console.error('[Portal] Delete curso:',e);}
}

// ── DATOS DE CUMPLEAÑOS (hardcoded, actualizar al agregar personal) ──
const BDAY_DATA = [
  {name:'Omarcin',        initials:'OM', birth:{m:0, d:26}, area:'CL3500', seniority:3.99,  hire:'Jun 2022', cake:'Zarzamora con queso'},
  {name:'Isra',           initials:'IS', birth:{m:1, d:20}, area:'CL650',  seniority:3.40,  hire:'Ene 2023', cake:'Moka'},
  {name:'Verenice',       initials:'VO', birth:{m:1, d:26}, area:'CL3500', seniority:3.76,  hire:'Sep 2022', cake:'Pay de zarzamora, imposible'},
  {name:'Cris',           initials:'CG', birth:{m:3, d:10}, area:'SBU',    seniority:7.31,  hire:'Feb 2019', cake:'Tres leches fruta'},
  {name:'Roque',          initials:'MR', birth:{m:6, d:17}, area:'CL650',  seniority:14.37, hire:'Ene 2012', cake:'Moka'},
  {name:'Joaquin',        initials:'JP', birth:{m:6, d:26}, area:'CL650',  seniority:0.96,  hire:'Jun 2025', cake:'—'},
  {name:'Samuel',         initials:'SM', birth:{m:7, d:2},  area:'CL3500', seniority:0.83,  hire:'Ago 2025', cake:'Rosca de vino tinto'},
  {name:'Alberto Garcia', initials:'AG', birth:{m:7, d:9},  area:'CL3500', seniority:8.02,  hire:'Jun 2018', cake:'Chocolate o Pay de queso'},
  {name:'Jorge',          initials:'JR', birth:{m:7, d:23}, area:'CL3500', seniority:14.73, hire:'Sep 2011', cake:'Queso con chocolate'},
  {name:'Kenneth',        initials:'KG', birth:{m:8, d:3},  area:'CL3500', seniority:2.36,  hire:'Ene 2024', cake:'Pastel de helado'},
  {name:'Solano',         initials:'MS', birth:{m:9, d:21}, area:'CL3500', seniority:4.03,  hire:'May 2022', cake:'Chocolate/Cheesecake'},
  {name:'Victor',         initials:'VG', birth:{m:9, d:23}, area:'CL3500', seniority:4.15,  hire:'Abr 2022', cake:'Café'},
  {name:'Virgilio',       initials:'LV', birth:{m:9, d:31}, area:'CL3500', seniority:17.81, hire:'Ago 2008', cake:'Pastel Matilda'},
  {name:'Juve',           initials:'JV', birth:{m:10,d:28}, area:'CL650',  seniority:17.61, hire:'Nov 2008', cake:'Tres leches fruta'},
];
const MONTHS_BDAY=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function bdayIsToday(m,d){const n=new Date();return m===n.getMonth()&&d===n.getDate();}
function bdayIsPast(m,d){const n=new Date();return m<n.getMonth()||(m===n.getMonth()&&d<n.getDate());}
function bdayDaysUntil(m,d){const n=new Date();const nx=new Date(n.getFullYear(),m,d);if(nx<n)nx.setFullYear(n.getFullYear()+1);return Math.round((nx-n)/86400000);}
function bdayAvCls(area){return area==='CL650'?'cl650':area==='SBU'?'sbu':'';}

function renderCumple(){
  const content=document.getElementById('content-cumple');
  const now=new Date();
  const tm=now.getMonth();

  // Ordenar por mes/día
  const sorted=[...BDAY_DATA].sort((a,b)=>a.birth.m!==b.birth.m?a.birth.m-b.birth.m:a.birth.d-b.birth.d);

  // Stats
  const enMes  =sorted.filter(p=>p.birth.m===tm).length;
  const proximos=sorted.filter(p=>!bdayIsToday(p.birth.m,p.birth.d)&&!bdayIsPast(p.birth.m,p.birth.d)&&bdayDaysUntil(p.birth.m,p.birth.d)<=30).length;
  const pasados =sorted.filter(p=>bdayIsPast(p.birth.m,p.birth.d)).length;

  let html=`<div class="stats-strip">
    <div class="stat-box-sm"><div class="sn yt">${enMes}</div><div class="sl">Este mes</div></div>
    <div class="stat-box-sm"><div class="sn gr">${proximos}</div><div class="sl">Próx. 30 días</div></div>
    <div class="stat-box-sm"><div class="sn">${pasados}</div><div class="sl">Ya pasaron</div></div>
    <div class="stat-box-sm"><div class="sn">${BDAY_DATA.length}</div><div class="sl">Total equipo</div></div>
  </div>`;

  // Agrupar por mes
  const byMonth={};
  sorted.forEach(p=>{if(!byMonth[p.birth.m])byMonth[p.birth.m]=[];byMonth[p.birth.m].push(p);});

  for(let m=0;m<12;m++){
    if(!byMonth[m])continue;
    const isCur=m===tm;
    html+=`<div class="section-heading${isCur?' current':''}">${MONTHS_BDAY[m]}${isCur?' · hoy':''}</div>`;
    byMonth[m].forEach(p=>{
      const today=bdayIsToday(p.birth.m,p.birth.d);
      const past =bdayIsPast(p.birth.m,p.birth.d);
      const days =bdayDaysUntil(p.birth.m,p.birth.d);
      const rowCls=today?'today':past?'past':'';
      const avClsV=today?'bday-hoy':bdayAvCls(p.area);
      let badge=today
        ?`<span class="badge badge-hoy">&#127874; ¡Hoy!</span>`
        :past
          ?`<span class="badge badge-pasado">Pasado</span>`
          :days<=30
            ?`<span class="badge badge-pronto">${days} días</span>`
            :`<span class="badge badge-pasado">${days} días</span>`;
      html+=`<div class="bday-row ${rowCls} reveal">
        <div class="bday-av ${avClsV}">${esc(p.initials)}</div>
        <div class="bday-info">
          <div class="bday-name">${esc(p.name)}</div>
          <div class="bday-meta">
            <span>${esc(p.area)}</span>
            ${p.cake&&p.cake!=='—'?`<span class="cake-tag">&#127874; ${esc(p.cake)}</span>`:''}
          </div>
        </div>
        <div class="bday-right">
          <div class="bday-date">${p.birth.d} ${MONTHS_BDAY[p.birth.m].slice(0,3).toLowerCase()}</div>
          ${badge}
        </div>
      </div>`;
    });
  }
  content.innerHTML=html;
  scheduleReveal();
}

// ── ANTIGÜEDAD ──
function getrank(s){
  if(s<2) return{key:'nuevo',  label:'🌱 Nuevo',       cls:'nuevo',  barCls:'fill-nuevo',  max:2};
  if(s<5) return{key:'consol', label:'⭐ Consolidado', cls:'consol', barCls:'fill-consol', max:5};
  if(s<10)return{key:'senior', label:'🔷 Senior',      cls:'senior', barCls:'fill-senior', max:10};
  return       {key:'veteran',label:'🏆 Veterano',    cls:'veteran',barCls:'fill-veteran',max:20};
}

function renderAntiguedad(container){
  const sorted=[...BDAY_DATA].sort((a,b)=>b.seniority-a.seniority);
  const counts={nuevo:0,consol:0,senior:0,veteran:0};
  sorted.forEach(p=>counts[getrank_key(p.seniority)]++);

  let html=`<div class="stats-strip">
    <div class="stat-box-sm"><div class="sn gr">${counts.nuevo}</div><div class="sl">🌱 Nuevos</div></div>
    <div class="stat-box-sm"><div class="sn yt">${counts.consol}</div><div class="sl">⭐ Consolidados</div></div>
    <div class="stat-box-sm"><div class="sn bl">${counts.senior}</div><div class="sl">🔷 Seniors</div></div>
    <div class="stat-box-sm"><div class="sn pk">${counts.veteran}</div><div class="sl">🏆 Veteranos</div></div>
  </div>
  <div class="ant-legend">
    <div class="ant-legend-item"><span class="ant-legend-dot" style="background:var(--green)"></span>Nuevo · 0–2 años</div>
    <div class="ant-legend-item"><span class="ant-legend-dot" style="background:var(--yellow)"></span>Consolidado · 2–5 años</div>
    <div class="ant-legend-item"><span class="ant-legend-dot" style="background:var(--blue)"></span>Senior · 5–10 años</div>
    <div class="ant-legend-item"><span class="ant-legend-dot" style="background:var(--pink)"></span>Veterano · 10+ años</div>
  </div>`;

  let prevKey=null;
  sorted.forEach(p=>{
    const r=getrank(p.seniority);
    if(r.key!==prevKey){html+=`<div class="section-heading">${r.label}</div>`;prevKey=r.key;}
    const pct=Math.min(100,Math.round((p.seniority/r.max)*100));
    html+=`<div class="ant-row reveal">
      <div class="ant-top">
        <div class="ant-av r-${r.cls}">${esc(p.initials)}</div>
        <div class="ant-info">
          <div class="ant-name">${esc(p.name)}</div>
          <div class="ant-sub">${esc(p.area)} · Desde ${esc(p.hire)}</div>
        </div>
        <div class="ant-right">
          <div class="ant-years">${p.seniority.toFixed(1)}<small> años</small></div>
          <span class="rank-badge rank-${r.cls}">${r.label}</span>
        </div>
      </div>
      <div class="ant-bar-wrap"><div class="ant-bar-fill ${r.barCls}" style="width:${pct}%"></div></div>
    </div>`;
  });
  container.innerHTML=html;
  scheduleReveal();
}

function getrank_key(s){return s<2?'nuevo':s<5?'consol':s<10?'senior':'veteran';}
