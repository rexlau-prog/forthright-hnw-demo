import {t} from './language.js?v=2695d527b6c00845';
export const textSizes=[{id:'standard',label:'標準',scale:1},{id:'large',label:'大',scale:1.15},{id:'extra-large',label:'特大',scale:1.3}];
let size='standard';
try {const saved=globalThis.localStorage?.getItem('forthright-text-size');if(textSizes.some(s=>s.id===saved))size=saved;} catch {}
export const textSize=()=>size;
export function setTextSize(value){
 size=textSizes.some(s=>s.id===value)?value:'standard';
 try {globalThis.localStorage?.setItem('forthright-text-size',size);} catch {}
 globalThis.document?.documentElement.style.setProperty('--text-scale',String(textSizes.find(s=>s.id===size).scale));
 return size;
}
export function textSizeControl(){const current=textSizes.find(s=>s.id===size);return `<button type="button" class="text-size-control" data-action="text-size" aria-label="${t('文字大小')}：${t(current.label)}" title="${t('點選切換文字大小：標準、大、特大')}"><span aria-hidden="true">A<span class="size-a">A</span></span><span>${t(current.label)}</span></button>`;}
export const tagPalette=['#34735d','#2563eb','#7c3aed','#be185d','#b45309','#b91c1c','#0e7490','#475569'];
export const validTagColor=color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color);
export function tagColors(color){
 if(!validTagColor(color))return null;
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 return {background:color,foreground:luminance>.179?'#111111':'#ffffff'};
}
