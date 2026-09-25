// Pure helpers, not a substitute for DB locks, unique keys, or ownership enforcement.
import { createHash } from 'node:crypto';
export function canonicalHash(value) {
 const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(canon(value))).digest('hex');
}
export function resolveIdempotency(existing,payload) {
 const hash=canonicalHash(payload);
 if(existing&&existing.payloadHash!==hash) throw new Error('IDEMPOTENCY_CONFLICT');
 return existing?{kind:'reuse',id:existing.id}:{kind:'create',payloadHash:hash};
}
export function selectGrant(grants,now=Date.now()) {
 const usable=grants.filter(g=>g.available>0&&(!g.expiresAt||Date.parse(g.expiresAt)>now));
 usable.sort((a,b)=>(a.expiresAt?Date.parse(a.expiresAt):Infinity)-(b.expiresAt?Date.parse(b.expiresAt):Infinity)||Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
 if(!usable.length) throw new Error('INSUFFICIENT_CREDITS');
 return usable[0].id;
}
export function settleReservation(grant,reservation,outcome,now=Date.now()) {
 if(!['capture','release'].includes(outcome)) throw new Error('INVALID_SETTLEMENT');
 if(reservation.status!=='held') return {grant,reservation,recovery:null,changed:false};
 if(grant.held<1) throw new Error('INVALID_HELD_BALANCE');
 const next={...grant,held:grant.held-1};let recovery=null;
 if(outcome==='capture') next.consumed=(next.consumed??0)+1;
 else if(grant.expiresAt&&Date.parse(grant.expiresAt)<=now) {
  next.expired=(next.expired??0)+1;
  recovery={sourceKey:`recovery:${reservation.id}`,issued:1,available:1,expiresAt:new Date(now+7*86400000).toISOString()};
 }else next.available+=1;
 return {grant:next,reservation:{...reservation,status:outcome==='capture'?'captured':'released',settledAt:new Date(now).toISOString()},recovery,changed:true};
}
export function safeReturnTo(path,fallback='/create') {
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\\x00-\x1f]/.test(path)) return fallback;
 try {const u=new URL(path,'https://again.invalid');return u.origin==='https://again.invalid'?u.pathname+u.search+u.hash:fallback;}catch{return fallback;}
}
export function withinDurationTolerance(seconds){return Number.isFinite(seconds)&&Math.abs(seconds-10)<=0.15;}
