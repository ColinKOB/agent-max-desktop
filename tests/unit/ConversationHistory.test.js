import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConversationHistory from '../../src/components/ConversationHistory';
import { toast } from 'react-hot-toast';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
}));

// Mock conversationAPI
jest.mock('../../src/services/api', () => ({
  conversationAPI: {
    getHistory: jest.fn().mockResolvedValue({
      data: { conversations: [] },
    }),
  },
}));

describe('ConversationHistory Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<ConversationHistory />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('loads conversations from Electron memory API when available', async () => {
    const mockSessions = [
      {
        sessionId: 'session_1',
        started_at: '2025-01-14T10:00:00Z',
        messages: [
          { role: 'user', content: 'Hello, how are you?', timestamp: '2025-01-14T10:00:00Z' },
          { role: 'assistant', content: 'I am doing well!', timestamp: '2025-01-14T10:00:01Z' },
        ],
      },
      {
        sessionId: 'session_2',
        started_at: '2025-01-14T11:00:00Z',
        messages: [
          { role: 'user', content: 'What is the weather?', timestamp: '2025-01-14T11:00:00Z' },
        ],
      },
    ];

    window.electron.memory.getAllSessions.mockResolvedValueOnce(mockSessions);

    render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Hello, how are you\?/)).toBeInTheDocument();
    expect(screen.getByText(/What is the weather\?/)).toBeInTheDocument();
    expect(screen.getByText(/2 messages/)).toBeInTheDocument();
    expect(screen.getByText(/1 message/)).toBeInTheDocument();
  });

  it('handles empty conversation list', async () => {
    window.electron.memory.getAllSessions.mockResolvedValueOnce([]);

    render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/No conversations found/i)).toBeInTheDocument();
    expect(screen.getByText(/Start a new conversation/i)).toBeInTheDocument();
  });

  it('displays conversation details when clicked', async () => {
    const mockSessions = [
      {
        sessionId: 'session_1',
        started_at: '2025-01-14T10:00:00Z',
        messages: [
          { role: 'user', content: 'Test message', timestamp: '2025-01-14T10:00:00Z' },
          { role: 'assistant', content: 'Test response', timestamp: '2025-01-14T10:00:01Z' },
        ],
      },
    ];

    window.electron.memory.getAllSessions.mockResolvedValueOnce(mockSessions);

    const { container } = render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Click on the conversation
    const conversationCard = container.querySelector('.conversation-card');
    fireEvent.click(conversationCard);

    // Check if details view is shown
    expect(screen.getByText(/Test message/)).toBeInTheDocument();
    expect(screen.getByText(/Test response/)).toBeInTheDocument();
    expect(screen.getByText(/Back to History/)).toBeInTheDocument();
  });

  it('handles load conversation button click', async () => {
    const mockOnLoad = jest.fn();
    const mockSessions = [
      {
        sessionId: 'session_1',
        started_at: '2025-01-14T10:00:00Z',
        messages: [
          { role: 'user', content: 'Test message', timestamp: '2025-01-14T10:00:00Z' },
        ],
      },
    ];

    window.electron.memory.getAllSessions.mockResolvedValueOnce(mockSessions);

    const { container } = render(<ConversationHistory onLoadConversation={mockOnLoad} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Click conversation
    const conversationCard = container.querySelector('.conversation-card');
    fireEvent.click(conversationCard);

    // Click load button
    const loadButton = screen.getByText(/Load Conversation/i);
    fireEvent.click(loadButton);

    expect(mockOnLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session_1',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Test message',
          }),
        ]),
      })
    );

    expect(toast.success).toHaveBeenCalledWith('Conversation loaded!');
  });

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to load history';
    window.electron.memory.getAllSessions.mockRejectedValueOnce(new Error(errorMessage));

    render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    expect(toast.error).toHaveBeenCalledWith(`Failed to load history: ${errorMessage}`);
    expect(screen.getByText(/Failed to load conversations/i)).toBeInTheDocument();
  });

  it('falls back to API when Electron memory is not available', async () => {
    // Remove Electron API temporarily
    const originalElectron = window.electron;
    delete window.electron;

    const { conversationAPI } = require('../../src/services/api');
    conversationAPI.getHistory.mockResolvedValueOnce({
      data: {
        conversations: [
          {
            id: 'conv_1',
            summary: 'API conversation',
            messages: [],
            created_at: '2025-01-14T10:00:00Z',
            updated_at: '2025-01-14T10:00:00Z',
          },
        ],
      },
    });

    render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/API conversation/)).toBeInTheDocument();

    // Restore Electron API
    window.electron = originalElectron;
  });

  it('formats conversation summaries correctly', async () => {
    const mockSessions = [
      {
        sessionId: 'session_1',
        started_at: '2025-01-14T10:00:00Z',
        messages: [
          {
            role: 'user',
            content:
              'This is a very long message that should be truncated to 60 characters for the summary display',
            timestamp: '2025-01-14T10:00:00Z',
          },
        ],
      },
      {
        sessionId: 'session_2',
        started_at: '2025-01-14T11:00:00Z',
        messages: [
          { role: 'assistant', content: 'No user message', timestamp: '2025-01-14T11:00:00Z' },
        ],
      },
    ];

    window.electron.memory.getAllSessions.mockResolvedValueOnce(mockSessions);

    render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Check truncated summary
    expect(
      screen.getByText(/This is a very long message that should be truncated to 60\.\.\./)
    ).toBeInTheDocument();

    // Check fallback summary when no user message
    expect(screen.getByText(/Conversation \(1 message/)).toBeInTheDocument();
  });

  it('sorts conversations by most recent first', async () => {
    const mockSessions = [
      {
        sessionId: 'session_old',
        started_at: '2025-01-13T10:00:00Z',
        messages: [
          { role: 'user', content: 'Old message', timestamp: '2025-01-13T10:00:00Z' },
        ],
      },
      {
        sessionId: 'session_new',
        started_at: '2025-01-14T10:00:00Z',
        messages: [
          { role: 'user', content: 'New message', timestamp: '2025-01-14T10:00:00Z' },
        ],
      },
    ];

    window.electron.memory.getAllSessions.mockResolvedValueOnce(mockSessions);

    render(<ConversationHistory />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Get all conversation cards
    const conversationTexts = screen.getAllByText(/message$/);
    
    // The newer conversation should appear first
    expect(conversationTexts[0]).toHaveTextContent('New message');
    expect(conversationTexts[1]).toHaveTextContent('Old message');
  });
});
