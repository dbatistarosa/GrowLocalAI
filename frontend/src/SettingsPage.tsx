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

interface Integration {
  platform: string;
  name: string;
  connected: boolean;
  enabled: boolean;
  docsUrl: string;
  credentialsNeeded: string[];
}

interface UsageStats {
  used: number;
  limit: number;
}

interface SubscriptionData {
  tier: string;
  usage: Record<string, UsageStats>;
  tabs: string[];
}

interface SettingsPageProps {
  business: Business | null;
  token: string | null;
}

const STRIPE_LINKS = {
  Starter: "https://buy.stripe.com/28EdR96thgBo2LIb0m2go03",
  Pro: "https://buy.stripe.com/cNi00jdVJetg1HE9Wi2go04",
  Premium: "https://buy.stripe.com/aFa3cv8Bpad0euq8Se2go05",
};

export default function SettingsPage({ business: initialBusiness, token }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [business, setBusiness] = useState<Business | null>(initialBusiness);

  // Business Profile
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    hours: "",
    description: "",
    target_areas: "",
    logo_url: "",
    category: "",
  });

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState({ name: "", description: "", price: 0, duration: 30 });
  const [addingService, setAddingService] = useState(false);

  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Media Library
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaName, setNewMediaName] = useState("");
  const [newMediaType, setNewMediaType] = useState("image");
  const [addingMedia, setAddingMedia] = useState(false);

  // Subscription
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  const t = token;

  const fetchData = async () => {
    if (!t) return;

    try {
      // Profile handled by props usually, but we might want to refresh
      if (initialBusiness) {
        setProfile({
          name: initialBusiness.name || "",
          phone: initialBusiness.phone || "",
          email: initialBusiness.email || "",
          address: initialBusiness.address || "",
          website: initialBusiness.website || "",
          hours: initialBusiness.hours || "",
          description: initialBusiness.description || "",
          target_areas: initialBusiness.target_areas || "",
          logo_url: initialBusiness.logo_url || "",
          category: initialBusiness.category || "",
        });
      }

      // Services
      const svcRes = await fetch("/api/services", { headers: { Authorization: `Bearer ${t}` } });
      if (svcRes.ok) setServices(await svcRes.json());

      // Integrations
      const intRes = await fetch("/api/integrations/status", { headers: { Authorization: `Bearer ${t}` } });
      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrations(data.integrations);
      }

      // Media
      const mediaRes = await fetch("/api/media", { headers: { Authorization: `Bearer ${t}` } });
      if (mediaRes.ok) setMediaItems(await mediaRes.json());

      // Subscription
      const subRes = await fetch("/api/subscription/limits", { headers: { Authorization: `Bearer ${t}` } });
      if (subRes.ok) setSubscription(await subRes.json());
      
    } catch (err) {
      console.error("Failed to load settings data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [initialBusiness, t]);

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
      if (res.ok) {
        showMessage("success", "Profile updated successfully!");
        // Refresh business info
        if (business) {
            setBusiness({ ...business, ...profile });
        }
      } else {
        showMessage("error", "Failed to update profile.");
      }
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
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(newService),
      });
      if (res.ok) {
        const created = await res.json();
        setServices((prev) => [created, ...prev]);
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
    if (!confirm("Are you sure you want to delete this service?")) return;
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

  const handleAddMedia = async () => {
    if (!t || !newMediaUrl) return;
    setAddingMedia(true);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ url: newMediaUrl, type: newMediaType, name: newMediaName }),
      });
      if (res.ok) {
        const data = await res.json();
        setMediaItems((prev) => [data, ...prev]);
        setNewMediaUrl("");
        setNewMediaName("");
        showMessage("success", "Media added!");
      }
    } catch {
      showMessage("error", "Failed to add media.");
    } finally {
      setAddingMedia(false);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (!t) return;
    if (!confirm("Delete this asset?")) return;
    try {
        const res = await fetch(`/api/media/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${t}` },
        });
        if (res.ok) {
            setMediaItems((prev) => prev.filter((m) => m.id !== id));
            showMessage("success", "Asset deleted.");
        }
    } catch {
        showMessage("error", "Failed to delete asset.");
    }
  };

  const sections = [
    { id: "profile", label: "🏪 Business Profile" },
    { id: "services", label: "💈 Services & Pricing" },
    { id: "social", label: "🔗 Connected Accounts" },
    { id: "media", label: "📸 Media Library" },
    { id: "subscription", label: "💳 Subscription" },
  ];

  if (!business) {
    return (
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center">
        <p className="text-slate-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Settings</h2>
          <p className="text-sm text-slate-400">Manage your business profile, services, and integrations.</p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded-lg text-xs font-bold animate-pulse ${
            message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
          } border`}>
            {message.text}
          </div>
        )}
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

      {/* === BUSINESS PROFILE === */}
      {activeSection === "profile" && (
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Business Profile</h3>
            <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded uppercase font-black tracking-widest">ID: {business.id}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Business Name</label>
                <input type="text" value={profile.name} onChange={(e) => setProfile(p => ({...p, name: e.target.value}))} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Category</label>
                <input type="text" value={profile.category} onChange={(e) => setProfile(p => ({...p, category: e.target.value}))} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Phone</label>
                  <input type="text" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Email</label>
                  <input type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="business@example.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Address</label>
                <input type="text" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St, City, State" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Website</label>
                <input type="text" value={profile.website} onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))} placeholder="https://mybusiness.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Target Areas (comma separated)</label>
                <input type="text" value={profile.target_areas} onChange={(e) => setProfile((p) => ({ ...p, target_areas: e.target.value }))} placeholder="Downtown, North Side, Suburbs" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Operating Hours (per day)</label>
                <textarea value={profile.hours} onChange={(e) => setProfile((p) => ({ ...p, hours: e.target.value }))} placeholder="Mon: 9am-6pm&#10;Tue: 9am-6pm&#10;..." className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Description / Bio (for AI Content)</label>
                <textarea value={profile.description} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} placeholder="Tell customers and the AI about your business story, values, and what makes you unique." className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Logo URL</label>
                <div className="flex gap-3 items-center">
                    <input type="text" value={profile.logo_url} onChange={(e) => setProfile((p) => ({ ...p, logo_url: e.target.value }))} placeholder="https://example.com/logo.png" className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                    {profile.logo_url && <img src={profile.logo_url} alt="Logo" className="w-10 h-10 rounded border border-slate-700 object-cover" />}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button onClick={handleProfileUpdate} disabled={saving} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-8 rounded-xl transition disabled:opacity-50 text-sm shadow-lg shadow-purple-500/20">
                {saving ? "Saving Changes..." : "Save All Changes"}
            </button>
          </div>
        </div>
      )}

      {/* === SERVICES & PRICING === */}
      {activeSection === "services" && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Service Catalog</h3>
            <p className="text-sm text-slate-400">List the services you offer with prices and durations. This powers the chatbot booking and income tracking features.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Services ({services.length})</h4>
                {services.length === 0 ? (
                  <div className="bg-slate-900/50 rounded-xl p-6 text-center border border-dashed border-slate-800">
                    <p className="text-xs text-slate-500 italic">No services added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {services.map((svc) => (
                      <div key={svc.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between group hover:border-slate-700 transition">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{svc.name}</span>
                            <span className="text-xs font-black text-purple-400 tracking-tighter">${svc.price}</span>
                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{svc.duration}m</span>
                          </div>
                          {svc.description && <p className="text-[11px] text-slate-400 leading-tight line-clamp-1">{svc.description}</p>}
                        </div>
                        <button onClick={() => handleDeleteService(svc.id)} className="text-xs text-slate-500 hover:text-red-400 transition p-2 rounded opacity-0 group-hover:opacity-100">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 bg-slate-900/30 p-6 rounded-xl border border-slate-800">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Add New Service</h4>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Service Name</label>
                    <input type="text" value={newService.name} onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Classic Haircut" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Price ($)</label>
                      <input type="number" value={newService.price || ""} onChange={(e) => setNewService((s) => ({ ...s, price: parseFloat(e.target.value) || 0 }))} placeholder="25.00" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Duration (mins)</label>
                      <input type="number" value={newService.duration} onChange={(e) => setNewService((s) => ({ ...s, duration: parseInt(e.target.value) || 30 }))} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                    <textarea value={newService.description} onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))} placeholder="Quick summary of what's included..." className="w-full h-20 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm resize-none" />
                  </div>
                  <button onClick={handleAddService} disabled={addingService || !newService.name} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50 text-xs uppercase tracking-widest">
                    {addingService ? "Saving..." : "Add to Catalog"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === CONNECTED ACCOUNTS === */}
      {activeSection === "social" && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Connected Accounts</h3>
            <p className="text-sm text-slate-400">Link your social platforms and messaging services to activate AI automation features.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((int) => (
                <div key={int.platform} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col justify-between group hover:border-purple-500/30 transition">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl">
                            {int.platform === 'instagram' ? '📷' : int.platform === 'google_business_profile' ? '📍' : '💬'}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">{int.name}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-black">Status: <span className={int.connected ? "text-green-400" : "text-slate-600"}>{int.connected ? "Connected" : "Disconnected"}</span></div>
                        </div>
                      </div>
                      {int.connected && (
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse"></div>
                      )}
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs text-slate-400">Requires: <span className="text-slate-500">{int.credentialsNeeded.join(", ")}</span></p>
                    </div>
                  </div>
                  
                  <div className="pt-6 flex gap-2">
                    <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-tighter py-2 rounded-lg border border-slate-700 transition">
                        Configure API
                    </button>
                    <button className={`flex-1 ${int.connected ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-purple-600 text-white border-transparent"} text-[10px] font-black uppercase tracking-tighter py-2 rounded-lg border transition`}>
                        {int.connected ? "Disconnect" : "Connect Account"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                <p className="text-xs text-slate-500 italic text-center">
                    GrowLocal AI uses official OAuth 2.0 and API integration frameworks. Connection stubs currently represent account status. 
                    <a href="#" className="ml-1 text-purple-400 underline">View Developer Docs</a>
                </p>
            </div>
          </div>
        </div>
      )}

      {/* === MEDIA LIBRARY === */}
      {activeSection === "media" && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Media Library</h3>
                <span className="text-xs font-bold text-slate-500">{mediaItems.length} items</span>
            </div>
            <p className="text-sm text-slate-400">High-quality images and videos the AI can use to generate authentic social content for your brand.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {mediaItems.length === 0 ? (
                <div className="col-span-full bg-slate-900/50 rounded-xl p-12 text-center border border-dashed border-slate-800">
                  <p className="text-sm text-slate-400">No media files found.</p>
                </div>
              ) : (
                mediaItems.map((item) => (
                  <div key={item.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden group relative aspect-square">
                    {item.type === 'video' ? (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-4xl">🎬</div>
                    ) : (
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <p className="text-[10px] text-white font-bold truncate">{item.name || "Untitled Asset"}</p>
                    </div>
                    <button onClick={() => handleDeleteMedia(item.id)} className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-4 bg-slate-900/20 p-4 rounded-xl">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Add Brand Asset</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-2">
                    <select value={newMediaType} onChange={(e) => setNewMediaType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                    </select>
                </div>
                <div className="sm:col-span-4">
                    <input type="text" value={newMediaName} onChange={(e) => setNewMediaName(e.target.value)} placeholder="Asset Name" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="sm:col-span-4">
                    <input type="text" value={newMediaUrl} onChange={(e) => setNewMediaUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="sm:col-span-2">
                    <button onClick={handleAddMedia} disabled={addingMedia || !newMediaUrl} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition disabled:opacity-50 text-xs uppercase tracking-widest">
                        {addingMedia ? "..." : "Add"}
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SUBSCRIPTION === */}
      {activeSection === "subscription" && (
        <div className="space-y-8 max-w-5xl">
          {/* Usage Meter */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Plan Usage</h3>
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest">Current Tier: <span className="text-purple-400">{business.tier}</span></p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-black">Renewal Date</div>
                    <div className="text-sm font-bold text-white">July 16, 2026</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {subscription?.usage && Object.entries(subscription.usage).map(([feature, stats]) => (
                    <div key={feature} className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-300 capitalize">{feature.replace('_', ' ')}</span>
                            <span className="text-[10px] font-black text-slate-500">{stats.used} / {stats.limit === -1 ? '∞' : stats.limit}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${stats.used / stats.limit > 0.9 ? 'bg-red-500' : 'bg-purple-500'} transition-all duration-1000`} 
                                style={{ width: `${stats.limit === -1 ? 0 : Math.min(100, (stats.used / stats.limit) * 100)}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
                {!subscription?.usage && (
                    <p className="text-xs text-slate-500 italic italic col-span-3 text-center">Loading usage metrics...</p>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                  { id: 'Starter', price: 149.99, features: ["12 Social Posts", "AI Review Bot", "Website Chatbot"] },
                  { id: 'Pro', price: 499.99, features: ["30 Social Posts", "Instagram DM Bot", "GBP/SEO Tools", "Calendar"] },
                  { id: 'Premium', price: 999.99, features: ["Unlimited Posts", "AI Video Creation", "Human Review", "Income Tracking"] }
              ].map(plan => (
                <div key={plan.id} className={`p-6 rounded-2xl border transition-all ${
                    business.tier === plan.id 
                    ? "bg-purple-500/10 border-purple-500 ring-4 ring-purple-500/10" 
                    : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                } flex flex-col justify-between h-full`}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black uppercase tracking-widest text-white">{plan.id}</h4>
                            {business.tier === plan.id && <span className="text-[10px] font-black bg-purple-500 text-white px-2 py-0.5 rounded-full">Active</span>}
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">${plan.price}</span>
                            <span className="text-xs text-slate-500 font-bold">/mo</span>
                        </div>
                        <ul className="space-y-3 pt-2">
                            {plan.features.map((f, i) => (
                                <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                                    <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div className="mt-8">
                        {business.tier === plan.id ? (
                            <button disabled className="w-full bg-slate-800 text-slate-500 text-xs font-black uppercase tracking-widest py-3 rounded-xl border border-slate-700 cursor-not-allowed">
                                Current Plan
                            </button>
                        ) : (
                            <a 
                                href={STRIPE_LINKS[plan.id as keyof typeof STRIPE_LINKS]} 
                                target="_blank" 
                                rel="noopener"
                                className="block text-center w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl transition shadow-lg shadow-purple-500/20"
                            >
                                Upgrade Now
                            </a>
                        )}
                    </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
