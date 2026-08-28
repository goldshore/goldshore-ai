import { adminApi } from './admin-api-client';

type Density = 'compact' | 'balanced' | 'comfortable';
type ModulePreference = { id:string; order?:number; width?:number; height?:number; colSpan?:number; hidden?:boolean };
type LayoutPreference = { version:1; density:Density; modules:ModulePreference[]; updatedAt?:string|null };

const CACHE_PREFIX = 'gs-admin-layout:v1:';
const DENSITIES: Density[] = ['compact','balanced','comfortable'];
const pageKey = () => `${location.pathname}${location.search ? `?${new URLSearchParams(location.search).toString()}` : ''}`;
const cacheKey = () => `${CACHE_PREFIX}${pageKey()}`;
const modules = () => [...document.querySelectorAll<HTMLElement>('.gs-module[data-module-id], .gs-module[data-draggable="true"]')];
const isMobileLayout = () => matchMedia('(max-width: 900px)').matches;
const isCoarsePointer = () => matchMedia('(pointer: coarse)').matches;

let current: LayoutPreference = { version:1, density:'balanced', modules:[] };
let saveTimer: number | undefined;
let resizeObserver: ResizeObserver | null = null;
let dragging: HTMLElement | null = null;
let activeDropTarget: HTMLElement | null = null;

const moduleId = (el: HTMLElement, index:number) => el.dataset.moduleId || el.id || `module-${index}`;

