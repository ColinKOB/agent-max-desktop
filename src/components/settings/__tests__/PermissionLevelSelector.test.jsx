import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PermissionLevelSelector from '../PermissionLevelSelector';

// Mock permissionAPI
jest.mock('../../../services/api', () => ({
  permissionAPI: {
    updateLevel: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('PermissionLevelSelector', () => {
  it('renders both permission levels', () => {
    render(<PermissionLevelSelector currentLevel="chatty" onChange={() => {}} />);
    expect(screen.getByText(/Chatty/i)).toBeInTheDocument();
    expect(screen.getByText(/Autonomous/i)).toBeInTheDocument();
  });

  it('calls onChange and updates via API on selection', async () => {
    const onChange = jest.fn();
    const { permissionAPI } = require('../../../services/api');

    render(<PermissionLevelSelector currentLevel="chatty" onChange={onChange} />);

    fireEvent.click(screen.getByText(/Autonomous/i));

    await waitFor(() => {
      expect(permissionAPI.updateLevel).toHaveBeenCalledWith('autonomous');
      expect(onChange).toHaveBeenCalledWith('autonomous');
    });
  });
});
