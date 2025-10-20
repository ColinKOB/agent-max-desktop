import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Profile state
  profile: null,
  greeting: '',

  // Conversation state
  messages: [],
  pendingTasks: [],
  sessionId: null,
  conversationHistory: JSON.parse(localStorage.getItem('conversationHistory') || '[]'),

  // Facts state
  facts: {},

  // Preferences state
  preferences: {},

  // UI state
  isLoading: false,
  error: null,
  apiConnected: false,
  theme: localStorage.getItem('theme') || 'light',
  currentPage: 'dashboard',

  // Actions
  setProfile: (profile) => set({ profile }),
  setGreeting: (greeting) => set({ greeting }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, timestamp: new Date().toISOString() }],
    })),

  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setPendingTasks: (tasks) => set({ pendingTasks: tasks }),
  setFacts: (facts) => set({ facts }),
  setPreferences: (preferences) => set({ preferences }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setApiConnected: (connected) => set({ apiConnected: connected }),
  setSessionId: (sessionId) => set({ sessionId }),

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  // Conversation history actions
  addToHistory: (summary, messages) => {
    const history = get().conversationHistory;
    const newEntry = {
      id: Date.now(),
      summary,
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
    };
    const updated = [newEntry, ...history].slice(0, 50); // Keep last 50
    localStorage.setItem('conversationHistory', JSON.stringify(updated));
    set({ conversationHistory: updated });
  },

  clearHistory: () => {
    localStorage.removeItem('conversationHistory');
    set({ conversationHistory: [] });
  },

  // Clear all state
  reset: () =>
    set({
      profile: null,
      greeting: '',
      messages: [],
      pendingTasks: [],
      facts: {},
      preferences: {},
      isLoading: false,
      error: null,
    }),
}));

export default useStore;
