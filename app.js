const SB_URL='https://andtyljudrsymincblaf.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuZHR5bGp1ZHJzeW1pbmNibGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTUzNDUsImV4cCI6MjA5NjIzMTM0NX0.VN1gIifS7T_KX89_LOaIDbGAaPuEgR_gWLibT6mOhR4';
const HEADERS={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'};
const TEAM_CONTACTS={'Samuel Mejia':{wa:'524424512999',email:'samuel.mejia@bombardier.com'},'Omar Balderas':{wa:'524427226388',email:'omar.balderas@bombardier.com'}};
const SECTION_ORDER=['Quality Leader','Focales','650','3500','CHECO 2'];
const MONTHS_ES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let cursosData=[],empleadosData=[],turnosData=[];
let activeCursoTab='agente',activeEquipoTab='directorio',activeMainTab='cursos';
let openGroups={},openEmps={};

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
}

function switchSub(page,tab,btn){
  btn.closest('.sub-tabs').querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  if(page==='cursos'){activeCursoTab=tab;openGroups={};renderCursos();}
  if(page==='equipo'){
    activeEquipoTab=tab;
    document.getElementById('search-wrap-equipo').style.display=(tab==='responsables'||tab==='vista')?'none':'';
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
    const statusBadge=(r.status&&r.status==='completado')?'<span class="badge badge-completado">Completado</span>':'';
    rows+=`<div class="row"><div><div class="row-title">${esc(byFecha?r.usuario:r.nombre_curso)}</div><div class="row-sub"><span>${sub2}</span>${r.ubicacion?`<span class="row-sub-dot"></span><span>${esc(r.ubicacion)}</span>`:''}</div></div><div class="row-right">${statusBadge}<span class="badge ${modCls}">${esc(r.modalidad||'—')}</span><span class="time-text">${fmtTime(r.hora_inicio)}${fin?' – '+fmtTime(fin):''}</span></div></div>`;
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
