require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// API home
app.get('/', (req, res) => {
    res.json({
        message: 'Expense Tracker System API is running!'
    });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            message: 'Database connection is working!'
        });
    } catch (error) {
        console.error('Database test failed:', error.message);

        res.status(500).json({
            message: 'Database connection failed.'
        });
    }
});

// Authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

// Transaction routes
app.use('/api/transactions', transactionRoutes);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});