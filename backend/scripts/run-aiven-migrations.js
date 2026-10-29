
'use strict';

const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
});

const { createPool } = require('../db');
const { runMigrations } = require('../migrate');

async function main() {
  if (
    process.env.MYSQL_HOST !==
    'doctor-appointment-db-devaharsha119-cfe2.a.aivencloud.com'
  ) {
    throw new Error(
      'Refusing to migrate: MYSQL_HOST is not the expected Aiven host.'
    );
  }

  if (process.env.MYSQL_DATABASE !== 'defaultdb') {
    throw new Error(
      'Refusing to migrate: MYSQL_DATABASE must be defaultdb.'
    );
  }

  if (!process.env.MYSQL_SSL_CA) {
    throw new Error(
      'Refusing to migrate: MYSQL_SSL_CA must be configured.'
    );
  }

  const pool = createPool();

  try {
    const [rows] = await pool.query(
      'SELECT DATABASE() AS database_name, VERSION() AS server_version'
    );

    if (rows[0]?.database_name !== 'defaultdb') {
      throw new Error('Connected database does not match defaultdb.');
    }

    console.log('Connected to Aiven MySQL:', rows[0]);

    await runMigrations(pool);

    const [tables] = await pool.query('SHOW TABLES');

    console.log(`Migration check complete. Tables found: ${tables.length}`);
    console.log('Aiven database migrations are up to date.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Aiven migration stopped: ${error.message}`);
  process.exitCode = 1;
});

