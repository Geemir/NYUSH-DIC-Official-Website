/*
 * The API talks to SQLite through four async calls, modelled on Cloudflare D1:
 *
 *   all(sql, ...params)  → array of rows
 *   get(sql, ...params)  → first row, or null
 *   run(sql, ...params)  → { changes, lastId }
 *   batch([[sql, ...params], ...])  → runs them all in one transaction
 *
 * Three adapters below turn a real database into that shape: Cloudflare D1
 * (production on Workers), node:sqlite (the Node server and the tests) and
 * sql.js (preview mode, in the browser).
 */

/* SQLite takes numbers, strings, null and blobs. */
function norm(params) {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
}

/* Cloudflare D1 binding (env.DB). */
export function fromD1(d1) {
  const stmt = (sql, params) => d1.prepare(sql).bind(...norm(params));
  return {
    async all(sql, ...params) {
      const r = await stmt(sql, params).all();
      return r.results || [];
    },
    async get(sql, ...params) {
      return (await stmt(sql, params).first()) ?? null;
    },
    async run(sql, ...params) {
      const r = await stmt(sql, params).run();
      return { changes: r.meta.changes, lastId: r.meta.last_row_id };
    },
    async batch(list) {
      await d1.batch(list.map(([sql, ...params]) => stmt(sql, params)));
    },
    async exec(sql) {
      await d1.exec(sql);
    },
  };
}

/* node:sqlite DatabaseSync (and anything with the same prepare() shape). */
export function fromNodeSqlite(db) {
  return {
    async all(sql, ...params) {
      return db.prepare(sql).all(...norm(params));
    },
    async get(sql, ...params) {
      return db.prepare(sql).get(...norm(params)) ?? null;
    },
    async run(sql, ...params) {
      const r = db.prepare(sql).run(...norm(params));
      return { changes: r.changes, lastId: Number(r.lastInsertRowid) };
    },
    async batch(list) {
      db.exec("BEGIN");
      try {
        for (const [sql, ...params] of list) db.prepare(sql).run(...norm(params));
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    async exec(sql) {
      db.exec(sql);
    },
  };
}

/* sql.js Database (preview mode). onWrite is called after every change, so
   the page can save the database to the browser's storage. */
export function fromSqlJs(db, onWrite = () => {}) {
  const rows = (sql, params) => {
    const st = db.prepare(sql);
    try {
      st.bind(norm(params));
      const out = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally {
      st.free();
    }
  };
  const lastId = () => db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  return {
    async all(sql, ...params) {
      return rows(sql, params);
    },
    async get(sql, ...params) {
      return rows(sql, params)[0] ?? null;
    },
    async run(sql, ...params) {
      db.run(sql, norm(params));
      const r = { changes: db.getRowsModified(), lastId: lastId() };
      onWrite();
      return r;
    },
    async batch(list) {
      db.exec("BEGIN");
      try {
        for (const [sql, ...params] of list) db.run(sql, norm(params));
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      onWrite();
    },
    async exec(sql) {
      db.exec(sql);
      onWrite();
    },
  };
}
