#!/usr/bin/env node
'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createPool } = require('../db');
const { runMigrations } = require('../migrate');

async function main() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Refusing to run migrations unless NODE_ENV=development.');
  if (process.env.MYSQL_DATABASE !== 'doctors_appointment_db') throw new Error('Refusing to run migrations: MYSQL_DATABASE must be doctors_appointment_db.');
  const pool = createPool();
  try {
    const [rows] = await pool.execute('SELECT DATABASE() AS database_name');
    if (rows[0]?.database_name !== 'doctors_appointment_db') throw new Error('Connected database did not match the expected local test database.');
    await runMigrations(pool);
    console.log('Development database migrations are up to date.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Development migration check stopped safely: ${error.message}`);
  process.exitCode = 1;
});
