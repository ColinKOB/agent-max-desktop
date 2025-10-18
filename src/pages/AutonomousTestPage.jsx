/**
 * Autonomous Test Page
 * 
 * Standalone page for testing the autonomous execution flow
 */

import { AutonomousTest } from '../components/AutonomousTest';

export function AutonomousTestPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '20px'
    }}>
      <AutonomousTest />
    </div>
  );
}

export default AutonomousTestPage;
