import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import LoginPage from "./LoginPage";
import AdminPanel from "./AdminPanel";
import OnboardingWizard from "./OnboardingWizard";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
