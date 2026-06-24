import { useState, useEffect } from "react";

interface OverviewDashboardProps {
  businessId: string;
  token: string | null;
}

export default function OverviewDashboard({ businessId, token }: OverviewDashboardProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any>({ total_requests: 0, sent_count: 0, reviewed_count: 0, pending_count: 0, conversion_rate: 0 });
  const [seoMetrics, setSeoMetrics] = useState<any>(null);
  const [income, setIncome] = useState<any>({ total: 0, history: [] });
  const [loading, setLoading] = useState(true);

  const t = token;

  useEffect(() => {
    if (!t) return;
    const load = async () => {
      setLoading(true);
      try {
        const [postsRes, bookingsRes, reviewsRes, statsRes, seoRes, incomeRes] = await Promise.all([
          fetch("/api/posts", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/bookings", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/reviews", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/review-requests/stats", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/seo/metrics", { headers: { Authorization: `Bearer ${t}` } }),
          fetch("/api/income", { headers: { Authorization: `Bearer ${t}` } }),
        ]);

        if (postsRes.ok) setPosts(await postsRes.json());
        if (bookingsRes.ok) setBookings(await bookingsRes.json());
        if (reviewsRes.ok) setReviews(await reviewsRes.json());
        if (statsRes.ok) setReviewStats(await statsRes.json());
        if (seoRes.ok) setSeoMetrics(await seoRes.json());
        if (incomeRes.ok) setIncome(await incomeRes.json());
      } catch (err) {
        console.error("Overview load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const recentPosts = posts.slice(0, 3);
  const upcomingBookings = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "completed")
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(0, 5);
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "—";

  const postStatusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    approved: "bg-green-500/10 text-green-400 border border-green-500/20",
    scheduled: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    posted: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            const btn = document.querySelector('[onclick*="social"]') as HTMLButtonElement;
            btn?.click();
            window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "social" }));
          }}
          className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
        >
          ✍️ Create Post
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "reviews" }))}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-5 py-2.5 rounded-xl transition border border-slate-700 flex items-center gap-2"
        >
          ⭐ Send Review Request
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "calendar" }))}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-5 py-2.5 rounded-xl transition border border-slate-700 flex items-center gap-2"
        >
          📅 View Bookings
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Reviews</div>
          <div className="text-2xl font-black text-white">{reviews.length}</div>
          <div className="text-xs text-green-400">
            ⭐ {avgRating} avg rating
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Conversion Rate</div>
          <div className="text-2xl font-black text-white">{reviewStats.conversion_rate}%</div>
          <div className="text-xs text-purple-400">
            {reviewStats.reviewed_count}/{reviewStats.total_requests}
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Posts This Month</div>
          <div className="text-2xl font-black text-white">{posts.length}</div>
          <div className="text-xs text-blue-400">
            {posts.filter((p) => p.status === "posted" || p.status === "approved").length} active
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Upcoming Bookings</div>
          <div className="text-2xl font-black text-white">{upcomingBookings.length}</div>
          <div className="text-xs text-green-400">
            {bookings.filter((b) => b.status === "confirmed").length} confirmed
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">SEO Impressions</div>
          <div className="text-2xl font-black text-white">
            {seoMetrics?.impressions?.toLocaleString() || "—"}
          </div>
          <div className="text-xs text-slate-400">
            {seoMetrics?.clicks || 0} clicks
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Income</div>
          <div className="text-2xl font-black text-white">${(income?.total || 0).toFixed(0)}</div>
          <div className="text-xs text-green-400">
            from {income?.history?.length || 0} services
          </div>
        </div>
      </div>

      {/* Two-column layout for recent data */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent AI Posts */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Recent AI Posts</h3>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "social" }))}
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              View All →
            </button>
          </div>
          {recentPosts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">No posts generated yet.</p>
              <p className="text-xs text-slate-500 mt-1">Generate your first AI post from the Social tab.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${postStatusColors[post.status] || "bg-slate-500/10 text-slate-400"}`}>
                      {post.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString() : new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{post.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Upcoming Bookings</h3>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "calendar" }))}
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              View All →
            </button>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">No upcoming bookings.</p>
              <p className="text-xs text-slate-500 mt-1">Bookings from chatbot and manual entries appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{booking.customer_name}</span>
                      {booking.service_name && <span className="text-xs text-purple-400">{booking.service_name}</span>}
                    </div>
                    <div className="text-xs text-slate-400">
                      📅 {new Date(booking.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {booking.time}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    booking.status === "confirmed" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                    booking.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                    "bg-slate-500/10 text-slate-400"
                  }`}>{booking.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEO Summary (second row) */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* SEO */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">SEO Performance</h3>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "seo" }))}
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              Full Report →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-900/50 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Impressions</div>
              <div className="text-xl font-black text-white">{seoMetrics?.impressions?.toLocaleString() || "—"}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Clicks</div>
              <div className="text-xl font-black text-white">{seoMetrics?.clicks?.toLocaleString() || "—"}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Views</div>
              <div className="text-xl font-black text-white">{seoMetrics?.views?.toLocaleString() || "—"}</div>
            </div>
          </div>
          {seoMetrics?.keywords && (() => {
            let kw: string[] = [];
            try { kw = typeof seoMetrics.keywords === "string" ? JSON.parse(seoMetrics.keywords) : seoMetrics.keywords; } catch { kw = []; }
            return kw.length > 0 ? (
              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs text-slate-400 mb-2">Top Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {kw.slice(0, 5).map((k: string, i: number) => (
                    <span key={i} className="text-xs bg-slate-900/60 text-slate-300 px-2 py-1 rounded-full border border-slate-800">{k}</span>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Recent Reviews */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Recent Reviews</h3>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("growlocal:switch-tab", { detail: "reviews" }))}
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              Manage Reviews →
            </button>
          </div>
          {reviews.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">No reviews collected yet.</p>
              <p className="text-xs text-slate-500 mt-1">Send review requests from the Reviews tab.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{review.customer_name}</span>
                    <div className="flex gap-0.5 text-yellow-400 text-xs">
                      {Array.from({ length: review.rating }).map((_, i) => (<span key={i}>⭐</span>))}
                    </div>
                  </div>
                  {review.comment && <p className="text-xs text-slate-300 line-clamp-2">"{review.comment}"</p>}
                  <div className="text-[10px] text-slate-500">{new Date(review.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}