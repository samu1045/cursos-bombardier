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
