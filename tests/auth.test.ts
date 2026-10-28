import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyPassword} from '../lib/verify-password';
test('verification cleans up only temporary session, preserving browser session', async()=>{
 let browserActive=true,temporaryActive=false;
 const auth={signInWithPassword:async()=>{temporaryActive=true;return {error:null}},signOut:async(options:{scope:'local'})=>{if(options.scope!=='local')browserActive=false;temporaryActive=false;return {error:null}}};
 await verifyPassword(auth,'admin@example.com','correct');
 assert.equal(browserActive,true);assert.equal(temporaryActive,false);
});
test('incorrect password cannot sign out any session',async()=>{
 let called=false;
 await assert.rejects(verifyPassword({signInWithPassword:async()=>({error:new Error('invalid')}),signOut:async()=>{called=true;return {error:null}}},'admin@example.com','wrong'),/Incorrect password/);
 assert.equal(called,false);
});
test('empty password never invokes authentication',async()=>{
 await assert.rejects(verifyPassword({signInWithPassword:async()=>{assert.fail('must not authenticate')},signOut:async()=>{assert.fail('must not sign out')}},'admin@example.com',''),/required/);
});
test('cleanup failure prevents sending instead of silently leaking temporary session',async()=>{
 await assert.rejects(verifyPassword({signInWithPassword:async()=>({error:null}),signOut:async()=>({error:new Error('offline')})},'admin@example.com','correct'),/close password verification session/);
});
