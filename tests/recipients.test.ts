import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeRecipient,normalize} from '../lib/recipients';
const a={id:'a',name:'Ama',phone:'+233240000001',email:'a@example.com',description:''};
test('adds a different email without duplicated phone',()=>{assert.deepEqual(mergeRecipient([a],{...a,id:undefined,email:'b@example.com'}),{kind:'new',record:{...a,id:undefined,email:'b@example.com',phone:null}})});
test('fills missing email',()=>{const r=mergeRecipient([{...a,email:null}],{...a,email:'b@example.com'});assert.equal(r.kind,'update');if(r.kind==='update')assert.equal(r.record.email,'b@example.com')});
test('skips split contacts',()=>{assert.equal(mergeRecipient([a,{...a,id:'b',email:'b@example.com',phone:'+233240000002'}],{...a,email:'b@example.com'}).kind,'skip')});
test('skips missing contacts',()=>assert.equal(mergeRecipient([],normalize({name:'Ama'})).kind,'skip'));
test('normalizes email and phone',()=>assert.equal(normalize({email:' A@Example.com ',phone:'+233 (24) 000 0001'}).phone,'+233240000001'));
test('rejects invalid email',()=>assert.throws(()=>normalize({email:'invalid'})));
