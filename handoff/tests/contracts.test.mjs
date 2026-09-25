import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,existsSync}from'node:fs';
const root=new URL('../',import.meta.url);const read=p=>JSON.parse(readFileSync(new URL(p,root)));
test('All 21 states map to seven original boards and unique review routes',()=>{
 const screens=read('design/screens.json');assert.equal(screens.length,21);assert.equal(new Set(screens.map(x=>x.board)).size,7);assert.equal(new Set(screens.map(x=>x.reviewRoute)).size,21);
 for(const s of screens){assert.ok(existsSync(new URL(s.board,root)));assert.ok(s.primaryAction);assert.ok(s.route.startsWith('/'));}
});
test('Every internal OpenAPI schema reference resolves; every operation ID is unique',()=>{
 const api=read('contracts/openapi.json');const ids=[];
 function visit(v){if(!v||typeof v!=='object')return;if(v.$ref){assert.ok(v.$ref.startsWith('#/'));let target=api;for(const p of v.$ref.slice(2).split('/')) target=target?.[p];assert.ok(target,`missing ${v.$ref}`);}for(const x of Object.values(v))visit(x);}
 visit(api);for(const path of Object.values(api.paths))for(const op of Object.values(path))ids.push(op.operationId);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.includes('createGeneration'));assert.ok(ids.includes('receiveStripeWebhook'));
 const gen=api.paths['/api/v1/generations'].post;assert.ok(gen.parameters.some(x=>x.name==='Idempotency-Key'&&x.required));assert.ok(gen.responses['402']);
});
test('Catalog matches approved proposed prices and distinguishes recurrence',()=>{
 const rows=read('contracts/catalog.json').products;assert.equal(rows.length,5);assert.equal(rows.find(x=>x.code==='pack_5').amountCents,1900);assert.equal(rows.find(x=>x.code==='monthly_10').interval,'month');assert.equal(rows.find(x=>x.code==='pack_10').interval,null);
});
