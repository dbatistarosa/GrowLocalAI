import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsPage from "./SettingsPage";
import CalendarPage from "./CalendarPage";
import OverviewDashboard from "./OverviewDashboard";
import SocialMediaPage from "./SocialMediaPage";
import faqData from "./faqData";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Business {
  id: string;
  name: string;
  category: string;
  tier: string;
}

interface SocialPost {
  id: string;
  content: string;
  image_url?: string;
  scheduled_at?: string;
  status: string;
}

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
  request_token?: string;
}

interface ReviewRequest {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  shareable_token: string;
  shareableLink: string;
  method: string;
  sent_at?: string;
  reviewed_at?: string;
  status: string;
  created_at: string;
  review_count: number;
}

interface ReviewRequestStats {
  total_requests: number;
  sent_count: number;
  reviewed_count: number;
  pending_count: number;
  conversion_rate: number;
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  // Sub-states for specific sections
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewRequestStats>({
    total_requests: 0, sent_count: 0, reviewed_count: 0, pending_count: 0, conversion_rate: 0
  });

  // Review request form
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [reviewRequestLoading, setReviewRequestLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null);

  // Tier-based tab visibility and usage
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);

  // AI features states
  const [chatbotSnippet, setChatbotSnippet] = useState("");
  const [chatbotHistory, setChatbotHistory] = useState<any[]>([]);
  const [chatbotConfig, setChatbotConfig] = useState<string>("");
  const [savingConfig, setSavingConfig] = useState(false);

  // FAQ states
  const [faqSearch, setFaqSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Support states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportHistory, setSupportHistory] = useState<any[]>([]);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);

  const token = () => localStorage.getItem("token");

  // Listen for tab-switching events from child components
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener("growlocal:switch-tab", handler);
    return () => window.removeEventListener("growlocal:switch-tab", handler);
  }, []);

  // Load dashboard data
  useEffect(() => {
    const t = token();
    if (!t) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch User and Business profile
        const userRes = await fetch("/api/user/me", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (!userRes.ok) throw new Error("Unauthorized");
        const profileData = await userRes.json();
        setUser(profileData.user);
        setBusiness(profileData.business);
        
        // Initialize chatbot config from business data
        if (profileData.business?.chatbot_config) {
          try {
            const config = JSON.parse(profileData.business.chatbot_config);
            setChatbotConfig(config.extraInfo || "");
          } catch (e) {
            console.error("Failed to parse chatbot config");
          }
        }

        // Fetch Reviews
        const reviewsRes = await fetch("/api/reviews", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setReviews(reviewsData);
        }

        // Fetch Review Requests
        const reqsRes = await fetch("/api/review-requests", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (reqsRes.ok) {
          const reqsData = await reqsRes.json();
          setReviewRequests(reqsData);
        }

        // Fetch Review Stats
        const statsRes = await fetch("/api/review-requests/stats", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setReviewStats(statsData);
        }

        // Fetch Subscription Limits (tier-based tab filtering + usage)
        const limitsRes = await fetch("/api/subscription/limits", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (limitsRes.ok) {
          const limitsData = await limitsRes.json();
          if (limitsData.tabs && limitsData.tabs.length > 0) {
            setAvailableTabs(limitsData.tabs);
          }
        }

        // Fetch Chatbot Snippet
        const snippetRes = await fetch("/api/ai/chatbot/snippet", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (snippetRes.ok) {
          const snippetData = await snippetRes.json();
          setChatbotSnippet(snippetData.snippet);
        }

        // Fetch Chat History
        const historyRes = await fetch("/api/ai/chat/history", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setChatbotHistory(historyData);
        }

        // Fetch Support Tickets
        const ticketsRes = await fetch("/api/support/tickets", {
          headers: { Authorization: `Bearer ${t}` }
        });
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData);
        }

      } catch (err) {
        console.error("Dashboard load error:", err);
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const refreshReviewRequests = async () => {
    const t = token();
    if (!t) return;

    const reqsRes = await fetch("/api/review-requests", {
      headers: { Authorization: `Bearer ${t}` }
    });
    if (reqsRes.ok) {
      const reqsData = await reqsRes.json();
      setReviewRequests(reqsData);
    }

    const statsRes = await fetch("/api/review-requests/stats", {
      headers: { Authorization: `Bearer ${t}` }
    });
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      setReviewStats(statsData);
    }

    const reviewsRes = await fetch("/api/reviews", {
      headers: { Authorization: `Bearer ${t}` }
    });
    if (reviewsRes.ok) {
      const reviewsData = await reviewsRes.json();
      setReviews(reviewsData);
    }
  };

  const handleSendReviewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName) return;

    setReviewRequestLoading(true);
    setReviewMessage(null);
    setLastCreatedLink(null);
    const t = token();

    try {
      const response = await fetch("/api/review-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({
          customerName: newCustomerName,
          customerEmail: newCustomerEmail || undefined,
          customerPhone: newCustomerPhone || undefined
        })
      });

      if (!response.ok) throw new Error("Failed to create request");

      const data = await response.json();
      setReviewMessage({ type: "success", text: "Review request created! Share the link with your customer." });
      setLastCreatedLink(data.shareableLink);
      setNewCustomerName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");

      await refreshReviewRequests();
    } catch (err) {
      setReviewMessage({ type: "error", text: "Error creating review request." });
    } finally {
      setReviewRequestLoading(false);
    }
  };

  const handleTrackSent = async (requestId: string) => {
    const t = token();
    if (!t) return;

    try {
      const response = await fetch(`/api/review-requests/${requestId}/track-sent`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}` }
      });

      if (response.ok) {
        await refreshReviewRequests();
      }
    } catch (err) {
      console.error("Failed to track sent:", err);
    }
  };

  const handleSaveChatbotConfig = async () => {
    const t = token();
    if (!t) return;
    
    setSavingConfig(true);
    try {
      const res = await fetch("/api/ai/chatbot/config", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}` 
        },
        body: JSON.stringify({ config: { extraInfo: chatbotConfig } })
      });
      if (res.ok) {
        setReviewMessage({ type: "success", text: "Chatbot settings saved!" });
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      setReviewMessage({ type: "error", text: "Failed to save chatbot settings." });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSupportChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    const t = token();
    const userMsg = { role: 'user', content: supportMessage, created_at: new Date().toISOString() };
    setSupportHistory(prev => [...prev, userMsg]);
    setSupportMessage("");
    setSendingSupport(true);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({ message: userMsg.content, conversationId: "support-session" })
      });
      if (res.ok) {
        const data = await res.json();
        setSupportHistory(prev => [...prev, { role: 'assistant', content: data.response, created_at: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error("Support chat error:", err);
    } finally {
      setSendingSupport(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject || !newTicketMessage) return;

    setCreatingTicket(true);
    const t = token();
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({ subject: newTicketSubject, description: newTicketMessage })
      });
      if (res.ok) {
        const newTicket = await res.json();
        setTickets(prev => [newTicket, ...prev]);
        setNewTicketSubject("");
        setNewTicketMessage("");
        setReviewMessage({ type: "success", text: "Support ticket created successfully!" });
      }
    } catch (err) {
      console.error("Failed to create ticket:", err);
    } finally {
      setCreatingTicket(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setReviewMessage({ type: "success", text: "Link copied to clipboard!" });
    }).catch(() => {
      setReviewMessage({ type: "error", text: "Failed to copy. Select and copy manually." });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading your local marketing engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-6">
          <div className="space-y-1 mb-8">
            <span className="text-xl font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
              GrowLocal AI
            </span>
            <div className="text-xs text-slate-400">Marketing Copilot Dashboard</div>
          </div>

          <nav className="space-y-2">
            {[
              { id: "overview", label: "🏠 Overview" },
              { id: "social", label: "📱 Social Posts" },
              { id: "reviews", label: "⭐ Customer Reviews" },
              { id: "chatbot", label: "💬 Lead Chatbot" },
              { id: "seo", label: "📈 SEO Report" },
              { id: "calendar", label: "📅 Calendar & Bookings" },
              { id: "support", label: "🎧 Support & Help" },
              { id: "faq", label: "❓ Help & FAQ" },
              { id: "settings", label: "⚙️ Settings" }
            ].filter(tab => availableTabs.length === 0 || availableTabs.includes(tab.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === tab.id ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* User Badge Info & Logout */}
        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-sm text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-sm font-bold text-white truncate">{user?.name}</div>
              <div className="text-xs text-slate-400 truncate">{business?.name}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold py-2 rounded-lg text-xs transition border border-slate-700"
          >
            Log Out Account
          </button>
        </div>
      </aside>

      {/* Main Workspace Dashboard */}
      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
        
        {/* Top Sticky Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-black text-white">{business?.name}</h1>
            <p className="text-sm text-slate-400">Category: <span className="font-semibold text-slate-300">{business?.category}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Active Tier: <span className="text-white font-extrabold">{business?.tier} Plan</span>
            </span>
          </div>
        </header>

        {/* Overview section - Enhanced Command Center */}
        {activeTab === "overview" && (
          <OverviewDashboard businessId={business?.id || ""} token={token()} />
        )}

        {/* Social Posts Tab - Enhanced */}
        {activeTab === "social" && (
          <SocialMediaPage
            businessId={business?.id || ""}
            businessTier={business?.tier || "Starter"}
            businessName={business?.name || ""}
            businessCategory={business?.category || ""}
            token={token()}
          />
        )}

        {/* Customer Reviews Tab - Enhanced */}
        {activeTab === "reviews" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Requests</div>
                <div className="text-2xl font-black text-white">{reviewStats.total_requests}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-xs text-green-400 uppercase font-semibold">Sent</div>
                <div className="text-2xl font-black text-white">{reviewStats.sent_count}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-xs text-yellow-400 uppercase font-semibold">Pending</div>
                <div className="text-2xl font-black text-white">{reviewStats.pending_count}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-xs text-purple-400 uppercase font-semibold">Reviewed</div>
                <div className="text-2xl font-black text-white">{reviewStats.reviewed_count}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-xs text-blue-400 uppercase font-semibold">Conversion</div>
                <div className="text-2xl font-black text-white">{reviewStats.conversion_rate}%</div>
              </div>
            </div>

            <div className="grid md:grid-cols-12 gap-8 items-start">
              
              {/* Review Requests List */}
              <div className="md:col-span-7 space-y-6">
                <h2 className="text-xl font-bold text-white">Review Requests</h2>
                
                {reviewRequests.length === 0 ? (
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center space-y-2">
                    <p className="text-slate-400 text-sm">No review requests yet. Create one to start collecting feedback!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewRequests.map((req) => (
                      <div key={req.id} className="bg-slate-800/30 border border-slate-800 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-xs">
                              {req.customer_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-sm font-bold text-white">{req.customer_name}</span>
                              {req.customer_email && (
                                <span className="ml-2 text-xs text-slate-400">📧 {req.customer_email}</span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            req.status === 'reviewed' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : req.status === 'sent'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {req.status === 'reviewed' ? '✅ Reviewed' : req.status === 'sent' ? '📨 Sent' : '⏳ Pending'}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {req.shareableLink && (
                            <button
                              onClick={() => copyToClipboard(req.shareableLink)}
                              className="inline-flex items-center gap-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition border border-purple-500/20"
                            >
                              📋 Copy Link
                            </button>
                          )}
                          {req.status === 'pending' && (
                            <button
                              onClick={() => handleTrackSent(req.id)}
                              className="inline-flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition border border-blue-500/20"
                            >
                              📨 Mark as Sent
                            </button>
                          )}
                          {req.customer_email && (
                            <span className="text-xs text-slate-500">Sent via: {req.method}</span>
                          )}
                        </div>

                        {req.review_count > 0 && (
                          <div className="text-xs text-green-400 font-semibold">⭐ Review received!</div>
                        )}

                        <div className="text-xs text-slate-500">
                          Created {new Date(req.created_at).toLocaleDateString()}
                          {req.sent_at && ` • Sent ${new Date(req.sent_at).toLocaleDateString()}`}
                          {req.reviewed_at && ` • Reviewed ${new Date(req.reviewed_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Box to Create New Requests */}
              <div className="md:col-span-5 bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Create Review Request</h3>
                  <p className="text-xs text-slate-400">Generate a shareable review link for your customer.</p>
                </div>

                <form onSubmit={handleSendReviewRequest} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="e.g. Mike Tyson"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Customer Email (optional)</label>
                    <input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Customer Phone (optional)</label>
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>

                  {reviewMessage && (
                    <div className={`p-3 rounded-lg text-xs font-semibold ${
                      reviewMessage.type === "success"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {reviewMessage.text}
                    </div>
                  )}

                  {lastCreatedLink && (
                    <div className="bg-slate-900/60 border border-purple-500/30 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-purple-400 font-semibold">📎 Shareable Link Created</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={lastCreatedLink}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-purple-300 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lastCreatedLink)}
                          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded transition"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={reviewRequestLoading}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
                  >
                    {reviewRequestLoading ? "Creating..." : "Generate Review Link"}
                  </button>
                </form>

                {/* Recent Reviews */}
                {reviews.length > 0 && (
                  <div className="border-t border-slate-800 pt-6 space-y-4">
                    <h3 className="font-bold text-white text-sm">Recent Customer Reviews</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {reviews.slice(0, 5).map((review) => (
                        <div key={review.id} className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{review.customer_name}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">{review.status}</span>
                          </div>
                          <div className="flex gap-0.5 text-yellow-400 text-xs">
                            {Array.from({ length: review.rating }).map((_, i) => (<span key={i}>⭐</span>))}
                          </div>
                          {review.comment && <p className="text-xs text-slate-300">"{review.comment}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Lead Chatbot Tab */}
        {activeTab === "chatbot" && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold text-white">Lead Generation Chatbot</h2>
              <p className="text-sm text-slate-400">Configure your website widget and monitor live conversation logs.</p>
            </div>

            <div className="grid md:grid-cols-12 gap-8 items-start">
              
              <div className="md:col-span-6 space-y-6">
                {/* Bot Configuration */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-white">Bot Knowledge Base</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">Give the AI more context about your business (services, pricing, hours, etc.) so it can answer customer questions better.</p>
                  <textarea
                    value={chatbotConfig}
                    onChange={(e) => setChatbotConfig(e.target.value)}
                    placeholder="e.g. Our hours are 9am-6pm. Men's haircuts are $30. We are located next to the coffee shop..."
                    className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                  <button
                    onClick={handleSaveChatbotConfig}
                    disabled={savingConfig}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition disabled:opacity-50 text-xs"
                  >
                    {savingConfig ? "Saving..." : "Save Bot Configuration"}
                  </button>
                  {reviewMessage && reviewMessage.text.includes("Chatbot") && (
                    <p className={`text-xs ${reviewMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {reviewMessage.text}
                    </p>
                  )}
                </div>

                {/* Embed Script Instructions */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-white">Embed Snippet</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">Paste this code tag directly into the header/body of your external site to run the GrowLocal Chatbot widget.</p>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-purple-400 overflow-x-auto whitespace-pre">
                    {chatbotSnippet || "Loading snippet..."}
                  </div>
                  {chatbotSnippet && (
                    <button 
                      onClick={() => copyToClipboard(chatbotSnippet)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 px-3 rounded transition border border-slate-700"
                    >
                      Copy Snippet
                    </button>
                  )}
                </div>
              </div>

              {/* Chatbot conversation logs */}
              <div className="md:col-span-6 space-y-4">
                <h3 className="font-bold text-white">Recent Conversations</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {chatbotHistory.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8 italic">No conversations recorded yet.</p>
                  ) : (
                    chatbotHistory.map((log, i) => (
                      <div key={i} className={`bg-slate-800/30 border border-slate-800 rounded-xl p-4 space-y-2 ${log.role === 'assistant' ? 'ml-4 border-purple-500/30' : 'mr-4 border-blue-500/30'}`}>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className={`font-semibold uppercase tracking-wider ${log.role === 'assistant' ? 'text-purple-400' : 'text-blue-400'}`}>
                            {log.role === 'assistant' ? 'AI Assistant' : 'Customer'}
                          </span>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-white leading-relaxed">{log.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === "seo" && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold text-white">Local SEO Dashboard</h2>
              <p className="text-sm text-slate-400">Your Google Business ranking, search impressions, and local search visibility metrics.</p>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 space-y-6">
              <div className="grid sm:grid-cols-3 gap-6 text-center">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Search Impressions</div>
                  <div className="text-3xl font-black text-white">1,452</div>
                  <p className="text-xs text-green-400">▲ +12% this month</p>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Google Maps Views</div>
                  <div className="text-3xl font-black text-white">821</div>
                  <p className="text-xs text-green-400">▲ +8% this month</p>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Keyword Ranking Average</div>
                  <div className="text-3xl font-black text-white">#3.2</div>
                  <p className="text-xs text-purple-400">Top 3 local pack</p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6 space-y-4">
                <h3 className="font-bold text-white">Top Performing Local Keywords</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 p-3 rounded-lg text-center text-xs border border-slate-800">
                    <p className="text-slate-400 font-semibold">{business?.category} near me</p>
                    <p className="text-purple-400 font-black">Rank #1</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg text-center text-xs border border-slate-800">
                    <p className="text-slate-400 font-semibold">Best {business?.category}</p>
                    <p className="text-purple-400 font-black">Rank #2</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg text-center text-xs border border-slate-800">
                    <p className="text-slate-400 font-semibold">Premium beard trim</p>
                    <p className="text-purple-400 font-black">Rank #1</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg text-center text-xs border border-slate-800">
                    <p className="text-slate-400 font-semibold">Local facial haircut</p>
                    <p className="text-purple-400 font-black">Rank #4</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support & Help Tab */}
        {activeTab === "support" && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold text-white">GrowLocal Help & Support</h2>
              <p className="text-sm text-slate-400">Get instant AI help or open a support ticket with our human team.</p>
            </div>

            <div className="grid md:grid-cols-12 gap-8 items-start">
              
              {/* AI Support Chat */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col h-[500px]">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <h3 className="font-bold text-white text-sm">GrowLocal Support AI</h3>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {supportHistory.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <div className="text-4xl">👋</div>
                        <p className="text-sm text-white font-bold">How can I help you today?</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">I'm trained on GrowLocal features, pricing, and setup steps.</p>
                      </div>
                    ) : (
                      supportHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-xl text-xs leading-relaxed ${
                            msg.role === 'user' 
                              ? 'bg-purple-600 text-white rounded-tr-none' 
                              : 'bg-slate-700/50 text-slate-100 border border-slate-700 rounded-tl-none'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    {sendingSupport && (
                      <div className="flex justify-start animate-pulse">
                        <div className="bg-slate-700/50 p-3 rounded-xl rounded-tl-none border border-slate-700">
                          <div className="flex gap-1">
                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSupportChat} className="p-4 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Ask a question..."
                      className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={sendingSupport || !supportMessage.trim()}
                      className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>

              {/* Support Tickets */}
              <div className="md:col-span-5 space-y-6">
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-white text-sm italic">Need Human Help?</h3>
                  <p className="text-xs text-slate-400">If the AI can't help, open a ticket and our team will get back to you within 24 hours.</p>
                  
                  <form onSubmit={handleCreateTicket} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                    <textarea
                      required
                      value={newTicketMessage}
                      onChange={(e) => setNewTicketMessage(e.target.value)}
                      placeholder="Describe your issue..."
                      className="w-full h-24 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={creatingTicket}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-lg transition border border-slate-700 text-xs"
                    >
                      {creatingTicket ? "Opening Ticket..." : "Open Support Ticket"}
                    </button>
                  </form>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-white text-sm px-1">Your Tickets</h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {tickets.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-lg">No active tickets.</p>
                    ) : (
                      tickets.map(ticket => (
                        <div key={ticket.id} className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{ticket.subject}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              ticket.status === 'open' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{ticket.description}</p>
                          <div className="text-[10px] text-slate-500">{new Date(ticket.created_at).toLocaleDateString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Help & FAQ Tab */}
        {activeTab === "faq" && (
          <div className="space-y-6 animate-fadeIn max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-white">Help & FAQ</h2>
              <p className="text-sm text-slate-400">Find answers to common questions about using GrowLocal AI.</p>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search for a question..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white focus:outline-none focus:border-purple-500 transition"
              />
              <div className="absolute left-3 top-3.5 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="space-y-8">
              {faqData
                .filter(cat => {
                  // Filter by tier
                  if (cat.tier === "pro_premium") {
                    return business?.tier === "Pro" || business?.tier === "Premium";
                  }
                  return true;
                })
                .map(category => {
                  // Filter questions by search
                  const filteredQuestions = category.questions.filter(q => 
                    q.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
                    q.a.toLowerCase().includes(faqSearch.toLowerCase())
                  );

                  if (filteredQuestions.length === 0) return null;

                  return (
                    <div key={category.category} className="space-y-4">
                      <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider px-2">{category.category}</h3>
                      <div className="space-y-2">
                        {filteredQuestions.map(item => (
                          <div 
                            key={item.q} 
                            className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden transition hover:border-slate-700"
                          >
                            <button
                              onClick={() => setExpandedFaq(expandedFaq === item.q ? null : item.q)}
                              className="w-full text-left p-4 flex items-center justify-between gap-4"
                            >
                              <span className="text-sm font-semibold text-slate-100">{item.q}</span>
                              <span className={`text-slate-500 transition-transform ${expandedFaq === item.q ? 'rotate-180' : ''}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </button>
                            {expandedFaq === item.q && (
                              <div className="px-4 pb-4 animate-slideDown">
                                <p className="text-sm text-slate-400 leading-relaxed border-t border-slate-800/50 pt-3">
                                  {item.a}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* No Results */}
            {faqData.every(cat => cat.questions.every(q => !q.q.toLowerCase().includes(faqSearch.toLowerCase()) && !q.a.toLowerCase().includes(faqSearch.toLowerCase()))) && (
              <div className="text-center py-12 space-y-4">
                <div className="text-4xl">🔍</div>
                <p className="text-slate-400 italic">No questions found matching your search.</p>
                <button 
                  onClick={() => setFaqSearch("")}
                  className="text-purple-400 hover:text-purple-300 text-sm font-bold underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Calendar & Bookings Tab */}
        {activeTab === "calendar" && (
          <CalendarPage businessId={business?.id || ""} token={token()} />
        )}

        {/* Settings Tab - Enhanced */}
        {activeTab === "settings" && (
          <SettingsPage business={business} token={token()} />
        )}

      </main>

    </div>
  );
}