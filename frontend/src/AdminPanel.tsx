import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState<any>(null);
  const [section, setSection] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Data
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [totalBiz, setTotalBiz] = useState(0);
  const [selectedBiz, setSelectedBiz] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [revenueByTier, setRevenueByTier] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // Search/filter
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("DESC");

  const adminToken = () => localStorage.getItem("admin_token");

  const fetchWithAuth = async (url: string, opts?: any) => {
    const t = adminToken();
    if (!t) { setLoggedIn(false); return null; }
    try {
      const res = await fetch(url, { ...opts, headers: { ...opts?.headers, Authorization: `Bearer ${t}` } });
      if (res.status === 401) { setLoggedIn(false); localStorage.removeItem("admin_token"); return null; }
      return await res.json();
    } catch { return null; }
  };

  // Check existing admin login
  useEffect(() => {
    const t = adminToken();
    if (t) {
      fetchWithAuth("/api/admin/me").then(d => { if (d?.email) { setAdmin(d); setLoggedIn(true); } else setLoading(false); });
    } else setLoading(false);
  }, []);

  // Load data when logged in
  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);
    Promise.all([
      fetchWithAuth(`/api/admin/businesses?limit=${pageSize}&offset=${page * pageSize}&sort=${sortField}&order=${sortOrder}${planFilter ? `&plan=${planFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`),
      fetchWithAuth("/api/admin/revenue/overview"),
      fetchWithAuth("/api/admin/revenue/by-tier"),
      fetchWithAuth("/api/admin/revenue/transactions"),
      fetchWithAuth("/api/admin/tickets"),
      fetchWithAuth("/api/admin/stats")
    ]).then(([biz, rev, tier, txns, tix, st]) => {
      if (biz) { setBusinesses(biz.businesses || biz); setTotalBiz(biz.total || (biz.businesses || biz).length); }
      if (rev) setRevenue(rev);
      if (tier) setRevenueByTier(tier);
      if (txns) setTransactions(txns);
      if (tix) setTickets(tix);
      if (st) setStats(st);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [loggedIn, page, sortField, sortOrder, planFilter, statusFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Login failed"); return; }
      localStorage.setItem("admin_token", data.token);
      setAdmin(data.admin);
      setLoggedIn(true);
    } catch { setLoginError("Connection failed"); }
  };

  const handleLogout = () => { localStorage.removeItem("admin_token"); setLoggedIn(false); setAdmin(null); };

  const loadBusinessDetail = async (id: string) => {
    const d = await fetchWithAuth(`/api/admin/businesses/${id}`);
    if (d) setSelectedBiz(d);
  };

  const updateBusinessPlan = async (id: string, plan: string) => {
    await fetchWithAuth(`/api/admin/businesses/${id}/plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    loadBusinessDetail(id);
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, tier: plan } : b));
  };

  const updateBusinessStatus = async (id: string, status: string) => {
    await fetchWithAuth(`/api/admin/businesses/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    loadBusinessDetail(id);
  };

  const deleteBusiness = async (id: string) => {
    if (!confirm("Delete this business permanently?")) return;
    await fetchWithAuth(`/api/admin/businesses/${id}`, { method: "DELETE" });
    setSelectedBiz(null);
    setBusinesses(prev => prev.filter(b => b.id !== id));
  };

  const updateTicketStatus = async (id: string, status: string) => {
    await fetchWithAuth(`/api/admin/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (selectedTicket?.id === id) setSelectedTicket({ ...selectedTicket, status });
  };

  const replyToTicket = async (id: string, message: string) => {
    if (!message.trim()) return;
    await fetchWithAuth(`/api/admin/tickets/${id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    // Refresh ticket detail
    const d = await fetchWithAuth(`/api/admin/tickets/${id}`);
    if (d) setSelectedTicket(d);
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-800/50 border border-slate-800 rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <span className="text-3xl block">🔐</span>
            <h1 className="text-2xl font-black text-white">Admin Login</h1>
            <p className="text-sm text-slate-400">GrowLocal AI Administration</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Email</label>
              <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@growlocal.ai" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Password</label>
              <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            {loginError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">{loginError}</div>}
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg transition text-sm">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;

  const sections = [
    { id: "overview", label: "📊 Overview" },
    { id: "businesses", label: "🏢 Businesses", count: totalBiz },
    { id: "revenue", label: "💰 Revenue" },
    { id: "tickets", label: "🎫 Tickets", count: tickets.filter(t => t.status !== "closed").length },
  ];

  const prices: Record<string, number> = { Starter: 149.99, Pro: 499.99, Premium: 999.99 };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-56 bg-slate-950 border-r border-slate-800 shrink-0 flex flex-col justify-between">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-lg font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">GrowLocal</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Admin</span>
          </div>
          <nav className="space-y-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => { setSection(s.id); setSelectedBiz(null); setSelectedTicket(null); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-between ${section === s.id ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}>
                <span>{s.label}</span>
                {s.count !== undefined && <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">{s.count}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs text-slate-400 truncate">{admin?.name} • {admin?.email}</div>
          <button onClick={handleLogout} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-1.5 rounded-lg transition">Sign Out</button>
          <button onClick={() => navigate("/dashboard")} className="w-full text-xs text-slate-500 hover:text-white transition">← Back to Dashboard</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">

        {/* OVERVIEW */}
        {section === "overview" && (
          <>
            <h1 className="text-2xl font-black text-white">Admin Overview</h1>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total MRR</div>
                <div className="text-2xl font-black text-white">${revenue?.total_mrr?.toFixed(2) || "0.00"}</div>
                <div className="text-xs text-green-400">From {revenue?.active_subscriptions || 0} active subs</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase font-semibold">Active Businesses</div>
                <div className="text-2xl font-black text-white">{stats?.active_businesses || 0}</div>
                <div className="text-xs text-slate-400">{stats?.total_businesses || 0} total registered</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase font-semibold">Avg Revenue / User</div>
                <div className="text-2xl font-black text-white">${stats?.avg_revenue_per_user?.toFixed(2) || "0.00"}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Posts</div>
                <div className="text-2xl font-black text-white">{stats?.total_posts || 0}</div>
                <div className="text-xs text-slate-400">{stats?.total_bookings || 0} bookings • {stats?.total_reviews || 0} reviews</div>
              </div>
            </div>

            {/* Revenue by Tier */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Revenue by Tier</h3>
              <div className="space-y-3">
                {["Starter", "Pro", "Premium"].map(tier => {
                  const t = revenueByTier?.find((r: any) => r.tier === tier);
                  const count = t?.count || 0;
                  const rev = t?.revenue || 0;
                  const pct = revenue?.total_mrr > 0 ? ((rev / revenue.total_mrr) * 100).toFixed(1) : "0";
                  return (
                    <div key={tier} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${tier === "Premium" ? "bg-purple-500" : tier === "Pro" ? "bg-blue-500" : "bg-slate-500"}`} />
                        <span className="text-sm font-semibold text-white">{tier}</span>
                        <span className="text-xs text-slate-400">({count} subs)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">${rev.toFixed(2)}</div>
                        <div className="text-xs text-slate-400">{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Open Tickets", value: tickets.filter(t => t.status !== "closed").length, color: "text-yellow-400" },
                { label: "Businesses on Starter", value: businesses.filter(b => b.tier === "Starter").length, color: "text-slate-400" },
                { label: "Businesses on Pro", value: businesses.filter(b => b.tier === "Pro").length, color: "text-blue-400" },
                { label: "Businesses on Premium", value: businesses.filter(b => b.tier === "Premium").length, color: "text-purple-400" },
              ].map(s => (
                <div key={s.label} className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 text-center">
                  <div className="text-xs text-slate-400">{s.label}</div>
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* BUSINESSES */}
        {section === "businesses" && !selectedBiz && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-2xl font-black text-white">Businesses ({totalBiz})</h1>
              <div className="flex gap-2 flex-wrap">
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white w-32" />
                <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0); }} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="">All Plans</option>
                  <option value="Starter">Starter</option>
                  <option value="Pro">Pro</option>
                  <option value="Premium">Premium</option>
                </select>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
            </div>
            <div className="bg-slate-800/30 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  {["Name", "Owner", "Plan", "Status", "Posts", "Reviews", "Bookings", "MRR", "Joined"].map(h => (
                    <th key={h} className="text-left p-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {businesses.filter(b => !searchTerm || b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.user_name?.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                    <tr key={b.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 cursor-pointer" onClick={() => loadBusinessDetail(b.id)}>
                      <td className="p-3 font-semibold text-white whitespace-nowrap">{b.name}</td>
                      <td className="p-3 text-slate-300">{b.user_name || "—"}</td>
                      <td className="p-3"><span className={`text-xs font-bold px-2 py-1 rounded ${b.tier === "Premium" ? "bg-purple-500/20 text-purple-400" : b.tier === "Pro" ? "bg-blue-500/20 text-blue-400" : "bg-slate-500/20 text-slate-400"}`}>{b.tier}</span></td>
                      <td className="p-3"><span className={`text-xs font-semibold ${!b.stripe_subscription_status || b.stripe_subscription_status === "active" ? "text-green-400" : b.stripe_subscription_status === "past_due" ? "text-yellow-400" : "text-red-400"}`}>{b.stripe_subscription_status || "active"}</span></td>
                      <td className="p-3 text-center text-slate-300">{b.post_count || 0}</td>
                      <td className="p-3 text-center text-slate-300">{b.review_count || 0}</td>
                      <td className="p-3 text-center text-slate-300">{b.booking_count || 0}</td>
                      <td className="p-3 text-right font-semibold text-white">${(prices[b.tier] || 0).toFixed(2)}</td>
                      <td className="p-3 text-slate-400 text-xs">{b.created_at?.split("T")[0] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalBiz > pageSize && (
              <div className="flex justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1 rounded disabled:opacity-30">← Prev</button>
                <span className="text-xs text-slate-400 py-1">Page {page + 1} of {Math.ceil(totalBiz / pageSize)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalBiz} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1 rounded disabled:opacity-30">Next →</button>
              </div>
            )}
          </>
        )}

        {/* BUSINESS DETAIL */}
        {selectedBiz && (
          <div className="space-y-6">
            <button onClick={() => setSelectedBiz(null)} className="text-sm text-purple-400 hover:text-purple-300 transition">← Back to businesses</button>
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedBiz.name}</h2>
                  <p className="text-sm text-slate-400">{selectedBiz.category} • {selectedBiz.user?.email}</p>
                  {selectedBiz.phone && <p className="text-xs text-slate-500">{selectedBiz.phone} • {selectedBiz.address}</p>}
                </div>
                <div className="flex gap-2 items-center">
                  <select value={selectedBiz.tier} onChange={e => updateBusinessPlan(selectedBiz.id, e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2 py-1.5 text-white">
                    <option value="Starter">Starter</option>
                    <option value="Pro">Pro</option>
                    <option value="Premium">Premium</option>
                  </select>
                  <select value={selectedBiz.stripe_subscription_status || "active"} onChange={e => updateBusinessStatus(selectedBiz.id, e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2 py-1.5 text-white">
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                  <button onClick={() => deleteBusiness(selectedBiz.id)} className="bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition">Delete</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Posts</div>
                  <div className="text-2xl font-black text-white">{selectedBiz.post_count || 0}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Reviews</div>
                  <div className="text-2xl font-black text-white">{selectedBiz.review_count || 0}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Bookings</div>
                  <div className="text-2xl font-black text-white">{selectedBiz.booking_count || 0}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">MRR</div>
                  <div className="text-2xl font-black text-white">${(prices[selectedBiz.tier] || 0).toFixed(2)}</div>
                </div>
              </div>
              {selectedBiz.social_connections && selectedBiz.social_connections.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Connected Accounts</h4>
                  <div className="flex gap-3 flex-wrap">
                    {selectedBiz.social_connections.map((c: any) => (
                      <span key={c.platform} className={`text-xs px-2.5 py-1 rounded-full ${c.connected ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-slate-500/10 text-slate-400 border border-slate-500/20"}`}>
                        {c.platform}: {c.connected ? "✅ Connected" : "❌ Not connected"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Usage */}
              {selectedBiz.usage && selectedBiz.usage.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Usage This Period</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedBiz.usage.map((u: any) => (
                      <div key={u.feature} className="bg-slate-900/50 p-3 rounded-xl">
                        <div className="text-xs text-slate-400 capitalize">{u.feature}</div>
                        <div className="text-lg font-bold text-white">{u.count_used || 0}/{u.limit_amount === -1 ? "∞" : u.limit_amount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REVENUE */}
        {section === "revenue" && (
          <>
            <h1 className="text-2xl font-black text-white">Revenue & Payments</h1>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400">Total MRR</div>
                <div className="text-2xl font-black text-white">${revenue?.total_mrr?.toFixed(2) || "0.00"}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400">Active Subs</div>
                <div className="text-2xl font-black text-white">{revenue?.active_subscriptions || 0}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400">Monthly Change</div>
                <div className={`text-2xl font-black ${(revenue?.monthly_change || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {revenue?.monthly_change >= 0 ? "+" : ""}{revenue?.monthly_change?.toFixed(1) || "0"}%
                </div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400">Avg MRR/User</div>
                <div className="text-2xl font-black text-white">${(revenue?.total_mrr && revenue?.active_subscriptions ? (revenue.total_mrr / revenue.active_subscriptions).toFixed(2) : "0.00")}</div>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Recent Transactions</h3>
              {(!transactions || transactions.length === 0) ? (
                <p className="text-sm text-slate-400 text-center py-4">No transactions yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                      <th className="text-left p-2">Date</th><th className="text-left p-2">Business</th><th className="text-left p-2">Plan</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th>
                    </tr></thead>
                    <tbody>
                      {transactions.slice(0, 20).map((t: any, i: number) => (
                        <tr key={t.id || i} className="border-b border-slate-800/60">
                          <td className="p-2 text-xs text-slate-400">{t.created_at?.split("T")[0] || "—"}</td>
                          <td className="p-2 text-white font-semibold">{t.business_name || "—"}</td>
                          <td className="p-2"><span className="text-xs font-bold">{t.tier || t.plan || "—"}</span></td>
                          <td className="p-2 text-right font-semibold text-white">${(t.amount || 0).toFixed(2)}</td>
                          <td className="p-2"><span className={`text-xs font-semibold ${t.status === "completed" || t.status === "paid" ? "text-green-400" : "text-yellow-400"}`}>{t.status || "—"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* TICKETS */}
        {section === "tickets" && !selectedTicket && (
          <>
            <h1 className="text-2xl font-black text-white">Support Tickets</h1>
            {tickets.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center"><p className="text-slate-400 text-sm">No tickets yet</p></div>
            ) : (
              <div className="space-y-3">
                {tickets.map(t => (
                  <div key={t.id} className="bg-slate-800/30 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-800/40" onClick={() => { setSelectedTicket(t); fetchWithAuth(`/api/admin/tickets/${t.id}`).then(d => { if (d) setSelectedTicket(d); }); }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{t.subject}</span>
                        {t.priority && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.priority === "high" || t.priority === "urgent" ? "bg-red-500/10 text-red-400" : t.priority === "medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-slate-500/10 text-slate-400"}`}>{t.priority}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{t.business_name || "—"} • {new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${t.status === "open" ? "bg-green-500/10 text-green-400" : t.status === "in_progress" ? "bg-blue-500/10 text-blue-400" : t.status === "closed" ? "bg-slate-500/10 text-slate-400" : "bg-yellow-500/10 text-yellow-400"}`}>{t.status?.replace("_", " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TICKET DETAIL */}
        {selectedTicket && (
          <div className="space-y-6">
            <button onClick={() => setSelectedTicket(null)} className="text-sm text-purple-400 hover:text-purple-300 transition">← Back to tickets</button>
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{selectedTicket.subject}</h2>
                <div className="flex gap-2">
                  <select value={selectedTicket.status} onChange={e => updateTicketStatus(selectedTicket.id, e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_on_customer">Waiting</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-400">From: {selectedTicket.business_name} • {new Date(selectedTicket.created_at).toLocaleDateString()}</p>
              {selectedTicket.description && <p className="text-sm text-slate-300 bg-slate-900/50 p-4 rounded-lg">{selectedTicket.description}</p>}
              {selectedTicket.messages && selectedTicket.messages.length > 0 && (
                <div className="space-y-3 border-t border-slate-800 pt-4">
                  <h4 className="text-sm font-semibold text-white">Conversation</h4>
                  {selectedTicket.messages.map((m: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg ${m.is_admin ? "bg-purple-500/10 border border-purple-500/20 ml-8" : "bg-slate-900/50 border border-slate-800 mr-8"}`}>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-semibold">{m.is_admin ? "Admin" : "Business"}</span>
                        <span>{m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</span>
                      </div>
                      <p className="text-sm text-slate-200">{m.message}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-800 pt-4">
                <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); replyToTicket(selectedTicket.id, fd.get("reply") as string); e.currentTarget.reset(); }} className="flex gap-2">
                  <input name="reply" required placeholder="Type your reply..." className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                  <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">Send</button>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
