// Build-time replacement for server/src/db/client.ts. Same Prisma query contract,
// but a JS driver + query compiler instead of an OS-specific Rust engine.
import { PrismaClient } from './generated/wasm';
import { PrismaPg } from '@prisma/adapter-pg';

const url = new URL(process.env.DATABASE_URL || '');
const tlsRequired = process.env.NODE_ENV === 'production' || url.hostname !== '127.0.0.1';
const ca = process.env.DB_CA_CERT_BASE64 ? Buffer.from(process.env.DB_CA_CERT_BASE64,'base64').toString('utf8') : undefined;
url.search = '';
const adapter = new PrismaPg({
  connectionString:url.toString(), max:2, idleTimeoutMillis:10000, connectionTimeoutMillis:10000,
  statement_timeout:20000, query_timeout:22000,
  ssl:tlsRequired ? {rejectUnauthorized:true,...(ca?{ca}:{})} : false,
  application_name:'waboranggae-edge',
});
export const prisma = new PrismaClient({adapter,log:[]});
export default prisma;
