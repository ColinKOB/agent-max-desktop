import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import SettingsApp from './pages/SettingsApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/settings" element={<SettingsApp />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
