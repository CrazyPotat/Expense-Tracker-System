
require('dotenv').config();

const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection()
    .then((connection) => {
        console.log('MySQL database connected successfully!');
        connection.release();
    })
    .catch((err) => {
        console.error('MySQL connection failed:', err.message);
    });

module.exports = db;
