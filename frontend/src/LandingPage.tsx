import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
    category: "Barbershop"
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsRegistered(true);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      localStorage.setItem("token", data.token);
      setUser(data);
      setIsRegistered(true);
      setMessage({ type: "success", text: "Successfully registered! Redirecting to your dashboard..." });
      setTimeout(() => {
        setShowModal(false);
        navigate("/dashboard");
      }, 1500);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Connection failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const openSignUpModal = (planName: string) => {
    setSelectedPlan(planName);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
              GrowLocal AI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-300 hover:text-white transition">Features</a>
            <a href="#pricing" className="text-slate-300 hover:text-white transition">Pricing</a>
            <a href="#about" className="text-slate-300 hover:text-white transition">Value Proposition</a>
          </div>
          <div className="flex items-center gap-4">
            {isRegistered ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-purple-500/20"
              >
                Go to Dashboard
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-slate-300 hover:text-white text-sm font-semibold transition">
                  Log In
                </Link>
                <button
                  onClick={() => openSignUpModal("Starter")}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-purple-500/20"
                >
                  Sign Up Free
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_45%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                ⚡ Automate Your Local Marketing
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-none">
                The AI subscription that replaces a{" "}
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                  marketing agency
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                GrowLocal AI automates the three things small businesses are worst at: posting consistently on social media, responding to leads instantly, and collecting customer reviews.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => openSignUpModal("Pro")}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition shadow-xl shadow-purple-500/30 text-center"
                >
                  Start Your 14-Day Free Trial
                </button>
                <a
                  href="#features"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-lg px-8 py-4 rounded-xl transition border border-slate-700 hover:border-slate-600 text-center"
                >
                  See How It Works
                </a>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-8 pt-4 text-slate-400 text-sm">
                <div className="flex items-center gap-1.5">✅ No Credit Card Required</div>
                <div className="flex items-center gap-1.5">⭐ 5-Star Rating Setup</div>
              </div>
            </div>

            {/* Hero Card Visual */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 rounded-3xl blur-2xl -z-10" />
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl relative backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-900/50 px-2.5 py-1 rounded-md">Live AI Copilot</span>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-2">
                    <span className="text-xs text-purple-400 font-bold uppercase">review request automation</span>
                    <p className="text-sm font-semibold text-white">To: Sarah Jenkins (Recent Customer)</p>
                    <p className="text-xs text-slate-400">"Thanks for visiting! Would you mind leaving a quick review of your experience?"</p>
                    <div className="inline-flex gap-1 text-yellow-400 text-sm">⭐⭐⭐⭐⭐</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-2">
                    <span className="text-xs text-green-400 font-bold uppercase">ai social media scheduler</span>
                    <p className="text-sm font-semibold text-white">Draft Post - Barbershop/Salon Category</p>
                    <p className="text-xs text-slate-300">"Get ready for summer with a fresh fade and premium beard trim! Book your spot today. 💈✂️ #LocalBusiness #FreshCut"</p>
                    <div className="h-16 bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-slate-700">
                      [ AI Generated Barber Image ]
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Target Audience Showcase */}
      <section className="py-16 bg-slate-950 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Trusted by local service businesses everywhere</p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 items-center opacity-70">
            <span className="text-lg font-bold text-slate-300">💈 Barbershops</span>
            <span className="text-lg font-bold text-slate-300">💆‍♀️ Salons & Spas</span>
            <span className="text-lg font-bold text-slate-300">🍔 Restaurants</span>
            <span className="text-lg font-bold text-slate-300">🦷 Dentists</span>
            <span className="text-lg font-bold text-slate-300">🛠️ Contractors</span>
            <span className="text-lg font-bold text-slate-300">🚗 Auto Shops</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Automate the 3 marketing tasks you hate most</h2>
            <p className="text-lg text-slate-300">We do the work of a full-service marketing agency in the background, keeping your calendar booked and phone ringing.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/30 transition relative">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 text-2xl font-bold mb-6">
                💬
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Respond to Leads Instantly</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Our AI-powered chatbot embeds directly onto your website and Instagram to respond to prospective leads within 60 seconds. Say goodbye to lost customers.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/30 transition relative">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 text-2xl font-bold mb-6">
                📱
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Consistent Social Posts</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                GrowLocal automatically designs, writes, and schedules 3 on-brand social media posts every week with fully AI-generated images tailored perfectly to your local niche.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/30 transition relative">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 text-2xl font-bold mb-6">
                ⭐
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Collect 5-Star Reviews</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                GrowLocal triggers automated review requests via email and text right after customer visits, skyrocketing your Google Business ranking and search visibility.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section id="about" className="py-20 lg:py-32 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                The Smarter Way To Grow
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Why GrowLocal Replaces an Entire Marketing Agency
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Traditional marketing agencies charge thousands of dollars a month to manually draft social posts, manage basic chatbot widgets, and send review outreach. They operate on human timelines with constant delays.
              </p>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                GrowLocal AI productizes and automates these core services. By combining cutting-edge AI social media generation, instant lead response, and automated feedback workflows into a single subscription, you get better results at a fraction of the cost.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 text-xs font-bold">✓</div>
                  <span className="text-sm text-slate-300 font-semibold">90% Cost Reduction</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 text-xs font-bold">✓</div>
                  <span className="text-sm text-slate-300 font-semibold">Instant 24/7 Execution</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">
                Agency Comparison Table
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Features</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-400 text-right">GrowLocal AI</div>
                </div>
                <div className="border-b border-slate-900 pb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Monthly Cost</span>
                  <span className="font-bold text-green-400">$149.99 - $999.99 / mo</span>
                </div>
                <div className="border-b border-slate-900 pb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Response Speed</span>
                  <span className="font-bold text-white">Under 60 seconds (Instant)</span>
                </div>
                <div className="border-b border-slate-900 pb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Social Posts</span>
                  <span className="font-bold text-white">3x/week (Automated + On-brand)</span>
                </div>
                <div className="border-b border-slate-900 pb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Review Request Trigger</span>
                  <span className="font-bold text-white">Immediate SMS/Email flow</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">Human Management Needed</span>
                  <span className="font-bold text-slate-400">Zero (Full Autopilot)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 lg:py-32 bg-slate-950/40 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Simple, predictable pricing</h2>
            <p className="text-lg text-slate-300">Choose the tier that matches your business size and marketing needs.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between hover:border-purple-500/20 transition">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Starter</h3>
                  <div className="mt-4 flex items-baseline text-white">
                    <span className="text-5xl font-black tracking-tight">$149.99</span>
                    <span className="ml-1 text-xl font-semibold text-slate-400">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Perfect for new local service businesses getting started.</p>
                </div>
                <ul className="space-y-4 border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ 3x/week AI Social Posts</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Automated Google Review Requests</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Basic Website Q&A Chatbot</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Email Support</li>
                </ul>
              </div>
              {isRegistered ? (
                <a
                  href="https://buy.stripe.com/eVq9AT5pd2Ky5XUfgC2go00"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 block text-center w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Subscribe to Starter
                </a>
              ) : (
                <button
                  onClick={() => openSignUpModal("Starter")}
                  className="mt-8 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Choose Starter
                </button>
              )}
            </div>

            {/* Pro Plan (Best Value) */}
            <div className="bg-gradient-to-b from-purple-950/30 to-indigo-950/10 border-2 border-purple-500 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl">
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-purple-600 text-white text-xs font-black uppercase px-3 py-1 rounded-full tracking-wider">
                Best Value
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-purple-400 uppercase tracking-wider">Pro</h3>
                  <div className="mt-4 flex items-baseline text-white">
                    <span className="text-5xl font-black tracking-tight">$499.99</span>
                    <span className="ml-1 text-xl font-semibold text-slate-400">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">Ideal for growing businesses looking to dominate search results.</p>
                </div>
                <ul className="space-y-4 border-t border-purple-900/30 pt-6">
                  <li className="flex items-center gap-3 text-sm text-slate-100">🔥 All Starter Features</li>
                  <li className="flex items-center gap-3 text-sm text-slate-100">✅ AI Instagram DM Chatbot</li>
                  <li className="flex items-center gap-3 text-sm text-slate-100">✅ Interactive SEO Dashboard</li>
                  <li className="flex items-center gap-3 text-sm text-slate-100">✅ Monthly Performance Report</li>
                  <li className="flex items-center gap-3 text-sm text-slate-100">✅ 60-Second Lead Follow-up Automation</li>
                </ul>
              </div>
              {isRegistered ? (
                <a
                  href="https://buy.stripe.com/8x2bJ104T4SGcmi2tQ2go01"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 block text-center w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-purple-500/20"
                >
                  Subscribe to Pro
                </a>
              ) : (
                <button
                  onClick={() => openSignUpModal("Pro")}
                  className="mt-8 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-purple-500/20"
                >
                  Choose Pro
                </button>
              )}
            </div>

            {/* Premium Plan */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between hover:border-purple-500/20 transition">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Premium</h3>
                  <div className="mt-4 flex items-baseline text-white">
                    <span className="text-5xl font-black tracking-tight">$999.99</span>
                    <span className="ml-1 text-xl font-semibold text-slate-400">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Dedicated review of AI content by human marketing specialists.</p>
                </div>
                <ul className="space-y-4 border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-3 text-sm text-slate-300">🌟 All Pro Features</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Dedicated Human Review of AI Content</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Google Business Profile Management</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Competitor Tracking Dashboard</li>
                  <li className="flex items-center gap-3 text-sm text-slate-300">✅ Priority Support (Under 1 Hour response)</li>
                </ul>
              </div>
              {isRegistered ? (
                <a
                  href="https://buy.stripe.com/6oUfZheZNad0aea3xU2go02"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 block text-center w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Subscribe to Premium
                </a>
              ) : (
                <button
                  onClick={() => openSignUpModal("Premium")}
                  className="mt-8 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Choose Premium
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-12 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-2xl font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            GrowLocal AI
          </p>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} GrowLocal AI. All rights reserved. Made for Local Service Businesses.
          </p>
        </div>
      </footer>

      {/* Sign-Up Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-white">Create Your Account</h3>
              <p className="text-sm text-slate-400">Start your trial for the <span className="text-purple-400 font-semibold">{selectedPlan}</span> plan</p>
            </div>

            {isRegistered ? (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl p-4 text-center text-sm font-semibold">
                🎉 Success! Account created. Welcome aboard. Your business is being connected to our AI pipeline.
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Business Name</label>
                  <input
                    type="text"
                    name="businessName"
                    required
                    value={formData.businessName}
                    onChange={handleInputChange}
                    placeholder="Apex Barbershop"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Business Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  >
                    <option value="Barbershop">💈 Barbershop</option>
                    <option value="Salon & Spa">💆‍♀️ Salon & Spa</option>
                    <option value="Restaurant">🍔 Restaurant</option>
                    <option value="Dentist">🦷 Dentist</option>
                    <option value="Contractor">🛠️ Contractor</option>
                    <option value="Auto Shop">🚗 Auto Shop</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>

                {message && (
                  <div className={`p-3 rounded-lg text-xs font-semibold ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 text-sm"
                >
                  {loading ? "Creating Account..." : "Start 14-Day Free Trial"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
