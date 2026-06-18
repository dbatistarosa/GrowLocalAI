import { useState } from "react";
import { useNavigate } from "react-router-dom";

const STEPS = [
  { id: 1, title: "Business Profile", icon: "🏪" },
  { id: 2, title: "Upload Media", icon: "📸" },
  { id: 3, title: "Services", icon: "💈" },
  { id: 4, title: "Connect Accounts", icon: "🔗" },
  { id: 5, title: "Chatbot Setup", icon: "🤖" },
  { id: 6, title: "Review Posts", icon: "📱" },
  { id: 7, title: "Review Requests", icon: "⭐" }
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);

  const markComplete = (step: number) => {
    if (!completed.includes(step)) setCompleted(c => [...c, step]);
  };
  const nextStep = () => { markComplete(currentStep); if (currentStep < 7) setCurrentStep(currentStep + 1); };
  const skipStep = () => { if (currentStep < 7) setCurrentStep(currentStep + 1); };
  const finishOnboarding = () => { markComplete(currentStep); navigate("/dashboard"); };
  const isLastStep = currentStep === 7;
  const progressPct = Math.round((completed.length / 7) * 100);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <span className="text-3xl">🚀</span>
          <h1 className="text-3xl font-black text-white">Set Up Your Business</h1>
          <p className="text-slate-400 text-sm">Let's get your business ready for AI-powered marketing</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progress</span><span>{completed.length}/7 steps</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="flex justify-between">
          {STEPS.map(step => (
            <div key={step.id} className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={() => { if (completed.includes(step.id) || step.id <= currentStep) setCurrentStep(step.id); }}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${
                step.id === currentStep ? "bg-purple-600 text-white ring-2 ring-purple-400" :
                completed.includes(step.id) ? "bg-green-600 text-white" : "bg-slate-800 text-slate-500"
              }`}>{completed.includes(step.id) ? "✓" : step.id}</div>
              <span className="text-[10px] hidden sm:block text-slate-500">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center py-8">
            <span className="text-5xl mb-4 block">{STEPS[currentStep - 1].icon}</span>
            <h2 className="text-xl font-bold text-white mb-2">{STEPS[currentStep - 1].title}</h2>
            <p className="text-slate-400 text-sm mb-6">Step {currentStep} of 7</p>
            <p className="text-slate-300 max-w-md mx-auto">
              {currentStep === 1 && "Fill in your business name, address, phone, hours, and website."}
              {currentStep === 2 && "Upload your logo and business photos to personalize your AI content."}
              {currentStep === 3 && "List the services you offer with prices and durations."}
              {currentStep === 4 && "Connect Instagram, Google Business Profile, and WhatsApp."}
              {currentStep === 5 && "Customize your AI chatbot greeting and knowledge base."}
              {currentStep === 6 && "Preview and approve your first batch of AI-generated posts."}
              {currentStep === 7 && "Set up automated review requests to collect 5-star reviews."}
            </p>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button onClick={() => { if (currentStep > 1) setCurrentStep(currentStep - 1); }}
              className="text-sm text-slate-400 hover:text-white transition disabled:opacity-30" disabled={currentStep === 1}>
              ← Previous
            </button>
            <div className="flex gap-2">
              <button onClick={skipStep} className="text-xs text-slate-500 hover:text-slate-300 transition px-3 py-2">Skip</button>
              <button onClick={isLastStep ? finishOnboarding : nextStep}
                className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition">
                {isLastStep ? "🎉 Go to Dashboard" : "Continue →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
