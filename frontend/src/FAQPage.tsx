import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import faqData from "./faqData";

export default function FAQPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const filteredFaq = useMemo(() => {
    return faqData.filter((section) => {
      // Filter by tier
      if (tierFilter !== "all" && section.tier !== "all" && section.tier !== tierFilter) {
        return false;
      }

      // Filter by search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchingQuestions = section.questions.filter(
          (qa) => qa.q.toLowerCase().includes(q) || qa.a.toLowerCase().includes(q)
        );
        if (matchingQuestions.length === 0) return false;
        return true;
      }

      return true;
    });
  }, [searchQuery, tierFilter]);

  const tierOptions = [
    { id: "all", label: "All Plans" },
    { id: "starter", label: "Starter" },
    { id: "pro_premium", label: "Pro & Premium" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="text-sm text-purple-400 hover:text-purple-300 transition">
          ← Back
        </button>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white">Help & FAQ</h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Everything you need to know about using GrowLocal AI for your business marketing.
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQ..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-white focus:outline-none focus:border-purple-500 text-sm"
          />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2">
          {tierOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTierFilter(opt.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                tierFilter === opt.id
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Sections */}
      {filteredFaq.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="text-5xl">🔍</div>
          <h3 className="text-lg font-bold text-white">No Results Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            No FAQ entries match your search. Try different keywords or browse all categories.
          </p>
          <button
            onClick={() => { setSearchQuery(""); setTierFilter("all"); }}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        filteredFaq.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-white">{section.category}</h2>
              {section.tier !== "all" && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {section.tier === "pro_premium" ? "Pro & Premium" : section.tier}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {section.questions
                .filter(
                  (qa) =>
                    !searchQuery.trim() ||
                    qa.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    qa.a.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((qa, qIdx) => (
                  <div
                    key={qIdx}
                    className="bg-slate-800/30 border border-slate-800 rounded-xl overflow-hidden transition hover:border-slate-700"
                  >
                    <button
                      onClick={() =>
                        setExpandedQuestion(expandedQuestion === `${idx}-${qIdx}` ? null : `${idx}-${qIdx}`)
                      }
                      className="w-full text-left p-4 flex items-center justify-between gap-4"
                    >
                      <span className="text-sm font-semibold text-white flex-1">{qa.q}</span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          expandedQuestion === `${idx}-${qIdx}` ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedQuestion === `${idx}-${qIdx}` && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-slate-300 leading-relaxed border-t border-slate-800 pt-3">
                          {qa.a}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))
      )}

      {/* Still need help? */}
      <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/10 border border-purple-500/20 rounded-2xl p-6 sm:p-8 text-center space-y-4">
        <div className="text-4xl">💬</div>
        <h3 className="text-lg font-bold text-white">Still have questions?</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Our AI support bot is available 24/7, or you can open a support ticket for personalized help.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate("/dashboard?tab=faq")}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition"
          >
            Ask AI Support
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold px-6 py-2 rounded-lg transition border border-slate-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}