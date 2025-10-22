/**
 * Billing History Component
 * 
 * Displays comprehensive billing history with filtering and export capabilities
 */
import { useState, useEffect } from 'react';
import { 
  Download, 
  Receipt, 
  Search, 
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import apiConfigManager from '../../config/apiConfig';

export function BillingHistory({ tenantId = 'test-tenant-001' }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchInvoices();
  }, [tenantId, currentPage, filterStatus, dateRange]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const apiUrl = apiConfigManager.getConfig().baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        status: filterStatus !== 'all' ? filterStatus : '',
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      const endpoint = `${apiUrl}/api/v2/billing/invoices/${encodeURIComponent(tenantId)}?${params}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        let detail = '';
        try {
          const data = await response.json();
          detail = data?.detail || data?.error || JSON.stringify(data);
        } catch {
          try { detail = await response.text(); } catch {}
        }
        if (response.status === 404) {
          setInvoices([]);
          setTotalPages(1);
          setError(null);
          return;
        }
        throw new Error(`Invoices ${response.status} ${response.statusText} — ${detail || 'no details'}`);
      }
      
      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalPages(Math.ceil((data.total || 0) / itemsPerPage));
      setError(null);
    } catch (err) {
      console.error('[BillingHistory] Error fetching invoices', {
        tenantId,
        baseURL: apiConfigManager.getConfig().baseURL,
        message: err?.message,
      });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId, format = 'pdf') => {
    try {
      const apiUrl = apiConfigManager.getConfig().baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/api/v2/billing/invoice/${encodeURIComponent(invoiceId)}/download?format=${encodeURIComponent(format)}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        let detail = '';
        try {
          const data = await response.json();
          detail = data?.detail || data?.error || JSON.stringify(data);
        } catch {
          try { detail = await response.text(); } catch {}
        }
        throw new Error(`Download ${response.status} ${response.statusText} — ${detail || 'no details'}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[BillingHistory] Download error', {
        invoiceId,
        baseURL: apiConfigManager.getConfig().baseURL,
        message: err?.message,
      });
    }
  };

  const exportToCSV = async () => {
    try {
      const apiUrl = apiConfigManager.getConfig().baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/api/v2/billing/export/${encodeURIComponent(tenantId)}?format=csv`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        let detail = '';
        try {
          const data = await response.json();
          detail = data?.detail || data?.error || JSON.stringify(data);
        } catch {
          try { detail = await response.text(); } catch {}
        }
        throw new Error(`Export ${response.status} ${response.statusText} — ${detail || 'no details'}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[BillingHistory] Export error', {
        tenantId,
        baseURL: apiConfigManager.getConfig().baseURL,
        message: err?.message,
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm && !invoice.id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading && invoices.length === 0) {
    return (
      <div className="billing-history p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-history">
      {/* Header */}
      <div className="header mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Billing History
        </h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="filters mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Invoice List */}
      {error ? (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300">Error loading invoices: {error}</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state text-center py-12">
          <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No invoices found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your filters'
              : 'Your invoices will appear here at the end of each billing period'
            }
          </p>
        </div>
      ) : (
        <div className="invoice-list space-y-3">
          {filteredInvoices.map((invoice) => (
            <div 
              key={invoice.id}
              className="invoice-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                {/* Invoice Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      Invoice #{invoice.id.slice(-8).toUpperCase()}
                    </h4>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Date</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {format(new Date(invoice.date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Amount</span>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        ${invoice.amount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Conversations</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {invoice.itemCount}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Period</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {format(new Date(invoice.periodStart), 'MMM dd')} - {format(new Date(invoice.periodEnd), 'MMM dd')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => downloadInvoice(invoice.id, 'pdf')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Download PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => window.open(`/billing/invoice/${invoice.id}`, '_blank')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Receipt className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
