import { useState, useEffect } from 'react';
import { MessageSquare, User, Bot, Clock, RefreshCw, Search, AlertCircle } from 'lucide-react';
import { conversationAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ChatHistory() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState([]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const response = await conversationAPI.getHistory(50, 0);
      const convos = response.data.conversations || [];
      setConversations(convos);
      setFilteredConversations(convos);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = conversations.filter(conv => {
        const messages = conv.messages || [];
        return messages.some(msg => 
          msg.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchQuery, conversations]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConversationSummary = (messages) => {
    if (!messages || messages.length === 0) return 'Empty conversation';
    
    // Find first user message
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 100) + 
             (firstUserMessage.content.length > 100 ? '...' : '');
    }
    
    return messages[0].content.slice(0, 100) + 
           (messages[0].content.length > 100 ? '...' : '');
  };

  const detectGoogleServiceUsage = (messages) => {
    const services = {
      gmail: false,
      calendar: false,
      youtube: false,
      sheets: false,
      docs: false
    };

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      if (content.includes('email') || content.includes('gmail') || content.includes('inbox')) {
        services.gmail = true;
      }
      if (content.includes('calendar') || content.includes('event') || content.includes('meeting')) {
        services.calendar = true;
      }
      if (content.includes('youtube') || content.includes('video')) {
        services.youtube = true;
      }
      if (content.includes('sheet') || content.includes('spreadsheet')) {
        services.sheets = true;
      }
      if (content.includes('doc') || content.includes('document')) {
        services.docs = true;
      }
    });

    return services;
  };

  return (
    <div className="chat-history h-full flex">
      {/* Conversations List */}
      <div className="w-1/3 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Chat History</h3>
            <button
              onClick={loadConversations}
              disabled={loading}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv, index) => {
              const isSelected = selectedConversation?.id === conv.id;
              const services = detectGoogleServiceUsage(conv.messages || []);
              const hasGoogleServices = Object.values(services).some(v => v);
              
              return (
                <div
                  key={conv.id || index}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 cursor-pointer border-b border-gray-700 hover:bg-gray-800 transition-colors ${
                    isSelected ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium line-clamp-2">
                      {getConversationSummary(conv.messages)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(conv.timestamp || conv.created_at)}
                      </span>
                    </div>
                    {hasGoogleServices && (
                      <div className="flex gap-1">
                        {services.gmail && <span className="text-xs px-1 bg-red-900 text-red-300 rounded" title="Used Gmail">G</span>}
                        {services.calendar && <span className="text-xs px-1 bg-blue-900 text-blue-300 rounded" title="Used Calendar">C</span>}
                        {services.youtube && <span className="text-xs px-1 bg-red-900 text-red-300 rounded" title="Used YouTube">Y</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation Details */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold mb-1">Conversation Details</h3>
              <p className="text-sm text-gray-400">
                {formatTimestamp(selectedConversation.timestamp || selectedConversation.created_at)}
                {' • '}
                {selectedConversation.messages?.length || 0} messages
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages?.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    msg.role === 'user' 
                      ? 'bg-blue-600' 
                      : 'bg-gray-700'
                  }`}>
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  
                  <div className={`flex-1 ${
                    msg.role === 'user' ? 'text-right' : ''
                  }`}>
                    <p className="text-xs text-gray-500 mb-1">
                      {msg.role === 'user' ? 'You' : 'Agent Max'}
                    </p>
                    <div className={`inline-block p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-900 text-blue-100'
                        : 'bg-gray-800 text-gray-100'
                    }`}>
                      <pre className="whitespace-pre-wrap text-sm font-normal">
                        {msg.content}
                      </pre>
                      
                      {/* Show if this message triggered Google services */}
                      {msg.metadata?.google_services_used && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <p className="text-xs text-gray-400">Used Google Services:</p>
                          <div className="flex gap-2 mt-1">
                            {msg.metadata.google_services_used.map(service => (
                              <span key={service} className="text-xs px-2 py-1 bg-gray-700 rounded">
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Show any error info */}
                      {msg.error && (
                        <div className="mt-2 pt-2 border-t border-red-600">
                          <div className="flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-xs">Error: {msg.error}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a conversation to view details</p>
              <p className="text-sm mt-2 text-gray-600">
                This shows all chat history for debugging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
