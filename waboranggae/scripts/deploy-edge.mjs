import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { createHash } from 'node:crypto';
import { loadSupabaseSettings } from './check-supabase.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function main(){
  if(!process.argv.includes('--deploy-validation'))throw Error('EXPLICIT_DEPLOY_FLAG_REQUIRED');
  const functionDir=path.join(root,'supabase/functions/waboranggae-api');
  const entry=await readFile(path.join(functionDir,'index.ts'),'utf8');
  const bundle=entry.match(/import\('\.\/(app-([a-f0-9]{16})\.mjs)'\)/);
  if(!bundle || createHash('sha256').update(await readFile(path.join(functionDir,bundle[1]))).digest('hex').slice(0,16)!==bundle[2])throw Error('BUILD_CURRENT_EDGE_BUNDLE_FIRST');
  const config=parse(await readFile(path.join(root,'.env.edge.local')));
  if(Object.keys(config).some(name=>name.startsWith('TMAP_')))throw Error('RETIRED_PROVIDER_SECRET_FORBIDDEN');
  if(config.NODE_ENV!=='production'||config.API_RUNTIME!=='supabase-edge')throw Error('EDGE_ENVIRONMENT_REQUIRED');
  const admin=await loadSupabaseSettings();
  const ref=decodeURIComponent(new URL(admin.connectionString).username).split('.').at(-1);
  if(!/^[a-z]{20}$/.test(ref)||config.PUBLIC_APP_URL!=='https://'+ref+'.supabase.co/functions/v1/waboranggae-api')throw Error('PROJECT_MISMATCH');
  if(config.EDGE_VALIDATION_MODE!=='true'||(config.EDGE_VALIDATION_KEY||'').length<32)throw Error('VALIDATION_GATE_REQUIRED');
  if(decodeURIComponent(new URL(config.DATABASE_URL).username)!=='waboranggae_api.'+ref)throw Error('RUNTIME_ROLE_REQUIRED');
  const cli=path.join(root,'.tools/edge/supabase.exe');
  function run(args){
    const result=spawnSync(cli,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
    if(result.status!==0){
      // CLI errors can echo secret values: redact every locally configured value.
      let message=result.stderr+'\n'+result.stdout;
      for(const value of Object.values(config).filter(x=>x.length>5))message=message.split(value).join('[REDACTED]');
      const lines=message.split(/\r?\n/).filter(x=>x.length<700).slice(-12);
      console.error(JSON.stringify({step:args.slice(0,2).join(' '),diagnostic:lines}));
      throw Error('SUPABASE_CLI_FAILED');
    }
  }
  if(!process.argv.includes('--code-only')){
    run(['secrets','set','--env-file','.env.edge.local','--project-ref',ref]);
    console.log('Server-only runtime secrets uploaded to the selected project.');
  }
  run(['functions','deploy','waboranggae-api','--project-ref',ref,'--use-api','--no-verify-jwt']);
  console.log(JSON.stringify({deployed:true,validationOnly:true,apiBase:config.PUBLIC_APP_URL,secretsUploaded:!process.argv.includes('--code-only'),existingPcConfigurationUnchanged:true}));
}
main().catch(error=>{console.error(/^[A-Z0-9_]{3,80}$/.test(error?.message||'')?error.message:'EDGE_DEPLOY_FAILED');process.exitCode=1;});
