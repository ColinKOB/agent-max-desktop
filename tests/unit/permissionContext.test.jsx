import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionProvider, usePermission } from '../../src/contexts/PermissionContext';

vi.mock('../../src/services/api', () => ({
  permissionAPI: {
    getLevel: vi.fn().mockResolvedValue({ permission_level: 'chatty' }),
    updateLevel: vi.fn().mockResolvedValue({ success: true }),
  },
}));

function CurrentMode() {
  const { level } = usePermission();
  return <span>{level}</span>;
}

describe('PermissionProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies permission changes sent through the storage event', async () => {
    render(
      <PermissionProvider>
        <CurrentMode />
      </PermissionProvider>
    );

    await waitFor(() => expect(screen.getByText('chatty')).toBeTruthy());

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'permission_level',
        newValue: 'autonomous',
      })
    );

    await waitFor(() => expect(screen.getByText('autonomous')).toBeTruthy());
  });
});