function readLocal(): LayoutPreference | null {
  try { const raw=localStorage.getItem(cacheKey()); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeLocal(value: LayoutPreference) { try { localStorage.setItem(cacheKey(), JSON.stringify(value)); } catch {} }

function setDensity(value: Density) {
  current.density = DENSITIES.includes(value) ? value : 'balanced';
  document.body.classList.remove('gs-density-compact','gs-density-balanced','gs-density-comfortable');
  document.body.classList.add(`gs-density-${current.density}`);
  document.querySelectorAll<HTMLButtonElement>('[data-admin-density]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.adminDensity === current.density)));
}

function applyPreference(pref: LayoutPreference) {
  current = pref;
  setDensity(pref.density || 'balanced');
  const byId = new Map(pref.modules.map(m => [m.id, m]));
  const list = modules();
  for (const [index, el] of list.entries()) {
    const id=moduleId(el,index); el.dataset.moduleId=id;
    const p=byId.get(id); if(!p) continue;
    if(typeof p.order==='number') el.style.order=String(p.order);
    el.hidden=Boolean(p.hidden);
    if(!isMobileLayout()) {
      if(p.width) el.style.width=`min(100%, ${p.width}px)`;
      if(p.height) el.style.height=`${p.height}px`;
      if(p.colSpan) el.style.gridColumn=`span ${Math.max(1,Math.min(12,p.colSpan))}`;
    } else {
      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.style.removeProperty('grid-column');
      delete el.dataset.dragX;
      delete el.dataset.dragY;
    }
  }
  list.sort((a,b) => (Number(getComputedStyle(a).order)||0) - (Number(getComputedStyle(b).order)||0));
  const parents = new Set(list.map(el => el.parentElement).filter(Boolean));
  for (const parent of parents) {
    list.filter(el => el.parentElement===parent).forEach(el => parent!.appendChild(el));
  }
}

function snapshot(): LayoutPreference {
  return {
    version:1,
    density:current.density,
    updatedAt:new Date().toISOString(),
    modules:modules().map((el,index) => {
      const rect=el.getBoundingClientRect();
      const grid=el.parentElement;
      let colSpan:number|undefined;
      if(!isMobileLayout() && grid && getComputedStyle(grid).display==='grid') {
        const parentWidth=grid.getBoundingClientRect().width;
        const gap=parseFloat(getComputedStyle(grid).columnGap||'0');
        const unit=(parentWidth-gap*11)/12;
        if(unit>0) colSpan=Math.max(1,Math.min(12,Math.round((rect.width+gap)/(unit+gap))));
      }
      return {
        id:moduleId(el,index),
        order:index,
        width:isMobileLayout()?undefined:Math.round(rect.width),
        height:isMobileLayout()?undefined:Math.round(rect.height),
        colSpan,
        hidden:el.hidden
      };
    })
  };
}

async function persist() {
  const pref=snapshot(); current=pref; writeLocal(pref);
  await adminApi(`/api/admin/layout?page=${encodeURIComponent(pageKey())}`, { method:'PUT', body:JSON.stringify(pref) });
}
function queuePersist(delay=500) { window.clearTimeout(saveTimer); saveTimer=window.setTimeout(() => void persist(), delay); }

function installDensityControl() {
  const header=document.querySelector<HTMLElement>('.gs-page-header, .gs-control-header');
  if(!header || header.querySelector('[data-density-control]')) return;
  const wrap=document.createElement('div'); wrap.dataset.densityControl=''; wrap.className='gs-density-control'; wrap.setAttribute('aria-label','Dashboard density');
  for(const density of DENSITIES){const button=document.createElement('button');button.type='button';button.className='gs-density-button';button.dataset.adminDensity=density;button.textContent=density[0].toUpperCase()+density.slice(1);button.setAttribute('aria-pressed',String(current.density===density));button.addEventListener('click',()=>{setDensity(density);queuePersist(150);});wrap.append(button);}
  const toolbar=header.querySelector<HTMLElement>('.gs-toolbar'); if(toolbar) toolbar.prepend(wrap); else header.append(wrap);
}

function clearDropTarget() {
  if(activeDropTarget) delete activeDropTarget.dataset.dropTarget;
  activeDropTarget=null;
}

function reorderAgainst(el:HTMLElement, under:HTMLElement, clientY:number) {
  if(under===el || under.parentElement!==el.parentElement) return;
  const parent=el.parentElement!;
  const rect=under.getBoundingClientRect();
  const insertAfter=isMobileLayout() ? clientY > rect.top + rect.height/2 : undefined;
  if(isMobileLayout()) {
    if(insertAfter) parent.insertBefore(el, under.nextSibling); else parent.insertBefore(el, under);
  } else {
    const children=[...parent.querySelectorAll<HTMLElement>('.gs-module[data-module-id]')];
    const from=children.indexOf(el), to=children.indexOf(under); if(from<0||to<0) return;
    if(from<to) parent.insertBefore(el, under.nextSibling); else parent.insertBefore(el, under);
  }
  [...parent.querySelectorAll<HTMLElement>('.gs-module[data-module-id]')].forEach((child,i)=>child.style.order=String(i));
}

function installDrag() {
  modules().forEach((el,index) => {
    const id=moduleId(el,index); el.dataset.moduleId=id;
    if(el.dataset.draggable!=='true' || el.dataset.dragInstalled==='true') return;
    el.dataset.dragInstalled='true';
    el.addEventListener('pointerdown', event => {
      const target=event.target as HTMLElement;
      if(target.closest('button,a,input,select,textarea,[contenteditable="true"]')) return;
      if(isMobileLayout() && isCoarsePointer() && !target.closest('.gs-module-header,.drag-handle')) return;
      dragging=el;
      el.dataset.dragging='true';
      try { el.setPointerCapture(event.pointerId); } catch {}
      if(isMobileLayout() && isCoarsePointer()) event.preventDefault();
    });
    el.addEventListener('pointermove', event => {
      if(dragging!==el) return;
      if(isMobileLayout() && isCoarsePointer()) event.preventDefault();
      const under=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('.gs-module[data-module-id]');
      if(!under || under===el || under.parentElement!==el.parentElement) { clearDropTarget(); return; }
      if(activeDropTarget!==under){clearDropTarget();activeDropTarget=under;under.dataset.dropTarget='true';}
      reorderAgainst(el,under,event.clientY);
    });
    const finish=(event:PointerEvent)=>{
      if(dragging!==el)return;
      dragging=null;
      delete el.dataset.dragging;
      clearDropTarget();
      try{el.releasePointerCapture(event.pointerId);}catch{}
      queuePersist(250);
    };
    el.addEventListener('pointerup',finish);
    el.addEventListener('pointercancel',finish);
  });
}

function installResize() {
  if(!('ResizeObserver' in window)) return;
  let primed=false;
  resizeObserver=new ResizeObserver(entries => { if(!primed || isMobileLayout())return; if(entries.some(entry => (entry.target as HTMLElement).dataset.resizable==='true')) queuePersist(700); });
  modules().forEach(el => { if(el.dataset.resizable==='true') resizeObserver!.observe(el); });
  requestAnimationFrame(()=>{primed=true;});
}

function installResponsiveReset() {
  let wasMobile=isMobileLayout();
  window.addEventListener('resize',()=>{
    const mobile=isMobileLayout();
    if(mobile===wasMobile) return;
    wasMobile=mobile;
    if(mobile) {
      modules().forEach(el=>{
        el.style.removeProperty('width');
        el.style.removeProperty('height');
        el.style.removeProperty('grid-column');
        el.style.removeProperty('transform');
        delete el.dataset.dragX;
        delete el.dataset.dragY;
      });
    } else {
      applyPreference(current);
    }
  },{passive:true});
}

export async function initializeAdminLayout() {
  const local=readLocal(); if(local) applyPreference(local); else setDensity('balanced');
  const result=await adminApi<{preference:LayoutPreference}>(`/api/admin/layout?page=${encodeURIComponent(pageKey())}`);
  if(result.ok && result.data.preference){applyPreference(result.data.preference);writeLocal(result.data.preference);}
  installDensityControl(); installDrag(); installResize(); installResponsiveReset();
}

export async function resetAdminLayout() {
  localStorage.removeItem(cacheKey());
  await adminApi(`/api/admin/layout?page=${encodeURIComponent(pageKey())}`, {method:'DELETE'});
  location.reload();
}
