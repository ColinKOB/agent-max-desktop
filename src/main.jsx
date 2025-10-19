import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import SettingsApp from './pages/SettingsApp.jsx';
import UITestDashboard from './pages/UITestDashboard.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/globals.css';
import './styles/liquid-glass.css';
import './styles/liquid-glass-enhanced.css';
import './styles/design-system.css';
import './styles/accessibility.css';

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
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
