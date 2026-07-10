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

  it('coerces legacy chatty responses from the backend to autonomous', async () => {
    render(
      <PermissionProvider>
        <CurrentMode />
      </PermissionProvider>
    );

    await waitFor(() => expect(screen.getByText('autonomous')).toBeTruthy());
  });

  it('stays autonomous when a storage event carries a retired mode', async () => {
    render(
      <PermissionProvider>
        <CurrentMode />
      </PermissionProvider>
    );

    await waitFor(() => expect(screen.getByText('autonomous')).toBeTruthy());

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'permission_level',
        newValue: 'chatty',
      })
    );

    await waitFor(() => expect(screen.getByText('autonomous')).toBeTruthy());
  });
});
