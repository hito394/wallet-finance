import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-grid">
      <section className="panel hero-card">
        <span className="eyebrow">Automation-first finance workspace</span>
        <h1>Manage cashflow, documents, and insights in one product.</h1>
        <p>
          AI Finance Assistant turns uploads and transaction data into actionable dashboards, review queues, and
          export-ready reports.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn primary">
            Get Started
          </Link>
          <Link href="/settings" className="btn secondary">
            Log In
          </Link>
        </div>
      </section>

      <section className="panel feature-card">
        <h2>Product sections</h2>
        <div className="feature-grid">
          <Link href="/dashboard" className="feature-link">
            <strong>Dashboard</strong>
            <p>KPIs, alerts, and overview trends.</p>
          </Link>
          <Link href="/transactions" className="feature-link">
            <strong>Transactions</strong>
            <p>Search and inspect ledger activity.</p>
          </Link>
          <Link href="/documents" className="feature-link">
            <strong>Documents</strong>
            <p>Upload and track statement/receipt intelligence.</p>
          </Link>
          <Link href="/reports" className="feature-link">
            <strong>Reports</strong>
            <p>Monthly summaries and CSV exports.</p>
          </Link>
          <Link href="/chatbot" className="feature-link">
            <strong>Chatbot</strong>
            <p>AI assistant workflow for finance Q&A.</p>
          </Link>
          <Link href="/review" className="feature-link">
            <strong>Review Queue</strong>
            <p>Resolve low-confidence or conflicting items.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
