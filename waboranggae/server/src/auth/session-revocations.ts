import { createHash } from 'node:crypto';
import { prisma } from '../db/client';

function hashSession(id:string) {
  if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid session identifier');
  return createHash('sha256').update('waboranggae-session-v1:'+id).digest('hex');
}
export async function isSessionRevoked(id:string|undefined) {
  if(id===undefined)return false; // Legacy clients upgrade on their next refresh.
  const hash=hashSession(id);
  const rows=await prisma.$queryRaw<Array<{session_hash:string}>>`SELECT session_hash FROM auth_revocations WHERE session_hash=${hash} AND expires_at > now()`;
  return rows.length>0;
}
export async function revokeSession(id:string) {
  const hash=hashSession(id);
  // Covers every existing 7-day refresh token and 15-minute access token for this session.
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`DELETE FROM auth_revocations WHERE expires_at <= now()`;
    await tx.$executeRaw`INSERT INTO auth_revocations(session_hash,expires_at) VALUES(${hash},now()+interval '7 days 1 hour') ON CONFLICT(session_hash) DO UPDATE SET expires_at=GREATEST(auth_revocations.expires_at,EXCLUDED.expires_at)`;
  });
}

