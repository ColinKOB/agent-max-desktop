import { render, screen } from '@testing-library/react';

import PermissionLevelSelector from '../PermissionLevelSelector';

describe('PermissionLevelSelector', () => {
  it('shows autonomous execution and approval boundaries', () => {
    render(<PermissionLevelSelector />);

    expect(screen.getByText('Auto is active')).toBeTruthy();
    expect(screen.getByText(/Sensitive actions still require approval/i)).toBeTruthy();
    expect(screen.queryByText(/Chatty/i)).toBeNull();
  });
});
