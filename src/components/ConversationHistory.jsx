import { useState, useEffect } from 'react';
import { History, Clock, MessageSquare, Loader2, Search, X } from 'lucide-react';
import { conversationAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ConversationHistory({ onLoadConversation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConv, setSelectedConv] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      console.log('[History] Starting to load history...');
      console.log('[History] Checking for Electron API:', !!window.electron);
      console.log('[History] Checking for memory API:', !!window.electron?.memory);
      console.log(
        '[History] Checking for getAllSessions:',
        !!window.electron?.memory?.getAllSessions
      );

      // Check if Electron memory API is available
      if (window.electron?.memory?.getAllSessions) {
        console.log('[History] Calling getAllSessions...');
        // Load ALL sessions from Electron local memory (no limit!)
        const allSessions = await window.electron.memory.getAllSessions();

        console.log('[History] Raw sessions received:', allSessions?.length || 0);
        console.log('[History] First session:', allSessions?.[0]);

        // Transform sessions into conversation format
        const convs = allSessions.map((session) => {
          const firstUserMsg = session.messages.find((m) => m.role === 'user');
          const lastMessage = session.messages[session.messages.length - 1];

          console.log(
            `[History] Processing session ${session.sessionId}: ${session.messages.length} messages`
          );

          return {
            id: session.sessionId,
            summary: firstUserMsg
              ? firstUserMsg.content.substring(0, 60) +
                (firstUserMsg.content.length > 60 ? '...' : '')
              : `Conversation (${session.messages.length} messages)`,
            messages: session.messages,
            created_at: session.started_at,
            updated_at: lastMessage?.timestamp || session.started_at,
            message_count: session.messages.length,
          };
        });

        console.log(`[History] Loaded ${convs.length} conversations from local storage`);
        console.log('[History] Conversations:', convs);
        setConversations(convs);
      } else {
        // Fallback to API (for web version)
        const res = await conversationAPI.getHistory(50, 0);
        setConversations(res.data.conversations || []);
      }
    } catch (error) {
      console.error('[History] Failed to load conversation history:', error);
      console.error('[History] Error stack:', error.stack);
      toast.error(`Failed to load history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationDetails = async (convId) => {
    try {
      // Find conversation in loaded conversations
      const conv = conversations.find((c) => c.id === convId);
      if (conv) {
        setSelectedConv(conv);
        setViewingDetails(true);
      } else {
        toast.error('Conversation not found');
      }
    } catch (error) {
      toast.error('Failed to load conversation');
    }
  };

  const handleLoadConversation = () => {
    if (selectedConv && onLoadConversation) {
      onLoadConversation(selectedConv);
      toast.success('Conversation loaded!');
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (viewingDetails && selectedConv) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-gray-100">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setViewingDetails(false)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            >
              <X className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleLoadConversation}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            >
              Load Conversation
            </button>
          </div>
          <div className="text-sm font-semibold">{selectedConv.summary || 'Conversation'}</div>
          <div className="text-xs text-gray-400">{selectedConv.messages?.length || 0} messages</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {selectedConv.messages?.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded text-xs ${
                msg.role === 'user'
                  ? 'bg-blue-900/30 border border-blue-700/30'
                  : 'bg-gray-800 border border-gray-700'
              }`}
            >
              <div className="font-semibold text-[10px] text-gray-400 mb-1 uppercase">
                {msg.role}
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold">Conversation History</h2>
          <span className="text-xs text-gray-400">({conversations.length})</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-gray-700 border border-gray-600 rounded pl-8 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-xs">
              {searchQuery ? 'No matching conversations' : 'No conversation history yet'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversationDetails(conv.id)}
                className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors border border-gray-700"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold text-gray-200 line-clamp-1">
                    {conv.summary || 'Conversation'}
                  </span>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {conv.message_count} messages
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(conv.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
