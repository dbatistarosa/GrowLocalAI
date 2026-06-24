import { useState, useEffect } from "react";

interface Business {
  id: string;
  name: string;
  category: string;
  tier: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  hours?: string;
  logo_url?: string;
  description?: string;
  target_areas?: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
}

interface MediaItem {
  id: string;
  url: string;
  type: string;
  name?: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  username?: string;
  status: string;
}

interface SettingsPageProps {
  business: Business | null;
  token: string | null;
}

const PLAN_LIMITS: Record<string, { label: string; price: number; features: string[]; checkoutUrl: string }> = {
  Starter: {
    label: "Starter",
    price: 149.99,
    features: ["12 AI Social Posts/mo", "Automated Review Requests", "Basic Website Chatbot", "1 Instagram Connection"],
    checkoutUrl: "https://buy.stripe.com/28EdR96thgBo2LIb0m2go03",
  },
  Pro: {
    label: "Pro",
    price: 499.99,
    features: ["30 AI Social Posts/mo", "AI Instagram DM Chatbot", "WhatsApp Automation", "GBP Management", "SEO Dashboard", "Calendar Reservations"],
    checkoutUrl: "https://buy.stripe.com/cNi00jdVJetg1HE9Wi2go04",
  },
  Premium: {
    label: "Premium",
    price: 999.99,
    features: ["Unlimited AI Posts", "AI Video Creation", "Human Review of Content", "Competitor Tracking", "Income Tracking", "Priority Support"],
    checkoutUrl: "https://buy.stripe.com/aFa3cv8Bpad0euq8Se2go05",
  },
};

