import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PermissionLevelSelector from '../PermissionLevelSelector';

// Mock permissionAPI
jest.mock('../../../services/api', () => ({
  permissionAPI: {
    updateLevel: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('PermissionLevelSelector', () => {
  it('renders all three levels', () => {
    render(<PermissionLevelSelector currentLevel="helpful" onChange={() => {}} />);
    expect(screen.getByText(/Chatty/i)).toBeInTheDocument();
    expect(screen.getByText(/Helpful/i)).toBeInTheDocument();
    expect(screen.getByText(/Powerful/i)).toBeInTheDocument();
  });

  it('calls onChange and updates via API on selection', async () => {
    const onChange = jest.fn();
    const { permissionAPI } = require('../../../services/api');

    render(<PermissionLevelSelector currentLevel="helpful" onChange={onChange} />);

    fireEvent.click(screen.getByText(/Powerful/i));

    await waitFor(() => {
      expect(permissionAPI.updateLevel).toHaveBeenCalledWith('powerful');
      expect(onChange).toHaveBeenCalledWith('powerful');
    });
  });
});
