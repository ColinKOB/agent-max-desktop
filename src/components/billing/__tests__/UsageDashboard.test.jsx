/**
 * Unit Tests for UsageDashboard Component
 * Tests billing dashboard functionality and display
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UsageDashboard } from '../UsageDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';

// Mock axios
jest.mock('axios');

// Mock recharts to avoid canvas issues in tests
jest.mock('recharts', () => ({
  LineChart: () => <div>LineChart</div>,
  Line: () => <div>Line</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  CartesianGrid: () => <div>CartesianGrid</div>,
  Tooltip: () => <div>Tooltip</div>,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('UsageDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders current usage', async () => {
    const mockUsageData = {
      current_month: {
        conversation_count: 42,
        estimated_cost: 126.00,
      },
      daily_usage: [
        { date: '2025-10-01', count: 5, cost: 15.00 },
        { date: '2025-10-02', count: 3, cost: 9.00 },
      ],
    };

    axios.get.mockResolvedValueOnce({ data: mockUsageData });

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('$126.00')).toBeInTheDocument();
    });
  });

  test('shows estimated cost', async () => {
    const mockUsageData = {
      current_month: {
        conversation_count: 10,
        estimated_cost: 30.00,
      },
      daily_usage: [],
    };

    axios.get.mockResolvedValueOnce({ data: mockUsageData });

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('$30.00')).toBeInTheDocument();
      expect(screen.getByText(/Estimated Cost/i)).toBeInTheDocument();
    });
  });

  test('displays chart', async () => {
    const mockUsageData = {
      current_month: {
        conversation_count: 5,
        estimated_cost: 15.00,
      },
      daily_usage: [
        { date: '2025-10-01', count: 2, cost: 6.00 },
        { date: '2025-10-02', count: 3, cost: 9.00 },
      ],
    };

    axios.get.mockResolvedValueOnce({ data: mockUsageData });

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('LineChart')).toBeInTheDocument();
    });
  });

  test('handles loading state', () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });

  test('handles error state', async () => {
    axios.get.mockRejectedValueOnce(new Error('API Error'));

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Unable to load usage data/i)).toBeInTheDocument();
      expect(screen.getByText(/Retry/i)).toBeInTheDocument();
    });
  });

  test('refreshes data on demand', async () => {
    const mockUsageData = {
      current_month: {
        conversation_count: 10,
        estimated_cost: 30.00,
      },
      daily_usage: [],
    };

    axios.get.mockResolvedValue({ data: mockUsageData });

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    const refreshButton = screen.getByLabelText(/refresh/i);
    fireEvent.click(refreshButton);

    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('shows quota warning when near limit', async () => {
    const mockUsageData = {
      current_month: {
        conversation_count: 45,
        estimated_cost: 135.00,
        limit: 50,
      },
      daily_usage: [],
    };

    axios.get.mockResolvedValueOnce({ data: mockUsageData });

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/90% of monthly limit/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    });
  });

  test('formats large numbers correctly', async () => {
    const mockUsageData = {
      current_month: {
        conversation_count: 1234,
        estimated_cost: 3702.00,
      },
      daily_usage: [],
    };

    axios.get.mockResolvedValueOnce({ data: mockUsageData });

    render(<UsageDashboard tenantId="test-tenant" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('$3,702.00')).toBeInTheDocument();
    });
  });
});
