import {loadSupabaseSettings} from './check-supabase.mjs';
import {readFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import pg from 'pg';
const settings=await loadSupabaseSettings();
const config=parse(await readFile('.env.edge.local'));
const client=new pg.Client({...settings,connectionTimeoutMillis:10000,query_timeout:10000,application_name:'waboranggae-quota-readonly'});
try {
 await client.connect();await client.query('BEGIN READ ONLY');
 const result=await client.query("SELECT key,count FROM api_quota_buckets WHERE key LIKE 'kakao:total:%' ORDER BY key DESC LIMIT 2");
 await client.query('ROLLBACK');
 console.log(JSON.stringify({readOnly:true,configuredLimit:Number(config.KAKAO_DAILY_REQUEST_LIMIT||200),usage:result.rows},null,2));
}catch{console.error('QUOTA_READ_FAILED');process.exitCode=1;}finally{await client.end();}
