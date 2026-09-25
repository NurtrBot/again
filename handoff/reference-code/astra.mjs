// Server-only reference adapter. No live request executes until callAstraDirector is invoked.
import { readFileSync } from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../contracts/motion-plan.schema.json',import.meta.url)));
const instructions=readFileSync(new URL('../prompts/astra-director.txt',import.meta.url),'utf8');
export function buildAstraRequest({imageUrl,feeling='gentle',direction='',model='gpt-6-astra'}) {
 if(!['gentle','lively','surprise'].includes(feeling)) throw new Error('INVALID_FEELING');
 if(typeof direction!=='string'||direction.length>500) throw new Error('INVALID_DIRECTION');
 if(typeof imageUrl!=='string'||!imageUrl.startsWith('https://')) throw new Error('TRUSTED_HTTPS_IMAGE_REQUIRED');
 // Caller must mint this URL from owned validated storage; this string check is not authorization.
 return {model,store:false,reasoning:{effort:'medium'},max_output_tokens:6000,instructions,
  input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({selected_feeling:feeling,creative_direction:direction,duration_seconds:10})},{type:'input_image',image_url:imageUrl,detail:'high'}]}],
  text:{format:{type:'json_schema',name:'again_motion_plan',strict:true,schema}}};
}
export function validatePlan(value,feeling) {
 if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('INVALID_PLAN');
 if(Object.keys(value).length!==schema.required.length || schema.required.some(k=>!(k in value))) throw new Error('INVALID_PLAN_FIELDS');
 for(const [key,definition] of Object.entries(schema.properties)) {
  const v=value[key];
  if(definition.type==='string' && (typeof v!=='string'||v.length>1500)) throw new Error('INVALID_PLAN_'+key);
  if(definition.enum&&!definition.enum.includes(v)) throw new Error('INVALID_PLAN_'+key);
  if(definition.type==='array'&&(!Array.isArray(v)||v.length>12||v.some(s=>typeof s!=='string'||s.length>500))) throw new Error('INVALID_PLAN_'+key);
 }
 if(value.caution!==null&&(typeof value.caution!=='string'||value.caution.length>1000)) throw new Error('INVALID_CAUTION');
 if(value.motion_style!==feeling) throw new Error('STYLE_MISMATCH');
 if(value.subject_motion.length>3||value.environment_motion.length>2) throw new Error('EXCESSIVE_MOTION');
 return value;
}
export function parseAstraResponse(body,feeling) {
 if(body.status!=='completed') throw new Error('ASTRA_INCOMPLETE');
 const content=(body.output??[]).filter(x=>x.type==='message').flatMap(x=>x.content??[]);
 if(content.some(x=>x.type==='refusal')) throw new Error('ASTRA_REFUSAL');
 const text=content.filter(x=>x.type==='output_text').map(x=>x.text).join('');
 if(!text) throw new Error('ASTRA_NO_OUTPUT');
 return validatePlan(JSON.parse(text),feeling);
}
export async function callAstraDirector(args,{apiKey,fetchImpl=fetch}={}) {
 if(!apiKey) throw new Error('OPENAI_KEY_MISSING');
 const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(buildAstraRequest(args)),signal:AbortSignal.timeout(120000)});
 if(!response.ok) throw new Error(`ASTRA_HTTP_${response.status}`);
 return parseAstraResponse(await response.json(),args.feeling??'gentle');
}
export function compileMotionPrompt(plan) {
 validatePlan(plan,plan.motion_style);
 return [
  'A realistic living photograph. One continuous 10-second shot beginning exactly with the supplied source image.',
  'Preserve the original subjects, visible identities, anatomy, clothing, composition, lighting, architecture, products, lettering, logos and watermark. Keep occluded features occluded.',
  `Camera: ${plan.camera}`,
  `Visible subject movement: ${plan.subject_motion.join(' ')}`,
  `Environmental movement: ${plan.environment_motion.join(' ')}`,
  `Preserve in particular: ${plan.preserve.join('; ')}.`,
  `Avoid: ${plan.avoid.join('; ')}.`,
  `Sound: ${plan.audio}. No intelligible dialogue and no music.`,
  'Small believable motions. No added people or objects, no cuts, no scene changes, no dramatic orbit or large pose changes.'
 ].join('\n');
}
