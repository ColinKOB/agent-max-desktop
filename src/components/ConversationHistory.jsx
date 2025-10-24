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
      let sessions = [];

      if (window.electron?.memory?.getAllSessions) {
        try {
          const all = await window.electron.memory.getAllSessions();
          if (Array.isArray(all) && all.length) sessions = all;
        } catch {}
      }

      // Fallback: try full export and extract sessions
      if ((!sessions || sessions.length === 0) && window.electron?.memory?.export) {
        try {
          const dump = await window.electron.memory.export();
          const fromDump = Array.isArray(dump?.sessions)
            ? dump.sessions
            : Array.isArray(dump?.conversations)
            ? dump.conversations
            : [];
          if (fromDump.length) sessions = fromDump;
        } catch {}
      }

      // Web/API fallback
      if (!sessions || sessions.length === 0) {
        try {
          const res = await conversationAPI.getHistory(50, 0);
          const apiConvs = res?.data?.conversations || [];
          setConversations(apiConvs);
          return;
        } catch {}
      }

      const GAP_MS = 2 * 60 * 60 * 1000;
      const convs = [];

      (sessions || []).forEach((session) => {
        const all = session.messages || session?.data?.messages || [];
        const baseId = session.sessionId || session.id || session.uuid || 'session';
        const started = session.started_at || session.created_at || session.startedAt;

        if (!all.length) {
          convs.push({
            id: baseId,
            summary: `Conversation (0 messages)`,
            messages: [],
            created_at: started,
            updated_at: started,
            message_count: 0,
          });
          return;
        }

        const sorted = [...all].sort((a, b) => {
          const aTime = a.timestamp || a.created_at || Date.now() - (all.length - all.indexOf(a)) * 1000;
          const bTime = b.timestamp || b.created_at || Date.now() - (all.length - all.indexOf(b)) * 1000;
          return aTime - bTime;
        });
        const groups = [];
        let current = [];

        for (const m of sorted) {
          if (!current.length) {
            current.push(m);
            continue;
          }
          const prev = current[current.length - 1];
          const mTime = m.timestamp || m.created_at || 0;
          const prevTime = prev.timestamp || prev.created_at || 0;
          const dt = mTime - prevTime;
          if (dt > GAP_MS) {
            groups.push(current);
            current = [m];
          } else {
            current.push(m);
          }
        }
        if (current.length) groups.push(current);

        groups.forEach((group, idx) => {
          const firstUserMsg = group.find((m) => m.role === 'user');
          const lastMessage = group[group.length - 1];
          const createdTs = group[0]?.timestamp || group[0]?.created_at || started || Date.now();
          const updatedTs = lastMessage?.timestamp || lastMessage?.created_at || createdTs;
          const convId = `${baseId}-${createdTs || idx}`;
          convs.push({
            id: convId,
            summary: firstUserMsg
              ? firstUserMsg.content.substring(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '')
              : `Conversation (${group.length} messages)`,
            messages: group,
            created_at: createdTs,
            updated_at: updatedTs,
            message_count: group.length,
          });
        });
      });

      setConversations(convs);
    } catch (error) {
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
      <div className="flex flex-col h-full text-black">
        <div className="bg-white/50 backdrop-blur-xl border border-white/40 p-3 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setViewingDetails(false)}
              className="flex items-center gap-1 text-xs text-black/60 hover:text-black"
            >
              <X className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleLoadConversation}
              className="px-3 py-1 rounded text-xs bg-black/80 text-white hover:bg-black"
            >
              Load Conversation
            </button>
          </div>
          <div className="text-sm font-semibold line-clamp-1">{selectedConv.summary || 'Conversation'}</div>
          <div className="text-xs text-black/60">{selectedConv.messages?.length || 0} messages</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {selectedConv.messages?.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl text-sm border shadow-sm ${
                msg.role === 'user'
                  ? 'bg-white/70 border-white/60'
                  : 'bg-white/50 border-white/50'
              }`}
            >
              <div className="font-semibold text-[10px] text-black/50 mb-1 uppercase tracking-wide">
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
    <div className="flex flex-col h-full text-black">
      <div className="bg-white/50 backdrop-blur-xl border border-white/40 p-3 rounded-2xl shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-5 h-5 text-black/70" />
          <h2 className="text-sm font-semibold">Conversation History</h2>
          <span className="text-xs text-black/60">({conversations.length})</span>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white/70 border border-white/50 rounded pl-8 pr-3 py-2 text-xs placeholder-black/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-black/70 animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-black/60">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-xs">
              {searchQuery ? 'No matching conversations' : 'No conversation history yet'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversationDetails(conv.id)}
                className="w-full text-left p-3 bg-white/45 hover:bg-white/55 rounded-xl text-xs transition-colors border border-white/40 shadow-sm"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold text-black line-clamp-1">
                    {conv.summary || 'Conversation'}
                  </span>
                  <span className="text-[10px] text-black/60 whitespace-nowrap ml-2">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-black/60">
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
