// Tests only: simulates the persistence/CAS contract without provider accounts.
export function createFlowStoreMock() {
  const rows = new Map<string, { value: any; revision: number; expires: number }>();
  return {
    async prune() { for (const [id, row] of rows) if (row.expires <= Date.now()) rows.delete(id); },
    async create(id: string, value: any, expires: Date) { rows.set(id, { value: structuredClone(value), revision: 0, expires: expires.getTime() }); },
    async get(id: string) { const row = rows.get(id); return row && row.expires > Date.now() ? { value: structuredClone(row.value), revision: row.revision } : null; },
    async update(id: string, revision: number, value: any) {
      const row = rows.get(id); if (!row || row.revision !== revision || row.expires <= Date.now()) return false;
      rows.set(id, { ...row, value: structuredClone(value), revision: revision + 1 }); return true;
    },
    async remove(id: string, revision: number) {
      const row = rows.get(id); if (!row || row.revision !== revision || row.expires <= Date.now()) return false;
      rows.delete(id); return true;
    },
  };
}
