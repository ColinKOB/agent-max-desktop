import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import SettingsApp from './pages/SettingsApp.jsx';
import UITestDashboard from './pages/UITestDashboard.jsx';
import OnboardingPreview from './pages/OnboardingPreview.jsx';
import ExecutionProgressTest from './pages/ExecutionProgressTest.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { preloadModel } from './services/embeddings.js';
import './styles/globals.css';
import './styles/liquid-glass.css';
import './styles/liquid-glass-enhanced.css';
import './styles/design-system.css';
import './styles/accessibility.css';
import './styles/premium-glass.css';
import './styles/premium-enhancements.css';

// ==========================================
// PRELOAD: Start embedding model loading early to eliminate cold-start delay
// This runs async and doesn't block the UI render
// ==========================================
setTimeout(() => {
  const useHybridSearch = localStorage.getItem('use_hybrid_search') !== '0';
  if (useHybridSearch) {
    console.log('[Startup] Preloading embedding model for semantic search...');
    preloadModel().catch(err => console.warn('[Startup] Embedding preload failed:', err));
  }
}, 100); // Small delay to not compete with initial render

// Add platform class for glass tuning (avoid double-blur on mac vibrancy, etc.)
const ua = navigator.userAgent || '';
const isMac = /Macintosh|Mac OS X/.test(ua);
const isWin = /Windows/.test(ua);
const isLinux = /Linux/.test(ua);
if (isMac) document.documentElement.classList.add('platform-mac');
else if (isWin) document.documentElement.classList.add('platform-win');
else if (isLinux) document.documentElement.classList.add('platform-linux');

const PillApp = () => <App windowMode="pill" />;
const CardApp = () => <App windowMode="card" />;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/pill" element={<PillApp />} />
          <Route path="/card" element={<CardApp />} />
          <Route path="/settings" element={<SettingsApp />} />
          <Route path="/test" element={<UITestDashboard />} />
          <Route path="/onboarding" element={<OnboardingPreview />} />
          <Route path="/execution-test" element={<ExecutionProgressTest />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
