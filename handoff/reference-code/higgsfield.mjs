// Server-only reference transport. The worker must durably record attempts before invoking submit.
export const MODEL='kling-video/v3.0/pro/image-to-video';
const BASE='https://api.higgsfield.ai';
export class SubmissionUnknown extends Error { constructor(message='PROVIDER_SUBMISSION_UNKNOWN'){super(message);this.name='SubmissionUnknown';} }
export class SubmissionRejected extends Error { constructor(status){super(`PROVIDER_REJECTED_${status}`);this.name='SubmissionRejected';this.status=status;} }
export function buildVideoInput({imageUrl,prompt}) {
 if(typeof imageUrl!=='string'||!imageUrl.startsWith('https://')) throw new Error('OWNED_HTTPS_SOURCE_REQUIRED');
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>12000) throw new Error('INVALID_PROMPT');
 return {image_url:imageUrl,prompt,duration:10,sound:'on',cfg_scale:0.5,multi_shots:false};
}
export async function submitVideo(input,{credentials,fetchImpl=fetch}={}) {
 if(!credentials) throw new Error('HF_CREDENTIALS_MISSING');
 const payload=buildVideoInput(input);
 let response;
 try {response=await fetchImpl(`${BASE}/${MODEL}`,{method:'POST',headers:{'Authorization':`Key ${credentials}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(120000)});}
 catch {throw new SubmissionUnknown();}
 // No automatic POST retry: a network error/5xx may occur after acceptance.
 if(response.status>=500||response.status===408) throw new SubmissionUnknown();
 if(!response.ok) throw new SubmissionRejected(response.status);
 let body;try{body=await response.json();}catch{throw new SubmissionUnknown('PROVIDER_ACCEPTED_UNREADABLE_RESPONSE');}
 if(typeof body.request_id!=='string'||!body.request_id) throw new SubmissionUnknown('PROVIDER_ACCEPTED_MISSING_ID');
 return {requestId:body.request_id,status:typeof body.status==='string'?body.status:'queued'};
}
export function parseStatus(body,expectedId) {
 if(body.request_id!==expectedId) throw new Error('PROVIDER_ID_MISMATCH');
 const value=String(body.status??'').toLowerCase();
 if(value==='completed') {
  if(typeof body.video?.url!=='string'||!body.video.url.startsWith('https://')) throw new Error('MISSING_VIDEO_URL');
  // URL is not safe to fetch yet: caller must apply host/DNS/redirect/size policy.
  return {state:'completed',outputUrl:body.video.url};
 }
 if(['failed','nsfw','canceled','cancelled'].includes(value)) return {state:'failed',code:value};
 if(['queued','in_progress'].includes(value)) return {state:'processing',phase:value};
 throw new Error('UNKNOWN_PROVIDER_STATUS');
}
export async function pollVideo(requestId,{credentials,fetchImpl=fetch}={}) {
 if(!credentials) throw new Error('HF_CREDENTIALS_MISSING');
 if(typeof requestId!=='string'||!requestId) throw new Error('REQUEST_ID_REQUIRED');
 const response=await fetchImpl(`${BASE}/requests/${encodeURIComponent(requestId)}/status`,{headers:{'Authorization':`Key ${credentials}`},signal:AbortSignal.timeout(30000)});
 if(!response.ok) throw new Error(`PROVIDER_POLL_HTTP_${response.status}`);
 return parseStatus(await response.json(),requestId);
}
