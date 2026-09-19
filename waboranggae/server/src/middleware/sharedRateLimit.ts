import rateLimit, { type Options, type Store } from 'express-rate-limit';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { prisma } from '../db/client';
import { validTeamWebValidation } from '../runtime/edge-validation';

export function normalizedNetwork(value:string):string {
  const input=value.trim();
  if(isIP(input)===4)return input;
  if(isIP(input)!==6 || input.includes('%'))throw Error('CLIENT_NETWORK_UNAVAILABLE');
  const host=new URL('http://['+input+']/').hostname.slice(1,-1);
  if(host.startsWith('::ffff:')) {
    const parts=host.slice(7).split(':').map(v=>parseInt(v,16));
    if(parts.length===2)return [parts[0]!>>8,parts[0]!&255,parts[1]!>>8,parts[1]!&255].join('.');
  }
  const sides=host.split('::'),left=sides[0]!.split(':').filter(Boolean),right=(sides[1]||'').split(':').filter(Boolean);
  const expanded=sides.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
  return expanded.slice(0,4).map(v=>parseInt(v,16).toString(16)).join(':')+'::/64';
}

export function edgeClientNetwork(req:Request):string {
  // Verified 2026-09-18 on our Supabase ingress: XFF is overwritten, forged CF IP is rejected.
  // This is NOT a generic trust-proxy rule for arbitrary Node deployments.
  if(process.env.API_RUNTIME!=='supabase-edge' || process.env.EDGE_CLIENT_IP_HEADER!=='cf-connecting-ip')throw Error('CLIENT_NETWORK_UNAVAILABLE');
  const cf=req.get('cf-connecting-ip')||'';
  const first=(req.get('x-forwarded-for')||'').split(',')[0]||'';
  const network=normalizedNetwork(cf);
  if(normalizedNetwork(first)!==network)throw Error('CLIENT_NETWORK_UNAVAILABLE');
  const teamIp=req.get('X-Team-Client-IP');
  const path=req.originalUrl.replace(/^\/(?:functions\/v1\/)?waboranggae-api(?=\/)/,'').split('?')[0]!;
  if(teamIp && validTeamWebValidation(req.method,path,req.get('X-Team-Web-Key')||''))return normalizedNetwork(teamIp);
  return network;
}

/** Fixed-window, atomic counters shared by all Edge isolates. Stores HMAC identifiers, never raw IP/email. */
export class PostgresRateStore implements Store {
  localKeys=false;
  prefix:string;
  private pruneAfter=0;
  constructor(private scope:string,private windowMs:number,private cap:number){this.prefix='rl:'+scope+':';}
  async increment(key:string){
    const rows=await prisma.$queryRaw<{count:number;expires_at:Date}[]>`
      INSERT INTO api_quota_buckets (key,count,expires_at)
      VALUES (${this.prefix+key},1,now()+${this.windowMs}*interval '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET
        count=CASE WHEN api_quota_buckets.expires_at<=now() THEN 1 ELSE LEAST(api_quota_buckets.count+1,${this.cap+1}) END,
        expires_at=CASE WHEN api_quota_buckets.expires_at<=now() THEN now()+${this.windowMs}*interval '1 millisecond' ELSE api_quota_buckets.expires_at END
      RETURNING count,expires_at`;
    if(!rows[0])throw Error('REQUEST_LIMIT_STORE_UNAVAILABLE');
    if(Date.now()>this.pruneAfter){
      this.pruneAfter=Date.now()+15*60_000;
      // Delayed until next traffic if idle. Only expired request-limit counters, never daily provider quota.
      await prisma.$executeRaw`DELETE FROM api_quota_buckets WHERE key LIKE 'rl:%' AND expires_at<now()-interval '1 hour'`;
    }
    return{totalHits:rows[0].count,resetTime:new Date(rows[0].expires_at)};
  }
  async decrement(key:string){await prisma.$executeRaw`UPDATE api_quota_buckets SET count=GREATEST(count-1,0) WHERE key=${this.prefix+key} AND expires_at>now()`;}
  async resetKey(key:string){await prisma.$executeRaw`DELETE FROM api_quota_buckets WHERE key=${this.prefix+key}`;}
}

export function sharedRateLimit(scope:string,options:Partial<Options>&{windowMs:number;max:number}) {
  if(process.env.API_RUNTIME!=='supabase-edge')return rateLimit(options);
  const customKey=options.keyGenerator;
  const limiter=rateLimit({...options,store:new PostgresRateStore(scope,options.windowMs,options.max),
    keyGenerator:async(req,res)=>{
      const secret=process.env.JWT_SECRET||'';
      if(secret.length<32)throw Error('REQUEST_LIMIT_STORE_UNAVAILABLE');
      const value=customKey?await customKey(req,res):edgeClientNetwork(req);
      return createHmac('sha256',secret).update('rate-limit:'+scope+':'+value).digest('hex');
    },
  });
  // Fail closed without logging request addresses, tokens or DB connection errors.
  return ((req,res,next)=>limiter(req,res,error=>{
    if(error){res.status(503).set('Retry-After','30').json({error:'요청을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'});return;}
    next();
  })) as typeof limiter;
}
