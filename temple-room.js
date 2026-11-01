'use strict';
// Comment-only temple admission and shared chat. The server, not the browser, owns attendance.
const crypto=require('crypto');
function createTempleRoom({notify=()=>{},now=()=>Date.now(),capacity=100}={}){
 const pending=new Map(),inside=new Map(),sessions=new Map(),messages=[],muted=new Set(),lastMessage=new Map();
 let counter=0,version=0;
 const clean=s=>String(s??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim();
 const text=s=>clean(s).slice(0,180);
 const name=s=>clean(s).slice(0,32);
 const emit=()=>{version++;notify('temple.room',publicRoom())};
 function identity(req,res){
  const match=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('temple_guest='));
  let token=match?.slice(13),session=token&&/^[0-9a-f]{48}$/.test(token)?sessions.get(token):null;
  if(!session){
   token=crypto.randomBytes(24).toString('hex');
   session={id:'web:'+token,name:'',lastSeen:now(),lastComment:0,chatAt:0};
   sessions.set(token,session);
   const secure=req.secure||req.headers['x-forwarded-proto']==='https';
   res.setHeader('Set-Cookie','temple_guest='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200'+(secure?'; Secure':''));
  }
  session.lastSeen=now();
  const person=inside.get(session.id);
  if(person)person.lastSeen=now();
  return session;
 }
 function tiktokKey(uniqueId){const v=String(uniqueId||'').trim().slice(0,96);return v?'tt:'+v:null}
 function request({id,displayName,comment,source='web'}){
  if(!id||(!id.startsWith('web:')&&!id.startsWith('tt:')))return {ok:false,reason:'invalid-identity'};
  const body=text(comment);if(!body)return {ok:false,reason:'empty-comment'};
  const existing=inside.get(id);if(existing){existing.lastSeen=now();return {ok:true,status:'approved'}};
  if(pending.size>=300&&!pending.has(id))return {ok:false,reason:'queue-full'};
  const p={id,name:name(displayName)||'Phật tử',comment:body,source:source==='tiktok'?'tiktok':'web',at:now()};
  const isNew=!pending.has(id);pending.set(id,p);
  if(isNew)emit();
  return {ok:true,status:'pending',isNew};
 }
 function tiktokComment(uniqueId,displayName,comment){
  const id=tiktokKey(uniqueId);if(!id)return {approved:false,status:'no-id'};
  const participant=inside.get(id);
  if(participant){participant.lastSeen=now();return {approved:true,id,person:participant}};
  request({id,displayName,comment,source:'tiktok'});
  return {approved:false,id,status:'pending'};
 }
 function approve(id,group='tiktok'){
  id=String(id||'');const p=pending.get(id);
  if(!p)return {ok:false,reason:'missing-request'};
  if(inside.size>=capacity)return {ok:false,reason:'full'};
  const person={id,name:p.name,source:p.source,group:group==='internal'?'internal':'tiktok',joinedAt:now(),lastSeen:now(),avatar:''};
  inside.set(id,person);pending.delete(id);emit();return {ok:true,person};
 }
 function deny(id){const exists=pending.delete(id);if(exists)emit();return exists}
 function remove(id){const ok=inside.delete(String(id));muted.delete(String(id));if(ok)emit();return ok}
 function list(){return [...inside.values()].map(p=>({...p}))}
 function publicRoom(){return {count:inside.size,capacity,pendingCount:pending.size,people:list().map(p=>({name:p.name,group:p.group,source:p.source})),version}}
 function moderation(){return {...publicRoom(),pending:[...pending.values()],inside:list().map(p=>({...p,muted:muted.has(p.id)})),messages:messages.map(m=>({...m})),muted:[...muted]}}
 function status(session){const p=inside.get(session.id);return {name:session.name,status:p?'approved':pending.has(session.id)?'pending':session.lastComment?'not-approved':'new',group:p?.group||null,...publicRoom()}}
 function submit(id,displayName,raw,source='web'){
  const participant=inside.get(id);if(!participant)return {ok:false,reason:'not-approved'};
  if(muted.has(id))return {ok:false,reason:'muted'};
  const body=text(raw);if(!body)return {ok:false,reason:'empty-comment'};
  const then=lastMessage.get(id)||0;if(now()-then<(source==='tiktok'?1700:3500))return {ok:false,reason:'cooldown'};
  lastMessage.set(id,now());participant.lastSeen=now();
  const entry={id:'m'+(++counter),senderId:id,name:name(displayName)||participant.name,text:body,source:source==='tiktok'?'tiktok':'web',at:new Date(now()).toISOString()};
  messages.push(entry);if(messages.length>80)messages.shift();version++;
  notify('temple.chat',{...entry,senderId:undefined});return {ok:true,message:entry};
 }
 function chat(id,asAdmin=false){
  if(!asAdmin&&!inside.has(id))return null;
  return {messages:messages.map(({senderId,...m})=>m),version,muted:muted.has(id)};
 }
 function deleteMessage(id){const i=messages.findIndex(m=>m.id===id);if(i<0)return false;messages.splice(i,1);version++;notify('temple.chat-sync',chat('',true));return true}
 function setMute(id,value){if(!inside.has(id))return false;if(value)muted.add(id);else muted.delete(id);emit();return true}
 function clearChat(){messages.splice(0,messages.length);version++;notify('temple.chat-sync',chat('',true))}
 function sweep(){
  const ts=now();let changed=false;
  for(const [id,p] of inside){const lifetime=id.startsWith('tt:')?30*60000:2*60000;if(ts-p.lastSeen>lifetime){inside.delete(id);muted.delete(id);changed=true}}
  for(const [id,p] of pending)if(ts-p.at>30*60000){pending.delete(id);changed=true}
  for(const [token,s] of sessions)if(ts-s.lastSeen>12*3600000)sessions.delete(token);
  if(changed)emit();
 }
 const timer=setInterval(sweep,15000);timer.unref?.();
 return {identity,request,tiktokComment,approve,deny,remove,list,publicRoom,moderation,status,submit,chat,deleteMessage,setMute,clearChat,sweep,isApproved:id=>inside.has(id),tiktokKey,pending,inside};
}
module.exports={createTempleRoom};
