const mysql = require('mysql2/promise');

function createPool() {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) throw new Error('MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE are required');
  if (!/^[A-Za-z0-9_]+$/.test(MYSQL_DATABASE)) throw new Error('MYSQL_DATABASE may contain only letters, digits, and underscores');
  return mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD || '',
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE) || 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    decimalNumbers: true,
  });
}

module.exports = { createPool };
