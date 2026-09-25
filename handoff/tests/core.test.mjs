import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAstraRequest,parseAstraResponse,compileMotionPrompt} from '../reference-code/astra.mjs';
import {buildVideoInput,submitVideo,pollVideo,parseStatus,SubmissionUnknown,SubmissionRejected} from '../reference-code/higgsfield.mjs';
import {canonicalHash,resolveIdempotency,selectGrant,settleReservation,safeReturnTo,withinDurationTolerance} from '../reference-code/domain.mjs';
const plan=JSON.parse(readFileSync(new URL('../fixtures/motion-plan.json',import.meta.url)));
const source='https://owned-storage.example.test/source.jpg';
const astraBody=output=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
test('Astra uses image+text, requested model, strict schema and no retention',()=>{
 const r=buildAstraRequest({imageUrl:source,feeling:'gentle',direction:'Soft movement'});
 assert.equal(r.model,'gpt-6-astra');assert.equal(r.store,false);assert.equal(r.text.format.strict,true);
 assert.equal(r.input[0].content[1].image_url,source);assert.equal(parseAstraResponse(astraBody(plan),'gentle').motion_style,'gentle');
});
test('Refusal and incomplete output cannot become a paid video prompt',()=>{
 assert.throws(()=>parseAstraResponse({status:'incomplete',output:[]},'gentle'),/INCOMPLETE/);
 assert.throws(()=>parseAstraResponse({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},'gentle'),/REFUSAL/);
 assert.throws(()=>parseAstraResponse(astraBody({...plan,motion_style:'lively'}),'gentle'),/STYLE_MISMATCH/);
});
test('Provider payload stays ten seconds, pro endpoint compatible, single shot',()=>{
 const prompt=compileMotionPrompt(plan);assert.match(prompt,/Keep occluded features occluded/);
 const p=buildVideoInput({imageUrl:source,prompt});assert.equal(p.duration,10);assert.equal(p.sound,'on');assert.equal(p.multi_shots,false);assert.equal(p.cfg_scale,.5);
 assert.equal('resolution' in p,false);assert.equal('aspect_ratio' in p,false);
});
test('Ambiguous POST outcome does not automatically retry',async()=>{
 let calls=0; await assert.rejects(submitVideo({imageUrl:source,prompt:'animate'},{credentials:'test:test',fetchImpl:async()=>{calls++;throw new Error('connection reset');}}),SubmissionUnknown);
 assert.equal(calls,1);
});
test('Provider 5xx and unreadable accepted response remain unknown',async()=>{
 for(const fake of [{status:503,ok:false},{status:200,ok:true,json:async()=>({})}])
  await assert.rejects(submitVideo({imageUrl:source,prompt:'animate'},{credentials:'test:test',fetchImpl:async()=>fake}),SubmissionUnknown);
});
test('Definitive provider rejection remains distinct from uncertainty',async()=>{
 await assert.rejects(submitVideo({imageUrl:source,prompt:'animate'},{credentials:'test:test',fetchImpl:async()=>({status:422,ok:false})}),SubmissionRejected);
});
test('Submission returns request ID for durable persistence and resumption',async()=>{
 let posted;const result=await submitVideo({imageUrl:source,prompt:'animate'},{credentials:'test:test',fetchImpl:async(url,init)=>{posted={url,init};return {status:200,ok:true,json:async()=>({request_id:'fixture-id',status:'queued'})};}});
 assert.equal(result.requestId,'fixture-id');assert.match(posted.url,/kling-video\/v3.0\/pro\/image-to-video$/);
 assert.equal(posted.init.headers.Authorization,'Key test:test');
});
test('Polling resumes by ID and validates completed video and matching request',async()=>{
 const r=await pollVideo('fixture-id',{credentials:'test:test',fetchImpl:async()=>({ok:true,json:async()=>({request_id:'fixture-id',status:'completed',video:{url:'https://cdn.example.test/output.mp4'}})})});
 assert.equal(r.state,'completed');assert.throws(()=>parseStatus({request_id:'different',status:'failed'},'fixture-id'),/MISMATCH/);
 assert.throws(()=>parseStatus({request_id:'fixture-id',status:'completed'},'fixture-id'),/MISSING_VIDEO/);
});
test('Canonical payload hashing permits same logical request but rejects changed input',()=>{
 const a={draftId:'d',expectedDraftVersion:2};const b={expectedDraftVersion:2,draftId:'d'};
 assert.equal(canonicalHash(a),canonicalHash(b));assert.equal(resolveIdempotency({id:'j',payloadHash:canonicalHash(a)},b).kind,'reuse');
 assert.throws(()=>resolveIdempotency({id:'j',payloadHash:canonicalHash(a)},{...a,expectedDraftVersion:3}),/CONFLICT/);
});
const now=Date.parse('2026-09-25T12:00:00Z');
test('Soon-expiring valid grant is spent before purchased credit; expired excluded',()=>{
 const grants=[{id:'pack',available:5,expiresAt:null,createdAt:'2026-01-01'}, {id:'old',available:9,expiresAt:'2026-09-20',createdAt:'2026-01-01'}, {id:'monthly',available:1,expiresAt:'2026-10-01',createdAt:'2026-09-01'}];
 assert.equal(selectGrant(grants,now),'monthly');assert.throws(()=>selectGrant([{...grants[1]}],now),/INSUFFICIENT/);
});
test('Duplicate failure cannot refund twice',()=>{
 const grant={available:0,held:1,consumed:0,expired:0,expiresAt:null};const hold={id:'r',status:'held'};
 const first=settleReservation(grant,hold,'release',now);const second=settleReservation(first.grant,first.reservation,'release',now);
 assert.equal(first.grant.available,1);assert.equal(second.grant.available,1);assert.equal(second.changed,false);
});
test('Held credit can finish after expiration; failed held expiry creates one recovery credit',()=>{
 const grant={available:0,held:1,consumed:0,expired:0,expiresAt:'2026-09-24T00:00:00Z'};const hold={id:'r',status:'held'};
 const success=settleReservation(grant,hold,'capture',now);assert.equal(success.grant.consumed,1);assert.equal(success.recovery,null);
 const failure=settleReservation(grant,hold,'release',now);assert.equal(failure.grant.expired,1);assert.equal(failure.recovery.sourceKey,'recovery:r');assert.equal(failure.recovery.available,1);
});
test('External and slash-backslash redirects rejected, same-origin draft retained',()=>{
 assert.equal(safeReturnTo('https://evil.test'),' /create'.trim());assert.equal(safeReturnTo('//evil.test'),'/create');assert.equal(safeReturnTo('/\\evil.test'),'/create');assert.equal(safeReturnTo('/create/abc?resume=1'),'/create/abc?resume=1');
});
test('Container-frame tolerance accepts actual reference duration, rejects wrong-length clip',()=>{
 assert.equal(withinDurationTolerance(10.041667),true);assert.equal(withinDurationTolerance(5),false);assert.equal(withinDurationTolerance(NaN),false);
});
