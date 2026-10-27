
import { useEffect, useState } from "react";
import './App.css';

const API_URL = "https://expense-tracker-system-qju2.onrender.com/api/auth";
const TRANSACTION_API_URL =
  "https://expense-tracker-system-qju2.onrender.com/api/transactions";


function DashboardView({ user, onLogout }) {
  const getToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [formType, setFormType] = useState("expense");
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    amount: "",
    transaction_date: getToday(),
    description: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const userId = encodeURIComponent(user.id);

        const [summaryResponse, transactionsResponse] =
          await Promise.all([
            fetch(
              `${TRANSACTION_API_URL}/summary?user_id=${userId}`
            ),
            fetch(
              `${TRANSACTION_API_URL}?user_id=${userId}`
            ),
          ]);

        const summaryData = await summaryResponse.json();
        const transactionData = await transactionsResponse.json();

        if (!summaryResponse.ok) {
          throw new Error(
            summaryData.message || "Failed to load summary."
          );
        }

        if (!transactionsResponse.ok) {
          throw new Error(
            transactionData.message || "Failed to load transactions."
          );
        }

        if (cancelled) return;

        setSummary({
          totalIncome: Number(summaryData.totalIncome) || 0,
          totalExpenses: Number(summaryData.totalExpenses) || 0,
          balance: Number(summaryData.balance) || 0,
        });

        setTransactions(
          Array.isArray(transactionData)
            ? transactionData.slice(0, 5)
            : []
        );
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (user?.id) {
      loadDashboard();
    } else {
      setError("User information is missing. Please log in again.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshKey]);

  const money = (amount) =>
    Number(amount).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });

 
  const openForm = (type) => {
    setEditingTransactionId(null);
    setFormType(type);
    setForm({
      amount: "",
      transaction_date: getToday(),
      description: "",
    });
    setNotice("");
    setError("");
    setShowForm(true);
  };

  const openEditForm = (transaction) => {
    setEditingTransactionId(transaction.id);
    setFormType(transaction.type);
    setForm({
      amount: String(transaction.amount ?? ""),
      transaction_date: String(
        transaction.transaction_date ?? ""
      ).slice(0, 10),
      description: transaction.description || "",
    });
    setNotice("");
    setError("");
    setShowForm(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };
  
  
const handleSaveTransaction = async (event) => {
  event.preventDefault();
  setNotice("");
  setError("");

  const amount = Number(form.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    setError("Please enter an amount greater than zero.");
    return;
  }

  if (!form.transaction_date) {
    setError("Please select a transaction date.");
    return;
  }

  setSaving(true);

  try {
    const isEditing = editingTransactionId !== null;

    const url = isEditing
      ? `${TRANSACTION_API_URL}/${editingTransactionId}?user_id=${encodeURIComponent(user.id)}`
      : TRANSACTION_API_URL;

    const response = await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        type: formType,
        amount,
        transaction_date: form.transaction_date,
        description: form.description.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          (isEditing
            ? "Failed to update transaction."
            : "Failed to save transaction.")
      );
    }

    setShowForm(false);
    setEditingTransactionId(null);
    setForm({
      amount: "",
      transaction_date: getToday(),
      description: "",
    });

    setNotice(
      isEditing
        ? "Transaction updated successfully!"
        : `${formType === "income" ? "Income" : "Expense"} saved successfully!`
    );

    setRefreshKey((previous) => previous + 1);
  } catch (err) {
    setError(err.message || "Unable to save transaction.");
  } finally {
    setSaving(false);
  }
};

  
const handleDeleteTransaction = async (transaction) => {
  const confirmed = window.confirm(
    `Delete "${transaction.description || "Untitled transaction"}" (${money(transaction.amount)})?`
  );

  if (!confirmed) return;

  setNotice("");
  setError("");

  try {
    const response = await fetch(
      `${TRANSACTION_API_URL}/${transaction.id}?user_id=${encodeURIComponent(user.id)}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete transaction.");
    }

    setNotice("Transaction deleted successfully!");
    setRefreshKey((previous) => previous + 1);
  } catch (err) {
    setError(err.message || "Unable to delete transaction.");
  }
};


  const firstName = user.full_name?.split(" ")[0] || "User";

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <a className="dashboard-brand" href="#dashboard">
          <span className="dashboard-brand-icon">₱</span>
          Expense<span>Track</span>
        </a>

        <div className="dashboard-user-actions">
          <span>Welcome, {firstName}!</span>
          <button
            type="button"
            onClick={onLogout}
            className="dashboard-logout"
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-heading">
          <div>
            <span className="dashboard-eyebrow">YOUR FINANCES</span>
            <h1>Dashboard</h1>
            <p>Here's an overview of your financial activity.</p>
          </div>

          <div className="dashboard-date">
            {new Date().toLocaleDateString("en-PH", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        {error && (
          <div className="dashboard-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="transaction-notice" role="status">
            {notice}
          </div>
        )}

        <section className="dashboard-summary">
          <article className="summary-card summary-income">
            <div className="summary-card-top">
              <span>Total Income</span>
              <span className="summary-icon">↗</span>
            </div>
            <h2>{loading ? "Loading..." : money(summary.totalIncome)}</h2>
            <p>All recorded income</p>
          </article>

          <article className="summary-card summary-expenses">
            <div className="summary-card-top">
              <span>Total Expenses</span>
              <span className="summary-icon">↘</span>
            </div>
            <h2>{loading ? "Loading..." : money(summary.totalExpenses)}</h2>
            <p>All recorded expenses</p>
          </article>

          <article className="summary-card summary-balance">
            <div className="summary-card-top">
              <span>Current Balance</span>
              <span className="summary-icon">₱</span>
            </div>
            <h2>{loading ? "Loading..." : money(summary.balance)}</h2>
            <p>Income minus expenses</p>
          </article>
        </section>

        <section className="transaction-actions">
          <div>
            <h2>Manage Transactions</h2>
            <p>Record your income and daily expenses.</p>
          </div>

          <div className="transaction-action-buttons">
            <button
              type="button"
              className="add-income-button"
              onClick={() => openForm("income")}
            >
              + Add Income
            </button>

            <button
              type="button"
              className="add-expense-button"
              onClick={() => openForm("expense")}
            >
              + Add Expense
            </button>
          </div>
        </section>

        {showForm && (
          <section className="transaction-form-panel">
            <h2>
                {editingTransactionId !== null
    ? "Edit Transaction"
    : `Add ${formType === "income" ? "Income" : "Expense"}`}
            </h2>

            <form onSubmit={handleSaveTransaction}>
              <div className="transaction-form-grid">
                <label className="transaction-form-field">
                  Transaction Type
                  <select
                    value={formType}
                    onChange={(event) => setFormType(event.target.value)}
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </label>

                <label className="transaction-form-field">
                  Amount (₱)
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={handleFormChange}
                    placeholder="e.g. 150.00"
                    required
                  />
                </label>

                <label className="transaction-form-field">
                  Date
                  <input
                    type="date"
                    name="transaction_date"
                    value={form.transaction_date}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label className="transaction-form-field">
                  Description
                  <input
                    type="text"
                    name="description"
                    maxLength="255"
                    value={form.description}
                    onChange={handleFormChange}
                    placeholder={
                      formType === "income"
                        ? "e.g. Allowance"
                        : "e.g. Food"
                    }
                  />
                </label>
              </div>

              <div className="transaction-form-buttons">
  <button
    type="button"
    className="cancel-transaction-button"
    onClick={() => {
      setShowForm(false);
      setEditingTransactionId(null);
    }}
    disabled={saving}
  >
    Cancel
  </button>

  <button
    type="submit"
    className="save-transaction-button"
    disabled={saving}
  >
    {saving
      ? "Saving..."
      : editingTransactionId !== null
        ? "Save Changes"
        : "Save Transaction"}
  </button>
</div>
            </form>
          </section>
        )}

        <section className="transactions-panel">
          <div className="transactions-panel-heading">
            <div>
              <h2>Recent Transactions</h2>
              <p>Your latest recorded financial activity</p>
            </div>
            <span className="transaction-count">
              {transactions.length} shown
            </span>
          </div>

          {loading ? (
            <div className="dashboard-empty">Loading transactions...</div>
          ) : error ? (
            <div className="dashboard-empty">
              Transactions could not be loaded.
            </div>
          ) : transactions.length === 0 ? (
            <div className="dashboard-empty">
              <div className="empty-icon">₱</div>
              <h3>No transactions yet</h3>
              <p>
                Use Add Income or Add Expense to record your first transaction.
              </p>
            </div>
          ) : (
            <div className="transactions-table-wrap">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="amount-column">Amount</th>
<th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
  <tr key={transaction.id}>
    {/* Description */}
    <td>
      <div className="transaction-description">
        <span
          className={`transaction-type-icon ${
            transaction.type === "income"
              ? "type-income"
              : "type-expense"
          }`}
        >
          {transaction.type === "income" ? "↗" : "↘"}
        </span>

        <span>
          {transaction.description || "Untitled transaction"}
        </span>
      </div>
    </td>

    {/* Date */}
    <td>
      {transaction.transaction_date
        ? new Date(
            String(transaction.transaction_date).slice(0, 10) +
              "T12:00:00"
          ).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—"}
    </td>

    {/* Type */}
    <td>
      <span
        className={`transaction-type-badge ${
          transaction.type === "income"
            ? "badge-income"
            : "badge-expense"
        }`}
      >
        {transaction.type === "income" ? "Income" : "Expense"}
      </span>
    </td>

    {/* Amount */}
    <td
      className={`amount-column ${
        transaction.type === "income"
          ? "amount-income"
          : "amount-expense"
      }`}
    >
      {transaction.type === "income" ? "+" : "−"}
      {money(transaction.amount)}
    </td>
   
    {/* Actions */}
    <td>
      <div className="transaction-row-actions">
        <button
          type="button"
          className="edit-transaction-button"
          onClick={() => openEditForm(transaction)}
        >
          Edit
        </button>

        <button
          type="button"
          className="delete-transaction-button"
          onClick={() => handleDeleteTransaction(transaction)}
        >
          Delete
        </button>
      </div>
    </td>
  </tr>
))}

                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="dashboard-footer-note">
          ExpenseTrack · Your personal finance overview
        </p>
      </main>
    </div>
  );
}



function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem("expenseTrackUser");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      sessionStorage.removeItem("expenseTrackUser");
      return null;
    }
  });

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthMessage("");
    setMessageType("error");
    setOtpStep(false);
    setOtpEmail("");
    setShowAuth(true);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthMessage("");

    const formData = new FormData(event.currentTarget);

    // Step 2: submit the OTP sent to the user's email.
    if (otpStep) {
      const otp = String(formData.get("otp") || "").trim();
      if (!/^\d{6}$/.test(otp)) {
        setMessageType("error");
        setAuthMessage("Please enter the 6-digit OTP from your email.");
        return;
      }

      await submitAuth("/verify-otp", { email: otpEmail, otp });
      return;
    }

    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (authMode === "register") {
      const full_name = String(formData.get("full_name") || "").trim();
      const confirmPassword = String(
        formData.get("confirmPassword") || ""
      );

      if (password.length < 8) {
        setMessageType("error");
        setAuthMessage("Password must be at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setMessageType("error");
        setAuthMessage("Passwords do not match.");
        return;
      }

      setOtpEmail(email);
      await submitAuth("/register", {
        full_name,
        email,
        password,
      });
    } else {
      await submitAuth("/login", {
        email,
        password,
      });
    }
  };

  const submitAuth = async (endpoint, payload) => {
    setLoading(true);
    setAuthMessage("");

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessageType("error");
        setAuthMessage(data.message || "Something went wrong.");
        return;
      }

      if (endpoint === "/register") {
        setOtpStep(true);
        setMessageType("success");
        setAuthMessage(
          `We sent a 6-digit verification code to ${otpEmail || payload.email}. Check your inbox and spam folder.`
        );
        return;
      }

      if (endpoint === "/verify-otp") {
        setOtpStep(false);
        setAuthMode("login");
        setMessageType("success");
        setAuthMessage("Email verified and account created! You can now log in.");
        return;
      }

      if (!data.token || !data.user || !data.user.id) {
        setMessageType("error");
        setAuthMessage(
          "Login response is missing user information or a token. Please check your backend login route."
        );
        return;
      }

      sessionStorage.setItem("expenseTrackToken", data.token);
      sessionStorage.setItem(
        "expenseTrackUser",
        JSON.stringify(data.user)
      );

      setCurrentUser(data.user);
      setShowAuth(false);
      setAuthMessage("");
    } catch (error) {
      console.error("Authentication error:", error);
      setMessageType("error");
      setAuthMessage(
        "Cannot connect to the ExpenseTrack server. Please try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("expenseTrackToken");
    sessionStorage.removeItem("expenseTrackUser");
    setCurrentUser(null);
    setAuthMessage("");
    setShowAuth(false);
    setAuthMode("login");
    setOtpStep(false);
    setOtpEmail("");
  };

  // Show the dashboard after successful login.
  if (currentUser) {
    return (
      <DashboardView
        user={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // Show the landing page when the user is logged out.
  return (
    <div className="app">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-icon">₱</div>
            <span>
              Expense<span>Track</span>
            </span>
          </div>

          <nav className="nav-links">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="login-nav-btn"
              onClick={() => openAuth("login")}
            >
              Log In
            </button>

            <button
              type="button"
              className="signup-nav-btn"
              onClick={() => openAuth("register")}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              ✦ Smart Financial Management
            </div>

            <h1>
              Take Control of
              <br />
              Your <span>Finances.</span>
            </h1>

            <p>
              Track your income, manage expenses, set budgets,
              and understand your spending habits—all in one
              simple and organized platform.
            </p>

            <div className="hero-buttons">
              <button
                type="button"
                className="primary-btn"
                onClick={() => openAuth("register")}
              >
                Get Started <span>→</span>
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={() => openAuth("login")}
              >
                Log In
              </button>
            </div>

            <div className="hero-note">
              ✓ Simple &nbsp;•&nbsp; Secure &nbsp;•&nbsp; Easy to Use
            </div>
          </div>

          {/* DASHBOARD PREVIEW */}
          <div className="hero-preview">
            <div className="preview-window">
              <div className="preview-top">
                <div className="preview-brand">
                  <div className="mini-logo">₱</div>
                  ExpenseTrack
                </div>

                <div className="preview-avatar">JD</div>
              </div>

              <div className="preview-body">
                <div className="preview-heading">
                  <div>
                    <small>Welcome back,</small>
                    <strong>Juan!</strong>
                  </div>

                  <div className="preview-date">October 2026</div>
                </div>

                <div className="preview-cards">
                  <div className="preview-card income-card">
                    <div className="card-label">Income</div>
                    <div className="card-value">₱45,000</div>
                    <div className="card-change">↑ 12.5%</div>
                  </div>

                  <div className="preview-card expense-card">
                    <div className="card-label">Expenses</div>
                    <div className="card-value">₱18,450</div>
                    <div className="card-change">↓ 4.2%</div>
                  </div>

                  <div className="preview-card balance-card">
                    <div className="card-label">Balance</div>
                    <div className="card-value">₱26,550</div>
                    <div className="card-change">Available</div>
                  </div>
                </div>

                <div className="preview-chart">
                  <div className="chart-header">
                    <strong>Monthly Overview</strong>
                    <span>Last 6 months</span>
                  </div>

                  <div className="chart">
                    <div className="chart-bars">
                      <div className="bar" style={{ height: "45%" }} />
                      <div className="bar" style={{ height: "65%" }} />
                      <div className="bar" style={{ height: "52%" }} />
                      <div className="bar" style={{ height: "80%" }} />
                      <div className="bar" style={{ height: "62%" }} />
                      <div className="bar active" style={{ height: "90%" }} />
                    </div>

                    <div className="chart-labels">
                      <span>May</span>
                      <span>Jun</span>
                      <span>Jul</span>
                      <span>Aug</span>
                      <span>Sep</span>
                      <span>Oct</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-card floating-income">
              <span>↑</span>
              <div>
                <small>Income</small>
                <strong>+₱8,500</strong>
              </div>
            </div>

            <div className="floating-card floating-expense">
              <span>↓</span>
              <div>
                <small>Expense</small>
                <strong>-₱2,350</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
        <div className="section-container">
          <div className="section-heading">
            <div className="section-tag">FEATURES</div>

            <h2>
              Everything You Need to
              <span> Manage Your Money</span>
            </h2>

            <p>
              Keep your finances organized and make better
              financial decisions with simple tools.
            </p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon income-icon">↗</div>
              <h3>Income &amp; Expense Tracking</h3>
              <p>
                Easily record your daily income and expenses
                with categories, dates, amounts, and descriptions.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon budget-icon">₱</div>
              <h3>Budget Monitoring</h3>
              <p>
                Set monthly spending limits and monitor your
                progress before you exceed your budget.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon report-icon">▥</div>
              <h3>Financial Reports</h3>
              <p>
                Understand your spending patterns through
                organized summaries and visual reports.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon secure-icon">✓</div>
              <h3>Secure Records</h3>
              <p>
                Keep your financial information protected with
                secure authentication and account management.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="about-section" id="about">
        <div className="about-container">
          <div className="about-content">
            <div className="section-tag">ABOUT EXPENSETRACK</div>

            <h2>
              Make Every Peso
              <span> Count.</span>
            </h2>

            <p>
              ExpenseTrack is a web-based financial management
              system designed to help users organize their income
              and expenses in one convenient place.
            </p>

            <p>
              Instead of relying on notebooks or scattered records,
              ExpenseTrack provides a simple dashboard where you
              can monitor your financial activity and stay within
              your budget.
            </p>

            <div className="about-points">
              <div>✓ Easy transaction management</div>
              <div>✓ Clear financial summaries</div>
              <div>✓ Budget awareness</div>
            </div>
          </div>

          <div className="about-visual">
            <div className="money-circle">
              <div className="money-symbol">₱</div>
            </div>

            <div className="about-stat stat-one">
              <strong>100%</strong>
              <span>Organized</span>
            </div>

            <div className="about-stat stat-two">
              <strong>24/7</strong>
              <span>Accessible</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-container">
          <div>
            <h2>Ready to Take Control?</h2>
            <p>Start organizing your finances today.</p>
          </div>

          <button
            type="button"
            className="cta-button"
            onClick={() => openAuth("register")}
          >
            Create Free Account →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon">₱</div>
              <span>
                Expense<span>Track</span>
              </span>
            </div>

            <p>
              Simple financial management for everyday life.
            </p>
          </div>

          <div className="footer-links">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
          </div>
        </div>

        <div className="footer-bottom">
          © 2026 ExpenseTrack. All rights reserved.
        </div>
      </footer>

      {/* LOGIN / REGISTER MODAL */}
      {showAuth && (
        <div
          className="auth-overlay"
          onClick={() => {
            if (!loading) setShowAuth(false);
          }}
        >
          <div
            className="auth-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close-btn"
              onClick={() => {
                if (!loading) {
                  setShowAuth(false);
                  setOtpStep(false);
                }
              }}
              disabled={loading}
              aria-label="Close"
            >
              ×
            </button>

            <div className="auth-logo">
              <div className="logo-icon">₱</div>
              <span>
                Expense<span>Track</span>
              </span>
            </div>

            <h2>
              {otpStep
                ? "Verify Your Email"
                : authMode === "login"
                  ? "Welcome Back"
                  : "Create Your Account"}
            </h2>

            <p className="auth-subtitle">
              {otpStep
                ? `Enter the 6-digit code sent to ${otpEmail}.`
                : authMode === "login"
                  ? "Sign in to manage your finances."
                  : "Start managing your finances today."}
            </p>

            {authMessage && (
              <div
                role="alert"
                style={{
                  padding: "10px 12px",
                  marginBottom: "14px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color:
                    messageType === "success" ? "#166534" : "#b91c1c",
                  background:
                    messageType === "success" ? "#dcfce7" : "#fee2e2",
                }}
              >
                {authMessage}
              </div>
            )}

            <form onSubmit={handleAuth}>
              {otpStep ? (
                <>
                  <label htmlFor="verification-otp">Email Verification Code</label>
                  <input
                    id="verification-otp"
                    type="text"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    aria-label="6-digit email verification code"
                    required
                    autoFocus
                  />
                  <p className="auth-subtitle" style={{ marginTop: "8px" }}>
                    The code expires in 5 minutes. If you do not see the email,
                    check your spam folder.
                  </p>
                </>
              ) : (
                <>
                  {authMode === "register" && (
                    <>
                      <label htmlFor="register-full-name">Full Name</label>
                      <input
                        id="register-full-name"
                        type="text"
                        name="full_name"
                        placeholder="Enter your full name"
                        autoComplete="name"
                        required
                      />
                    </>
                  )}

                  <label htmlFor="auth-email">Email Address</label>
                  <input
                    id="auth-email"
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />

                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    name="password"
                    placeholder={
                      authMode === "login"
                        ? "Enter your password"
                        : "Create a password (at least 8 characters)"
                    }
                    autoComplete={
                      authMode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    minLength={authMode === "register" ? 8 : undefined}
                    required
                  />

                  {authMode === "register" && (
                    <>
                      <label htmlFor="confirm-password">
                        Confirm Password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </>
                  )}
                </>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : otpStep
                    ? "Verify Email"
                    : authMode === "login"
                      ? "Log In"
                      : "Send Verification Code"}
              </button>
            </form>

            {!otpStep && (
              <p className="switch-auth">
                {authMode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setAuthMode(
                      authMode === "login" ? "register" : "login"
                    );
                    setAuthMessage("");
                    setMessageType("error");
                  }}
                >
                  {authMode === "login" ? "Create one" : "Log in"}
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
