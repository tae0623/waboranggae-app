import { readFile, readdir } from 'node:fs/promises';

const prismaRoot = new URL('../prisma/', import.meta.url);
const schema = await readFile(new URL('schema.prisma', prismaRoot), 'utf8');
const migrationEntries = (await readdir(new URL('migrations/', prismaRoot), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!migrationEntries.length) throw new Error('Prisma 마이그레이션 폴더가 없습니다.');

const latestMigration = migrationEntries.at(-1);
const sql = await readFile(new URL(`migrations/${latestMigration}/migration.sql`, prismaRoot), 'utf8');

const expectations = [
  ['schema User model', /model\s+User\s*\{/],
  ['schema Bookmark model', /model\s+Bookmark\s*\{/],
  ['schema SearchHistory model', /model\s+SearchHistory\s*\{/],
  ['users table', /CREATE TABLE "users"/],
  ['bookmarks table', /CREATE TABLE "bookmarks"/],
  ['search_history table', /CREATE TABLE "search_history"/],
  ['users email unique index', /CREATE UNIQUE INDEX "users_email_key"/],
  ['bookmark unique constraint', /CREATE UNIQUE INDEX "bookmarks_userId_courseId_key"/],
  ['bookmark user foreign key', /ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey"/],
  ['history user foreign key', /ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey"/],
];

const failed = expectations.filter(([label, pattern]) => {
  const target = String(label).startsWith('schema ') ? schema : sql;
  return !pattern.test(target);
});

if (failed.length) {
  throw new Error(`마이그레이션 파일 검증 실패: ${failed.map(([label]) => label).join(', ')}`);
}

console.log(JSON.stringify({
  ok: true,
  latestMigration,
  models: ['User', 'Bookmark', 'SearchHistory'],
  tables: ['users', 'bookmarks', 'search_history'],
  checks: expectations.length,
}, null, 2));
