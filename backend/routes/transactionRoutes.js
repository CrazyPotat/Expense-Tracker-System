const express = require('express');
const router = express.Router();
const db = require('../db');

function getUserId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// GET: List transactions
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req.query.user_id);

        if (!userId) {
            return res.status(400).json({
                message: 'A valid user_id is required.'
            });
        }

        const [rows] = await db.execute(
            `SELECT id, type, amount, transaction_date,
                    description, category_id
             FROM transactions
             WHERE user_id = ?
             ORDER BY transaction_date DESC, id DESC`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Fetch transactions error:', error.message);
        res.status(500).json({
            message: 'Failed to fetch transactions.'
        });
    }
});

// GET: Income, expenses, and balance
router.get('/summary', async (req, res) => {
    try {
        const userId = getUserId(req.query.user_id);

        if (!userId) {
            return res.status(400).json({
                message: 'A valid user_id is required.'
            });
        }

        const [rows] = await db.execute(
            `SELECT
                COALESCE(SUM(
                    CASE WHEN type = 'income'
                    THEN amount ELSE 0 END
                ), 0) AS totalIncome,
                COALESCE(SUM(
                    CASE WHEN type = 'expense'
                    THEN amount ELSE 0 END
                ), 0) AS totalExpenses
             FROM transactions
             WHERE user_id = ?`,
            [userId]
        );

        const totalIncome = Number(rows[0].totalIncome);
        const totalExpenses = Number(rows[0].totalExpenses);

        res.json({
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses
        });
    } catch (error) {
        console.error('Summary error:', error.message);
        res.status(500).json({
            message: 'Failed to load financial summary.'
        });
    }
});

// POST: Add income or expense
router.post('/', async (req, res) => {
    try {
        const userId = getUserId(req.body.user_id);
        const type = String(req.body.type || '').toLowerCase();
        const amount = Number(req.body.amount);
        const date = String(req.body.transaction_date || '');
        const description = String(req.body.description || '').trim();

        if (!userId) {
            return res.status(400).json({
                message: 'A valid user_id is required.'
            });
        }

        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({
                message: 'Choose income or expense.'
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                message: 'Amount must be greater than zero.'
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(Date.parse(date + 'T00:00:00Z'))) {
            return res.status(400).json({
                message: 'Enter a valid date.'
            });
        }

        if (description.length > 255) {
            return res.status(400).json({
                message: 'Description must not exceed 255 characters.'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO transactions
                (user_id, category_id, type, amount,
                 transaction_date, description)
             VALUES (?, NULL, ?, ?, ?, ?)`,
            [
                userId,
                type,
                amount.toFixed(2),
                date,
                description || null
            ]
        );

        res.status(201).json({
            message: 'Transaction saved successfully!',
            id: result.insertId
        });
    } catch (error) {
        console.error('Add transaction error:', error.message);
        res.status(500).json({
            message: 'Failed to save transaction.'
        });
    }
});

// DELETE: Delete one of the current user's transactions
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserId(req.query.user_id);
        const transactionId = Number(req.params.id);

        if (!userId ||
            !Number.isInteger(transactionId) ||
            transactionId < 1) {
            return res.status(400).json({
                message: 'Valid user and transaction IDs are required.'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM transactions WHERE id = ? AND user_id = ?',
            [transactionId, userId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: 'Transaction not found.'
            });
        }

        res.json({
            message: 'Transaction deleted successfully.'
        });
    } catch (error) {
        console.error('Delete transaction error:', error.message);
        res.status(500).json({
            message: 'Failed to delete transaction.'
        });
    }
});

module.exports = router;