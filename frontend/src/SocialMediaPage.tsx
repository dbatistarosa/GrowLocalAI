import { useState, useEffect } from "react";

interface SocialPost {
  id: string;
  content: string;
  image_url?: string;
  scheduled_at?: string;
  status: string;
  created_at: string;
  type?: string;
}

interface SocialMediaPageProps {
  businessId: string;
  businessTier: string;
  businessName: string;
  businessCategory: string;
  token: string | null;
}

interface Integration {
  platform: string;
  name: string;
  connected: boolean;
}

const PLAN_LIMITS: Record<string, number> = { Starter: 12, Pro: 30, Premium: 999999 };

export default function SocialMediaPage({ businessId, businessTier, businessName, businessCategory, token }: SocialMediaPageProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"posts" | "video">("posts");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [usage, setUsage] = useState({ used: 0, limit: 12 });
  const [instagramConnected, setInstagramConnected] = useState(false);

  // Editing
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Scheduling
  const [schedulingPostId, setSchedulingPostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Video
  const [videoScript, setVideoScript] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [generatingVideo, setGeneratingVideo] = useState(false);

  const tierLimit = PLAN_LIMITS[businessTier] || 12;
  const isUnlimited = tierLimit >= 999999;
  const isPremium = businessTier === "Premium";

  const t = token;

  const fetchPosts = async () => {
    if (!t) return;
    try {
      const res = await fetch("/api/posts", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
        const activeCount = data.filter((p: any) => !["rejected", "failed", "draft"].includes(p.status)).length;
        setUsage({ used: activeCount, limit: tierLimit });
      }
    } catch {}
  };

  const fetchIntegrations = async () => {
    if (!t) return;
    try {
        const res = await fetch("/api/integrations/status", { headers: { Authorization: `Bearer ${t}` } });
        if (res.ok) {
            const data = await res.json();
            const ig = data.integrations.find((i: Integration) => i.platform === "instagram");
            setInstagramConnected(!!ig?.connected);
        }
    } catch {}
  };

  useEffect(() => {
    if (!t) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPosts(), fetchIntegrations()]);
      setLoading(false);
    };
    load();
  }, [t]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleGeneratePosts = async () => {
    if (!t) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        await fetchPosts();
        showMessage("success", `Generated ${data.posts?.length || 3} new post options!`);
      } else {
        const err = await res.json();
        showMessage("error", err.error || "Failed to generate posts.");
      }
    } catch {
      showMessage("error", "Connection error during generation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!t) return;
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
        showMessage("success", `Post ${status}!`);
        fetchPosts(); // refresh usage
      }
    } catch {
      showMessage("error", "Failed to update post.");
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!t || !editContent.trim()) return;
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, content: editContent } : p)));
        setEditingPostId(null);
        showMessage("success", "Caption updated!");
      }
    } catch {
      showMessage("error", "Failed to save edit.");
    }
  };

  const handleSchedule = async (id: string) => {
    if (!t || !scheduleDate || !scheduleTime) return;
    const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ scheduled_at: scheduledAt, status: "scheduled" }),
      });
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, scheduled_at: scheduledAt, status: "scheduled" } : p)));
        setSchedulingPostId(null);
        showMessage("success", "Post scheduled!");
        fetchPosts();
      }
    } catch {
      showMessage("error", "Failed to schedule.");
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!t) return;
    try {
      const res = await fetch(`/api/posts/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ tone: "engaging" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, content: data.content } : p)));
        showMessage("success", "Post regenerated!");
      }
    } catch {
      showMessage("error", "Failed to regenerate.");
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!t) return;
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        showMessage("success", "Post deleted.");
        fetchPosts();
      }
    } catch {
      showMessage("error", "Failed to delete.");
    }
  };

  const handleGenerateVideo = async () => {
    if (!t || !isPremium) return;
    setGeneratingVideo(true);
    try {
      const res = await fetch("/api/ai/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ postContent: "Our latest services and offers" }),
      });
      if (res.ok) {
        const data = await res.json();
        setVideoScript(data.script || {});
        setVideoUrl(data.videoUrl || "");
      }
    } catch {
      showMessage("error", "Video generation failed.");
    } finally {
      setGeneratingVideo(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const postStatuses = ["draft", "pending", "approved", "scheduled", "posted", "rejected", "failed"];
  const postsByStatus = (status: string) => posts.filter((p) => p.status === status);

  const activePostsCount = posts.filter((p) => !["rejected", "failed", "draft"].includes(p.status)).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Social Media Manager</h2>
          <p className="text-sm text-slate-400">Create, preview, approve, and schedule AI-generated social content.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <div className={`text-[10px] font-black uppercase tracking-widest ${instagramConnected ? 'text-green-500' : 'text-slate-500'}`}>
                Instagram: {instagramConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="text-xs text-slate-400">
                Usage: <span className="font-bold text-white">{isUnlimited ? "∞" : `${activePostsCount}/${tierLimit}`}</span>
            </div>
          </div>
          <button
            onClick={handleGeneratePosts}
            disabled={generating || (!isUnlimited && activePostsCount >= tierLimit)}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition disabled:opacity-50 shadow-lg shadow-purple-500/20"
          >
            {generating ? "⏳ Generating..." : "✨ Generate New Posts"}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-xl text-sm font-semibold border ${
          message.type === "success" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
        } animate-bounce`}>
          {message.text}
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-2 border-b border-slate-800 pb-4">
        <button onClick={() => setActiveSubTab("posts")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSubTab === "posts" ? "bg-purple-600 text-white" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-800"}`}>
          📱 Social Posts
        </button>
        {isPremium && (
          <button onClick={() => setActiveSubTab("video")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSubTab === "video" ? "bg-purple-600 text-white" : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-800"}`}>
            🎬 AI Video (Premium)
          </button>
        )}
      </div>

      {/* ===== POSTS TAB ===== */}
      {activeSubTab === "posts" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {postStatuses.map((status) => {
              const count = postsByStatus(status).length;
              if (count === 0 && !["pending", "approved", "scheduled"].includes(status)) return null;
              return (
                <div key={status} className="bg-slate-800/30 border border-slate-800 rounded-xl p-3 text-center min-w-[100px] shrink-0">
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{status}</div>
                  <div className="text-lg font-black text-white">{count}</div>
                </div>
              );
            })}
          </div>

          {/* Posts Grid */}
          {posts.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-12 text-center space-y-4">
              <div className="text-5xl">📸</div>
              <h3 className="text-lg font-bold text-white">No Posts Yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Click "Generate New Posts" to have our AI create engaging, on-brand social content for your business.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...posts]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((post) => (
                <div key={post.id} className={`bg-slate-800/40 border ${editingPostId === post.id ? 'border-purple-500' : 'border-slate-800'} rounded-2xl overflow-hidden flex flex-col group transition hover:border-slate-700 shadow-xl`}>
                  {/* Image Preview */}
                  {post.image_url && (
                    <div className="aspect-square bg-slate-900 relative overflow-hidden">
                      <img src={post.image_url} alt="Post visual" className="w-full h-full object-cover group-hover:scale-110 transition duration-700" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-3xl text-slate-600">🖼️</div>';
                      }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60"></div>
                    </div>
                  )}

                  <div className="p-5 space-y-4 flex-1 flex flex-col relative">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                        post.status === "posted" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                        post.status === "approved" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                        post.status === "scheduled" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                        post.status === "rejected" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        post.status === "failed" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                      }`}>{post.status}</span>
                      {post.scheduled_at && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full">📅 {new Date(post.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>

                    {/* Content */}
                    {editingPostId === post.id ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-purple-500 resize-none"
                      />
                    ) : (
                      <div className="flex-1">
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-800/50 space-y-2 mt-auto">
                      {editingPostId === post.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(post.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase py-2 rounded-lg transition">Save</button>
                          <button onClick={() => setEditingPostId(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase py-2 rounded-lg transition border border-slate-700">Cancel</button>
                        </div>
                      ) : schedulingPostId === post.id ? (
                        <div className="space-y-2 animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-[10px] focus:outline-none" />
                            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-[10px] focus:outline-none" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSchedule(post.id)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase py-2 rounded-lg transition">Confirm</button>
                            <button onClick={() => setSchedulingPostId(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 rounded-lg transition border border-slate-700">✕</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {post.status !== "approved" && post.status !== "posted" && post.status !== "scheduled" && (
                            <button onClick={() => handleUpdateStatus(post.id, "approved")} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase py-2 rounded-lg transition">Approve</button>
                          )}
                          {post.status !== "scheduled" && post.status !== "posted" && (
                            <button onClick={() => { setSchedulingPostId(post.id); setScheduleDate(""); setScheduleTime(""); }} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase py-2 px-3 rounded-lg transition shrink-0">Schedule</button>
                          )}
                          {post.status !== "posted" && (
                            <div className="flex gap-1 shrink-0">
                              <button title="Regenerate Caption" onClick={() => handleRegenerate(post.id)} className="bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 p-2 rounded-lg transition border border-slate-700">🔄</button>
                              <button title="Edit Caption" onClick={() => { setEditingPostId(post.id); setEditContent(post.content); }} className="bg-slate-800 hover:bg-blue-500/20 hover:text-blue-400 text-slate-400 p-2 rounded-lg transition border border-slate-700">✏️</button>
                              <button title="Delete Post" onClick={() => handleDeletePost(post.id)} className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 p-2 rounded-lg transition border border-slate-700">✕</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Usage meter */}
          {!isUnlimited && (
            <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-purple-500/5">
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Monthly Post Usage</span>
                <span className="text-white font-black">{activePostsCount} / {tierLimit}</span>
              </div>
              <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full ${activePostsCount / tierLimit > 0.8 ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'} rounded-full transition-all duration-1000`}
                  style={{ width: `${Math.min((activePostsCount / tierLimit) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-tight">
                {activePostsCount >= tierLimit ? "⚠️ Limit reached. Upgrade your plan for more posts." : `${tierLimit - activePostsCount} posts remaining in your current billing cycle`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== VIDEO TAB (Premium) ===== */}
      {activeSubTab === "video" && isPremium && (
        <div className="space-y-6">
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 space-y-6 text-center">
            <div className="max-w-2xl mx-auto space-y-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">AI Brand Video Creator</h3>
                <p className="text-sm text-slate-400">Transform your business profile into a high-converting short video for Instagram Reels and TikTok.</p>
            </div>

            {!videoUrl ? (
              <div className="py-8 space-y-6">
                <div className="text-7xl animate-pulse">🎬</div>
                <button
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest px-10 py-4 rounded-2xl transition disabled:opacity-50 shadow-xl shadow-purple-500/20"
                >
                  {generatingVideo ? "⏳ Crafting Video..." : "🎥 Generate Brand Video"}
                </button>
              </div>
            ) : (
              <div className="space-y-8 text-left">
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Video Player */}
                    <div className="aspect-[9/16] max-w-[320px] mx-auto bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl">
                        <video src={videoUrl} controls className="w-full h-full object-cover" />
                    </div>

                    {/* Script */}
                    <div className="space-y-6">
                        {videoScript && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                            <h4 className="font-black text-white text-xs uppercase tracking-widest border-b border-slate-800 pb-3">Video Storyboard</h4>
                            {videoScript.scenes ? (
                            <div className="space-y-4">
                                {videoScript.scenes.map((scene: any, i: number) => (
                                <div key={i} className="bg-slate-800/30 rounded-xl p-4 space-y-1 border border-slate-700/50">
                                    <p className="text-[10px] font-black text-purple-400 uppercase">Scene {i + 1}</p>
                                    <p className="text-[11px] font-bold text-slate-300">{scene.visual || scene.description || ""}</p>
                                    <p className="text-xs italic text-slate-500">"{scene.text || scene.overlay || ""}"</p>
                                </div>
                                ))}
                            </div>
                            ) : (
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans">{JSON.stringify(videoScript, null, 2)}</pre>
                            )}
                        </div>
                        )}
                        <button
                            onClick={handleGenerateVideo}
                            disabled={generatingVideo}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest py-4 rounded-2xl transition border border-slate-700"
                        >
                            {generatingVideo ? "Regenerating..." : "🔄 Regenerate Video"}
                        </button>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
