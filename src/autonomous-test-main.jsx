/**
 * Entry point for autonomous test page
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AutonomousTestPage } from './pages/AutonomousTestPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AutonomousTestPage />
  </React.StrictMode>
);
