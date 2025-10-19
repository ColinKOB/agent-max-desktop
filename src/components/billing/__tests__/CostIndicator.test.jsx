/**
 * Unit Tests for CostIndicator Component
 * Tests real-time cost display and updates
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CostIndicator } from '../CostFeedback';
import useStore from '../../../store/useStore';

// Mock the store
jest.mock('../../../store/useStore');

describe('CostIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('updates in realtime', async () => {
    const mockStore = {
      sessionCost: 0,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    const { rerender } = render(<CostIndicator currentCost={0} isActive={true} />);

    expect(screen.getByText('$0.00')).toBeInTheDocument();

    // Update cost
    rerender(<CostIndicator currentCost={3.00} isActive={true} />);

    await waitFor(() => {
      expect(screen.getByText('$3.00')).toBeInTheDocument();
    });

    // Update again
    rerender(<CostIndicator currentCost={6.00} isActive={true} />);

    await waitFor(() => {
      expect(screen.getByText('$6.00')).toBeInTheDocument();
    });
  });

  test('shows session cost', () => {
    const mockStore = {
      sessionCost: 15.75,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={3.00} isActive={false} />);

    expect(screen.getByText('$3.00')).toBeInTheDocument();
    expect(screen.getByText(/session total/i)).toBeInTheDocument();
    expect(screen.getByText('$15.75')).toBeInTheDocument();
  });

  test('shows monthly total', () => {
    const mockStore = {
      sessionCost: 10.00,
      monthlyTotal: 150.00,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={3.00} isActive={false} showMonthly={true} />);

    expect(screen.getByText('$3.00')).toBeInTheDocument();
    expect(screen.getByText(/monthly total/i)).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });

  test('animates when active', () => {
    const mockStore = {
      sessionCost: 0,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={3.00} isActive={true} />);

    const indicator = screen.getByTestId('cost-indicator');
    expect(indicator).toHaveClass('animate-pulse');
  });

  test('no animation when inactive', () => {
    const mockStore = {
      sessionCost: 0,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={3.00} isActive={false} />);

    const indicator = screen.getByTestId('cost-indicator');
    expect(indicator).not.toHaveClass('animate-pulse');
  });

  test('updates session cost in store', () => {
    const mockStore = {
      sessionCost: 10.00,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={3.00} isActive={false} />);

    expect(mockStore.setSessionCost).toHaveBeenCalledWith(13.00);
  });

  test('shows cost breakdown on hover', async () => {
    const mockStore = {
      sessionCost: 10.00,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={3.00} isActive={false} showBreakdown={true} />);

    const indicator = screen.getByTestId('cost-indicator');
    
    // Simulate hover
    act(() => {
      indicator.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText(/base rate: \$3\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/per conversation/i)).toBeInTheDocument();
    });
  });

  test('formats large costs correctly', () => {
    const mockStore = {
      sessionCost: 1234.56,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={789.12} isActive={false} />);

    expect(screen.getByText('$789.12')).toBeInTheDocument();
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  test('handles zero cost', () => {
    const mockStore = {
      sessionCost: 0,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    render(<CostIndicator currentCost={0} isActive={false} />);

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  test('auto-hides after timeout when not active', () => {
    const mockStore = {
      sessionCost: 10.00,
      setSessionCost: jest.fn(),
    };
    useStore.mockReturnValue(mockStore);

    const { container } = render(
      <CostIndicator currentCost={3.00} isActive={false} autoHide={true} />
    );

    expect(container.firstChild).toBeInTheDocument();

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(container.firstChild).toHaveStyle({ opacity: '0' });
  });
});
