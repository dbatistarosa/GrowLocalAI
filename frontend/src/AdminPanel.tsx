import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AdminBusiness {
  id: string;
  name: string;
  tier: string;
  stripe_subscription_status: string;
  created_at: string;
  user_email: string;
  user_name: string;
  post_count: number;
  booking_count: number;
  review_count: number;
}

interface AdminTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  business_name: string;
  created_at: string;
}

export default function AdminPanel() {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("businesses");
  const [selectedBusiness, setSelectedBusiness] = useState<AdminBusiness | null>(null);
  const navigate = useNavigate();

  const token = () => localStorage.getItem("token");

  useEffect(() => {
    const t = token();
    if (!t) { navigate("/login"); return; }

    // Check if user is admin (for now, simple check - can be enhanced)
    const fetchAll = async () => {
      try {
        const [bizRes, ticketRes] = await Promise.all([
          fetch("/api/admin/businesses", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/admin/tickets", { headers: { Authorization: `Bearer ${t}` } })
        ]);
        if (bizRes.ok) {
          const bizData = await bizRes.json();
          setBusinesses(bizData);
        }
        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          setTickets(ticketData);
        }
      } catch (err) {
        console.error("Admin load error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [navigate]);

  const handleUpdateTicketStatus = async (id: string, status: string) => {
    const t = token();
    if (!t) return;
    await fetch(`/api/admin/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ status })
    });
    setTickets(prev => prev.map(tk => tk.id === id ? { ...tk, status } : tk));
  };

  // Revenue calculation
  const totalMRR = businesses.reduce((sum, b) => {
    const prices: Record<string, number> = { Starter: 149.99, Pro: 499.99, Premium: 999.99 };
    return sum + (prices[b.tier] || 0);
  }, 0);
  const activeCount = businesses.filter(b => b.stripe_subscription_status === "active" || !b.stripe_subscription_status).length;
  const churnedCount = businesses.filter(b => b.stripe_subscription_status === "canceled" || b.stripe_subscription_status === "past_due").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-56 bg-slate-950 border-r border-slate-800 p-6 shrink-0">
        <div className="space-y-1 mb-6">
          <span className="text-lg font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">GrowLocal AI</span>
          <div className="text-xs text-slate-400">Admin Panel</div>
        </div>
        <nav className="space-y-1">
          {[
            { id: "businesses", label: "🏢 Businesses", count: businesses.length },
            { id: "revenue", label: "💰 Revenue" },
            { id: "tickets", label: "🎫 Support Tickets", count: tickets.filter(t => t.status !== "closed").length },
          ].map(s => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); setSelectedBusiness(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition flex justify-between items-center ${
                activeSection === s.id ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <span>{s.label}</span>
              {s.count !== undefined && <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">{s.count}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => navigate("/dashboard")} className="mt-6 text-xs text-slate-500 hover:text-white transition block">
          ← Back to Dashboard
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">

        {/* Businesses List */}
        {activeSection === "businesses" && !selectedBusiness && (
          <>
            <header>
              <h1 className="text-2xl font-black text-white">Businesses</h1>
              <p className="text-sm text-slate-400">{businesses.length} registered • {activeCount} active</p>
            </header>
            <div className="bg-slate-800/30 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                    <th className="text-left p-4">Business</th>
                    <th className="text-left p-4">Owner</th>
                    <th className="text-left p-4">Plan</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-center p-4">Posts</th>
                    <th className="text-center p-4">Reviews</th>
                    <th className="text-center p-4">Bookings</th>
                    <th className="text-left p-4">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map(b => (
                    <tr key={b.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 cursor-pointer"
                      onClick={() => setSelectedBusiness(b)}
                    >
                      <td className="p-4 font-semibold text-white">{b.name}</td>
                      <td className="p-4 text-slate-300">{b.user_name || "—"}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          b.tier === "Premium" ? "bg-purple-500/20 text-purple-400" :
                          b.tier === "Pro" ? "bg-blue-500/20 text-blue-400" :
                          "bg-slate-500/20 text-slate-400"
                        }`}>{b.tier}</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-semibold ${
                          !b.stripe_subscription_status || b.stripe_subscription_status === "active" || b.stripe_subscription_status === "trialing" ? "text-green-400" :
                          b.stripe_subscription_status === "past_due" ? "text-yellow-400" :
                          "text-red-400"
                        }`}>{b.stripe_subscription_status || "active"}</span>
                      </td>
                      <td className="p-4 text-center text-slate-300">{b.post_count || 0}</td>
                      <td className="p-4 text-center text-slate-300">{b.review_count || 0}</td>
                      <td className="p-4 text-center text-slate-300">{b.booking_count || 0}</td>
                      <td className="p-4 text-slate-400 text-xs">{b.created_at?.split("T")[0] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Business Detail */}
        {selectedBusiness && (
          <div className="space-y-6">
            <button onClick={() => setSelectedBusiness(null)} className="text-sm text-purple-400 hover:text-purple-300 transition">
              ← Back to all businesses
            </button>
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedBusiness.name}</h2>
                  <p className="text-sm text-slate-400">Owner: {selectedBusiness.user_name} • {selectedBusiness.user_email}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                  selectedBusiness.tier === "Premium" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                  selectedBusiness.tier === "Pro" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                  "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                }`}>{selectedBusiness.tier} Plan</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Posts</div>
                  <div className="text-2xl font-black text-white">{selectedBusiness.post_count}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Reviews</div>
                  <div className="text-2xl font-black text-white">{selectedBusiness.review_count}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Bookings</div>
                  <div className="text-2xl font-black text-white">{selectedBusiness.booking_count}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl text-center">
                  <div className="text-xs text-slate-400">Status</div>
                  <div className="text-lg font-black text-white capitalize">{selectedBusiness.stripe_subscription_status || "active"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Dashboard */}
        {activeSection === "revenue" && (
          <>
            <header>
              <h1 className="text-2xl font-black text-white">Revenue Dashboard</h1>
              <p className="text-sm text-slate-400">Monthly recurring revenue and subscription breakdown</p>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total MRR</div>
                <div className="text-3xl font-black text-white">${totalMRR.toFixed(2)}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
                <div className="text-xs text-slate-400 uppercase font-semibold">Active Subscribers</div>
                <div className="text-3xl font-black text-white">{activeCount}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
                <div className="text-xs text-slate-400 uppercase font-semibold">Churned / Past Due</div>
                <div className="text-3xl font-black text-yellow-400">{churnedCount}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
                <div className="text-xs text-slate-400 uppercase font-semibold">Avg Revenue / User</div>
                <div className="text-3xl font-black text-white">${businesses.length > 0 ? (totalMRR / businesses.length).toFixed(2) : "0.00"}</div>
              </div>
            </div>
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Revenue by Tier</h3>
              {["Starter", "Pro", "Premium"].map(tier => {
                const count = businesses.filter(b => b.tier === tier).length;
                const prices: Record<string, number> = { Starter: 149.99, Pro: 499.99, Premium: 999.99 };
                const revenue = count * (prices[tier] || 0);
                const pct = totalMRR > 0 ? ((revenue / totalMRR) * 100).toFixed(1) : "0";
                return (
                  <div key={tier} className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${tier === "Premium" ? "bg-purple-500" : tier === "Pro" ? "bg-blue-500" : "bg-slate-500"}`} />
                      <span className="text-sm font-semibold text-white">{tier}</span>
                      <span className="text-xs text-slate-400">({count} subs)</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">${revenue.toFixed(2)}/mo</div>
                      <div className="text-xs text-slate-400">{pct}% of total</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Support Tickets */}
        {activeSection === "tickets" && (
          <>
            <header>
              <h1 className="text-2xl font-black text-white">Support Tickets</h1>
              <p className="text-sm text-slate-400">{tickets.filter(t => t.status !== "closed").length} open tickets</p>
            </header>
            <div className="space-y-3">
              {tickets.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center">
                  <p className="text-slate-400 text-sm">No support tickets yet.</p>
                </div>
              ) : tickets.map(ticket => (
                <div key={ticket.id} className="bg-slate-800/30 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{ticket.subject}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        ticket.priority === "high" || ticket.priority === "urgent" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        ticket.priority === "medium" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                        "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}>{ticket.priority || "normal"}</span>
                    </div>
                    <p className="text-xs text-slate-400">{ticket.business_name} • {new Date(ticket.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      ticket.status === "open" ? "bg-green-500/10 text-green-400" :
                      ticket.status === "in_progress" ? "bg-blue-500/10 text-blue-400" :
                      ticket.status === "closed" ? "bg-slate-500/10 text-slate-400" :
                      "bg-yellow-500/10 text-yellow-400"
                    }`}>{ticket.status?.replace("_", " ")}</span>
                    {ticket.status !== "closed" && (
                      <select
                        value={ticket.status}
                        onChange={e => handleUpdateTicketStatus(ticket.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting_on_customer">Waiting</option>
                        <option value="closed">Close</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </main>
    </div>
  );
}