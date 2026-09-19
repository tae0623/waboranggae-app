import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const env=parse(await readFile('.env.edge.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(env.PUBLIC_APP_URL,base);assert.equal(env.EDGE_VALIDATION_MODE,'true');
const results=[];
for(const probe of [null,'x-forwarded-for','x-real-ip','cf-connecting-ip']){
  const headers={'X-Waboranggae-Validation':env.EDGE_VALIDATION_KEY};
  if(probe)headers[probe]='203.0.113.9';
  const response=await fetch(base+'/internal/ingress-check',{headers,redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!probe)assert.equal(response.status,200);
  results.push({probe:probe||'baseline',status:response.status,...(response.status===200?await response.json():{})});
}
const report={checkedAt:new Date().toISOString(),results,kakaoCalls:0,rawIpsStored:false};
await writeFile('.runtime/edge-ingress-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
