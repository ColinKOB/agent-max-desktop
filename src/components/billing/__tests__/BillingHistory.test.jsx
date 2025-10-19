/**
 * Unit Tests for BillingHistory Component
 * Tests invoice list, filtering, and download functionality
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BillingHistory } from '../BillingHistory';
import axios from 'axios';

jest.mock('axios');

// Mock file download
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('BillingHistory', () => {
  const mockInvoices = [
    {
      id: 'inv_001',
      date: '2025-10-01',
      amount: 150.00,
      status: 'paid',
      pdf_url: 'https://example.com/invoice1.pdf',
      description: 'October 2025',
    },
    {
      id: 'inv_002',
      date: '2025-09-01',
      amount: 120.00,
      status: 'paid',
      pdf_url: 'https://example.com/invoice2.pdf',
      description: 'September 2025',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders invoice list', async () => {
    axios.get.mockResolvedValueOnce({ 
      data: { invoices: mockInvoices, total: 2, page: 1 } 
    });

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText('October 2025')).toBeInTheDocument();
      expect(screen.getByText('September 2025')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
      expect(screen.getByText('$120.00')).toBeInTheDocument();
    });
  });

  test('filters by date', async () => {
    axios.get.mockResolvedValueOnce({ 
      data: { invoices: mockInvoices, total: 2, page: 1 } 
    });

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText('October 2025')).toBeInTheDocument();
    });

    // Set date filter
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2025-09-01' } });
    fireEvent.change(endDateInput, { target: { value: '2025-09-30' } });
    
    const filterButton = screen.getByRole('button', { name: /filter/i });
    fireEvent.click(filterButton);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('start_date=2025-09-01&end_date=2025-09-30')
    );
  });

  test('downloads PDF', async () => {
    axios.get.mockResolvedValueOnce({ 
      data: { invoices: mockInvoices, total: 2, page: 1 } 
    });

    const mockPdfBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    global.fetch = jest.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(mockPdfBlob),
      })
    );

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText('October 2025')).toBeInTheDocument();
    });

    const downloadButton = screen.getAllByLabelText(/download/i)[0];
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/invoice1.pdf');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  test('pagination works', async () => {
    axios.get.mockResolvedValueOnce({ 
      data: { invoices: mockInvoices, total: 10, page: 1, per_page: 2 } 
    });

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText('October 2025')).toBeInTheDocument();
    });

    // Click next page
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('page=2')
    );
  });

  test('handles empty state', async () => {
    axios.get.mockResolvedValueOnce({ 
      data: { invoices: [], total: 0, page: 1 } 
    });

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText(/no invoices found/i)).toBeInTheDocument();
    });
  });

  test('exports to CSV', async () => {
    axios.get.mockResolvedValueOnce({ 
      data: { invoices: mockInvoices, total: 2, page: 1 } 
    });

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText('October 2025')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(exportButton);

    // Verify CSV download initiated
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  test('shows invoice status correctly', async () => {
    const invoicesWithStatus = [
      { ...mockInvoices[0], status: 'paid' },
      { 
        id: 'inv_003',
        date: '2025-10-15',
        amount: 100.00,
        status: 'pending',
        description: 'Pending Invoice',
      },
    ];

    axios.get.mockResolvedValueOnce({ 
      data: { invoices: invoicesWithStatus, total: 2, page: 1 } 
    });

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText(/paid/i)).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  test('handles API error gracefully', async () => {
    axios.get.mockRejectedValueOnce(new Error('API Error'));

    render(<BillingHistory tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load billing history/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
