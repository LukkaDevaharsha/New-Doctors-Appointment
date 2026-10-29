const fs = require('node:fs/promises');
const path = require('node:path');

async function runMigrations(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file)).sort();
  for (const file of files) {
    const [[existing]] = await pool.query('SELECT version FROM schema_migrations WHERE version = ?', [file]);
    if (existing) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await pool.query(statement);
    await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
  }
}

module.exports = { runMigrations };
