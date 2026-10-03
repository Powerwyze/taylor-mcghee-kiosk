const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openaiRequest}=require('../lib/openai-request');
for (const code of ['insufficient_quota','credit_balance_exhausted','rate_limit_exceeded','invalid_api_key']) {
 test(code, async()=>{
  const calls=[]; const body=new FormData(); body.append('prompt','same'); const signal=new AbortController().signal;
  const fetchImpl=async(url,opts)=>{calls.push(opts);return calls.length===1?new Response(JSON.stringify({error:{code}}),{status:429}):new Response('{}');};
  await openaiRequest('https://api.openai.com/v1/images/edits',{body,signal},{primary:'primary-test',backup:'backup-test',fetchImpl});
  const retry=['insufficient_quota','credit_balance_exhausted'].includes(code); assert.equal(calls.length,retry?2:1);
  if(retry){assert.equal(calls[1].body,body);assert.equal(calls[1].signal,signal);assert.equal(calls[1].headers.Authorization,'Bearer backup-test');}
 });
}
test('uncertain network failure is never retried',async()=>{let n=0;await assert.rejects(openaiRequest('x',{}, {primary:'a',backup:'b',fetchImpl:async()=>{n++;throw Error('network')}}));assert.equal(n,1);});
test('same backup key is not replayed',async()=>{let n=0;await openaiRequest('x',{}, {primary:'a',backup:'a',fetchImpl:async()=>{n++;return new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429})}});assert.equal(n,1);});