export default function SettingsPage({ business, token }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Business Profile
  const [profile, setProfile] = useState({
    phone: "",
    email: "",
    address: "",
    website: "",
    hours: "",
    description: "",
    target_areas: "",
    logo_url: "",
  });

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState({ name: "", description: "", price: 0, duration: 30 });
  const [addingService, setAddingService] = useState(false);

  // Social Accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  // Media Library
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState("image");
  const [addingMedia, setAddingMedia] = useState(false);

  const t = token;

  useEffect(() => {
    if (!business || !t) return;

    // Load profile data
    setProfile((prev) => ({
      ...prev,
      phone: business.phone || "",
      email: business.email || "",
      address: business.address || "",
      website: business.website || "",
      hours: business.hours || "",
      logo_url: business.logo_url || "",
    }));

    // Load services
    fetch("/api/business/services", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.ok && r.json())
      .then((data) => setServices(data || []))
      .catch(() => {});

    // Load social accounts
    fetch("/api/social-accounts", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.ok && r.json())
      .then((data) => setSocialAccounts(data || []))
      .catch(() => {});

    // Load media
    fetch("/api/business/media", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.ok && r.json())
      .then((data) => setMediaItems(data || []))
      .catch(() => {});
  }, [business, t]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleProfileUpdate = async () => {
    if (!t) return;
    setSaving(true);
    try {
      const res = await fetch("/api/business/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(profile),
      });
      if (res.ok) showMessage("success", "Profile updated successfully!");
      else showMessage("error", "Failed to update profile.");
    } catch {
      showMessage("error", "Connection error.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async () => {
    if (!t || !newService.name) return;
    setAddingService(true);
    try {
      const res = await fetch("/api/business/services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(newService),
      });
      if (res.ok) {
        const created = await res.json();
        setServices((prev) => [...prev, { id: created.id, ...newService }]);
        setNewService({ name: "", description: "", price: 0, duration: 30 });
        showMessage("success", "Service added!");
      }
    } catch {
      showMessage("error", "Failed to add service.");
    } finally {
      setAddingService(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!t) return;
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        setServices((prev) => prev.filter((s) => s.id !== id));
        showMessage("success", "Service deleted.");
      }
    } catch {
      showMessage("error", "Failed to delete service.");
    }
  };

  const handleConnectAccount = async (platform: string) => {
    if (!t) return;
    try {
      const res = await fetch("/api/social-accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ platform, username: `${platform}_user` }),
      });
      if (res.ok) {
        const data = await res.json();
        setSocialAccounts((prev) => [...prev.filter((a) => a.platform !== platform), data]);
        showMessage("success", `${platform} connected!`);
      }
    } catch {
      showMessage("error", `Failed to connect ${platform}.`);
    }
  };

  const handleDisconnectAccount = async (platform: string) => {
    if (!t) return;
    try {
      const res = await fetch("/api/social-accounts/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ platform }),
      });
      if (res.ok) {
        setSocialAccounts((prev) => prev.filter((a) => a.platform !== platform));
        showMessage("success", `${platform} disconnected.`);
      }
    } catch {
      showMessage("error", `Failed to disconnect ${platform}.`);
    }
  };

  const handleAddMedia = async () => {
    if (!t || !newMediaUrl) return;
    setAddingMedia(true);
    try {
      const res = await fetch("/api/business/media", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ url: newMediaUrl, type: newMediaType }),
      });
      if (res.ok) {
        const data = await res.json();
        setMediaItems((prev) => [...prev, data]);
        setNewMediaUrl("");
        showMessage("success", "Media added!");
      }
    } catch {
      showMessage("error", "Failed to add media.");
    } finally {
      setAddingMedia(false);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    // Media deletion not implemented in backend - will just remove from UI
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
  };

  if (!business) {
    return (
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center">
        <p className="text-slate-400">Loading settings...</p>
      </div>
    );
  }

  const sections = [
    { id: "profile", label: "🏪 Business Profile" },
    { id: "services", label: "💈 Services & Pricing" },
    { id: "social", label: "🔗 Connected Accounts" },
    { id: "media", label: "📸 Media Library" },
    { id: "subscription", label: "💳 Subscription" },
  ];

  const isConnected = (platform: string) => socialAccounts.some((a) => a.platform === platform && a.status === "connected");

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-black text-white">Settings</h2>
        <p className="text-sm text-slate-400">Manage your business profile, services, and integrations.</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap border-b border-slate-800 pb-4">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === s.id
                ? "bg-purple-600 text-white"
                : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* === BUSINESS PROFILE === */}
      {activeSection === "profile" && (
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6 max-w-2xl">
          <h3 className="text-lg font-bold text-white">Business Profile</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Business Name</label>
              <input type="text" value={business.name} disabled className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Category</label>
              <input type="text" value={business.category} disabled className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Phone</label>
              <input type="text" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Email</label>
              <input type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="business@example.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400">Address</label>
              <input type="text" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St, City, State" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400">Website</label>
              <input type="text" value={profile.website} onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))} placeholder="https://mybusiness.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400">Operating Hours</label>
              <textarea value={profile.hours} onChange={(e) => setProfile((p) => ({ ...p, hours: e.target.value }))} placeholder="Mon-Fri: 9am-6pm&#10;Sat: 10am-4pm&#10;Sun: Closed" className="w-full h-24 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400">Description / Bio</label>
              <textarea value={profile.description} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} placeholder="Tell customers about your business..." className="w-full h-24 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400">Logo URL</label>
              <input type="text" value={profile.logo_url} onChange={(e) => setProfile((p) => ({ ...p, logo_url: e.target.value }))} placeholder="https://example.com/logo.png" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
            </div>
          </div>

          <button onClick={handleProfileUpdate} disabled={saving} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-6 rounded-lg transition disabled:opacity-50 text-sm">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      )}

      {/* === SERVICES & PRICING === */}
      {activeSection === "services" && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Service Catalog</h3>
            <p className="text-sm text-slate-400">List the services you offer with prices and durations. This powers the chatbot booking and income tracking.</p>

            {services.length === 0 ? (
              <div className="bg-slate-900/50 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-400">No services added yet. Add your first service below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((svc) => (
                  <div key={svc.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{svc.name}</span>
                        <span className="text-xs font-semibold text-purple-400">${svc.price}</span>
                        <span className="text-xs text-slate-400">{svc.duration}min</span>
                      </div>
                      {svc.description && <p className="text-xs text-slate-400">{svc.description}</p>}
                    </div>
                    <button onClick={() => handleDeleteService(svc.id)} className="text-xs text-red-400 hover:text-red-300 transition px-2 py-1 rounded hover:bg-red-500/10">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Add New Service</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Service Name</label>
                  <input type="text" value={newService.name} onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))} placeholder="Haircut" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Price ($)</label>
                  <input type="number" value={newService.price || ""} onChange={(e) => setNewService((s) => ({ ...s, price: parseFloat(e.target.value) || 0 }))} placeholder="29.99" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Duration (minutes)</label>
                  <input type="number" value={newService.duration} onChange={(e) => setNewService((s) => ({ ...s, duration: parseInt(e.target.value) || 30 }))} placeholder="30" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-400">Description</label>
                  <input type="text" value={newService.description} onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))} placeholder="Professional haircut and styling" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
              </div>
              <button onClick={handleAddService} disabled={addingService || !newService.name} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-6 rounded-lg transition disabled:opacity-50 text-sm">
                {addingService ? "Adding..." : "Add Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CONNECTED ACCOUNTS === */}
      {activeSection === "social" && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Connected Accounts</h3>
            <p className="text-sm text-slate-400">Link your social platforms and messaging services.</p>

            {[
              { platform: "instagram", label: "Instagram", icon: "📷", description: "Auto-post content and DM chatbot (Pro+)", docUrl: "https://developers.facebook.com/docs/instagram-basic-display-api/" },
              { platform: "google_business_profile", label: "Google Business Profile", icon: "📍", description: "Manage GBP, reviews, and SEO insights (Pro+)", docUrl: "https://developers.google.com/my-business" },
              { platform: "whatsapp", label: "WhatsApp Business", icon: "💬", description: "WhatsApp chatbot and booking (Pro+)", docUrl: "https://www.twilio.com/docs/whatsapp" },
            ].map((platform) => (
              <div key={platform.platform} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{platform.label}</span>
                      {isConnected(platform.platform) && <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Connected</span>}
                    </div>
                    <p className="text-xs text-slate-400">{platform.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isConnected(platform.platform) ? (
                    <button onClick={() => handleConnectAccount(platform.platform)} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition">
                      Connect
                    </button>
                  ) : (
                    <button onClick={() => handleDisconnectAccount(platform.platform)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-lg transition border border-slate-700">
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))}

            <p className="text-xs text-slate-500 italic">
              Full OAuth integration requires app credentials from each platform. Currently in stub mode — connections are stored but not authenticated with the platform.
            </p>
          </div>
        </div>
      )}

      {/* === MEDIA LIBRARY === */}
      {activeSection === "media" && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Media Library</h3>
            <p className="text-sm text-slate-400">Upload images and videos that the AI can use in your social posts.</p>

            {mediaItems.length === 0 ? (
              <div className="bg-slate-900/50 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-400">No media uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {mediaItems.map((item) => (
                  <div key={item.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden group relative">
                    <div className="aspect-square bg-slate-800 flex items-center justify-center text-3xl">
                      {item.type === "video" ? "🎬" : "🖼️"}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-slate-400 truncate">{item.name || item.url.split("/").pop()}</p>
                    </div>
                    <button onClick={() => handleDeleteMedia(item.id)} className="absolute top-2 right-2 bg-red-500/80 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Add Media</h4>
              <div className="flex gap-4 flex-wrap">
                <select value={newMediaType} onChange={(e) => setNewMediaType(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
                <input type="text" value={newMediaUrl} onChange={(e) => setNewMediaUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm min-w-[200px]" />
                <button onClick={handleAddMedia} disabled={addingMedia || !newMediaUrl} className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg transition disabled:opacity-50 text-sm">
                  {addingMedia ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SUBSCRIPTION === */}
      {activeSection === "subscription" && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Subscription</h3>
            <p className="text-sm text-slate-400">Current plan: <span className="font-bold text-purple-400">{business.tier}</span></p>

            <div className="grid sm:grid-cols-3 gap-4">
              {Object.entries(PLAN_LIMITS).map(([key, plan]) => (
                <div key={key} className={`p-5 rounded-xl border ${
                  business.tier === key
                    ? "bg-purple-500/10 border-purple-500 ring-1 ring-purple-500/30"
                    : "bg-slate-900/50 border-slate-800"
                } space-y-4`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{plan.label}</h4>
                      {business.tier === key && <span className="text-xs font-bold text-purple-400">Current</span>}
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-black text-white">${plan.price}</span>
                      <span className="ml-1 text-xs text-slate-400">/mo</span>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-center gap-1.5">✅ {f}</li>
                    ))}
                  </ul>
                  {business.tier !== key && (
                    <a
                      href={plan.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded-lg transition"
                    >
                      Switch to {plan.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}