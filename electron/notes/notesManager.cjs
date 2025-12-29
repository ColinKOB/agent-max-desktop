/**
 * Max's Notes - Note-Taking App Manager
 * Manages the BrowserWindow for the AI-controlled note-taking application
 * Following the same pattern as workspaceManager.cjs and spreadsheetManager.cjs
 */

const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

class NotesManager {
  constructor() {
    this.window = null;
    this.isActive = false;
    this.sessionId = null;
    this.activityLog = [];
    this.frameBuffer = null;
    this.captureInterval = null;

    // Notes data storage
    this.notes = [];
    this.folders = [{ id: 'default', name: 'All Notes', icon: 'folder' }];
    this.currentNoteId = null;
    this.isModified = false;

    // Search index for semantic search
    this.searchIndex = new Map();

    // File path for local storage
    this.storagePath = null;
  }

  /**
   * Initialize storage path
   */
  initStorage(userDataPath) {
    this.storagePath = path.join(userDataPath, 'max-notes');
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    this.loadNotes();
  }

  /**
   * Load notes from local storage
   */
  loadNotes() {
    try {
      const notesFile = path.join(this.storagePath, 'notes.json');
      if (fs.existsSync(notesFile)) {
        const data = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
        this.notes = data.notes || [];
        this.folders = data.folders || [{ id: 'default', name: 'All Notes', icon: 'folder' }];
        this.rebuildSearchIndex();
        console.log(`[NotesManager] Loaded ${this.notes.length} notes`);
      }
    } catch (err) {
      console.error('[NotesManager] Error loading notes:', err);
      this.notes = [];
    }
  }

  /**
   * Save notes to local storage
   */
  saveNotes() {
    try {
      const notesFile = path.join(this.storagePath, 'notes.json');
      const data = {
        notes: this.notes,
        folders: this.folders,
        lastModified: new Date().toISOString()
      };
      fs.writeFileSync(notesFile, JSON.stringify(data, null, 2));
      console.log(`[NotesManager] Saved ${this.notes.length} notes`);
    } catch (err) {
      console.error('[NotesManager] Error saving notes:', err);
    }
  }

  /**
   * Rebuild search index for all notes
   */
  rebuildSearchIndex() {
    this.searchIndex.clear();
    this.notes.forEach(note => {
      const words = this.tokenize(note.title + ' ' + note.content);
      words.forEach(word => {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, new Set());
        }
        this.searchIndex.get(word).add(note.id);
      });
    });
  }

  /**
   * Tokenize text for search
   */
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Create a new note
   */
  createNote(title = 'Untitled Note', content = '', folderId = 'default', tags = []) {
    const note = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      folderId,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      linkedNotes: [],
      metadata: {}
    };

    this.notes.unshift(note);
    this.currentNoteId = note.id;
    this.isModified = true;
    this.rebuildSearchIndex();
    this.saveNotes();
    this.syncToWindow();

    this.logActivity('create_note', { noteId: note.id, title });
    return note;
  }

  /**
   * Update an existing note
   */
  updateNote(noteId, updates) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    // Apply updates
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;
    if (updates.folderId !== undefined) note.folderId = updates.folderId;
    if (updates.tags !== undefined) note.tags = updates.tags;
    if (updates.linkedNotes !== undefined) note.linkedNotes = updates.linkedNotes;
    if (updates.metadata !== undefined) note.metadata = { ...note.metadata, ...updates.metadata };

    note.updatedAt = new Date().toISOString();
    this.isModified = true;
    this.rebuildSearchIndex();
    this.saveNotes();
    this.syncToWindow();

    this.logActivity('update_note', { noteId, updates: Object.keys(updates) });
    return { success: true, note };
  }

  /**
   * Delete a note
   */
  deleteNote(noteId) {
    const index = this.notes.findIndex(n => n.id === noteId);
    if (index === -1) {
      return { success: false, error: 'Note not found' };
    }

    const note = this.notes[index];
    this.notes.splice(index, 1);

    // Remove from linked notes
    this.notes.forEach(n => {
      n.linkedNotes = n.linkedNotes.filter(id => id !== noteId);
    });

    if (this.currentNoteId === noteId) {
      this.currentNoteId = this.notes[0]?.id || null;
    }

    this.isModified = true;
    this.rebuildSearchIndex();
    this.saveNotes();
    this.syncToWindow();

    this.logActivity('delete_note', { noteId, title: note.title });
    return { success: true };
  }

  /**
   * Get a note by ID
   */
  getNote(noteId) {
    return this.notes.find(n => n.id === noteId) || null;
  }

  /**
   * Get all notes, optionally filtered
   */
  getNotes(options = {}) {
    let results = [...this.notes];

    // Filter by folder
    if (options.folderId && options.folderId !== 'default') {
      results = results.filter(n => n.folderId === options.folderId);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(n =>
        options.tags.some(tag => n.tags.includes(tag))
      );
    }

    // Search query
    if (options.query) {
      const queryWords = this.tokenize(options.query);
      const matchingIds = new Set();

      queryWords.forEach(word => {
        // Exact match
        if (this.searchIndex.has(word)) {
          this.searchIndex.get(word).forEach(id => matchingIds.add(id));
        }
        // Prefix match
        this.searchIndex.forEach((ids, indexWord) => {
          if (indexWord.startsWith(word)) {
            ids.forEach(id => matchingIds.add(id));
          }
        });
      });

      results = results.filter(n => matchingIds.has(n.id));
    }

    // Sort
    if (options.sortBy === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title));
    } else if (options.sortBy === 'created') {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      // Default: sort by updated date
      results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    // Limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Search notes with semantic understanding
   */
  searchNotes(query) {
    const results = this.getNotes({ query });

    // Score results by relevance
    const queryWords = this.tokenize(query);
    const scored = results.map(note => {
      let score = 0;
      const noteText = (note.title + ' ' + note.content).toLowerCase();

      queryWords.forEach(word => {
        // Title match is worth more
        if (note.title.toLowerCase().includes(word)) score += 10;
        // Content match
        const matches = (noteText.match(new RegExp(word, 'g')) || []).length;
        score += matches;
      });

      // Recency boost
      const daysSinceUpdate = (Date.now() - new Date(note.updatedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 1) score += 5;
      else if (daysSinceUpdate < 7) score += 2;

      return { ...note, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Create a folder
   */
  createFolder(name, icon = 'folder') {
    const folder = {
      id: `folder_${Date.now()}`,
      name,
      icon,
      createdAt: new Date().toISOString()
    };
    this.folders.push(folder);
    this.saveNotes();
    this.syncToWindow();
    return folder;
  }

  /**
   * Delete a folder (moves notes to default)
   */
  deleteFolder(folderId) {
    if (folderId === 'default') {
      return { success: false, error: 'Cannot delete default folder' };
    }

    // Move notes to default folder
    this.notes.forEach(note => {
      if (note.folderId === folderId) {
        note.folderId = 'default';
      }
    });

    this.folders = this.folders.filter(f => f.id !== folderId);
    this.saveNotes();
    this.syncToWindow();
    return { success: true };
  }

  /**
   * Link two notes together
   */
  linkNotes(noteId1, noteId2) {
    const note1 = this.getNote(noteId1);
    const note2 = this.getNote(noteId2);

    if (!note1 || !note2) {
      return { success: false, error: 'Note not found' };
    }

    if (!note1.linkedNotes.includes(noteId2)) {
      note1.linkedNotes.push(noteId2);
    }
    if (!note2.linkedNotes.includes(noteId1)) {
      note2.linkedNotes.push(noteId1);
    }

    this.saveNotes();
    this.syncToWindow();
    return { success: true };
  }

  /**
   * Get all tags used across notes
   */
  getAllTags() {
    const tagCounts = new Map();
    this.notes.forEach(note => {
      note.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Create the notes window
   */
  async create() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return { success: true, alreadyOpen: true };
    }

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Create window with Max branding
    this.window = new BrowserWindow({
      width: Math.min(1200, screenWidth * 0.8),
      height: Math.min(800, screenHeight * 0.8),
      minWidth: 600,
      minHeight: 400,
      x: Math.floor((screenWidth - Math.min(1200, screenWidth * 0.8)) / 2),
      y: Math.floor((screenHeight - Math.min(800, screenHeight * 0.8)) / 2),
      frame: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'notesPreload.cjs')
      },
      backgroundColor: '#18181b',
      show: false
    });

    // Load the notes HTML
    const notesPath = path.join(__dirname, 'notes.html');
    await this.window.loadFile(notesPath);

    // Show when ready
    this.window.once('ready-to-show', () => {
      this.window.show();
      this.syncToWindow();
      // Open DevTools in development to debug
      if (process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged) {
        this.window.webContents.openDevTools({ mode: 'detach' });
      }
    });

    // Track state
    this.isActive = true;
    this.sessionId = `notes_${Date.now()}`;

    // Handle close
    this.window.on('closed', () => {
      this.window = null;
      this.isActive = false;
      this.stopCapture();
    });

    // Start frame capture for PiP
    this.startCapture();

    this.logActivity('window_created', { sessionId: this.sessionId });
    return { success: true, sessionId: this.sessionId };
  }

  /**
   * Sync notes data to the window
   */
  syncToWindow() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('notes-sync', {
        notes: this.notes,
        folders: this.folders,
        currentNoteId: this.currentNoteId,
        tags: this.getAllTags()
      });
    }
  }

  /**
   * Destroy the notes window
   */
  destroy() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
    this.isActive = false;
    this.stopCapture();
    this.logActivity('window_destroyed', {});
    return { success: true };
  }

  /**
   * Start frame capture for PiP display
   */
  startCapture(intervalMs = 500) {
    this.stopCapture();
    this.captureInterval = setInterval(async () => {
      if (this.window && !this.window.isDestroyed()) {
        try {
          const image = await this.window.webContents.capturePage();
          this.frameBuffer = image.toDataURL();
        } catch (err) {
          // Ignore capture errors
        }
      }
    }, intervalMs);
  }

  /**
   * Stop frame capture
   */
  stopCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  /**
   * Get current frame for PiP
   */
  getFrame() {
    return this.frameBuffer;
  }

  /**
   * Get status for AI awareness
   */
  getStatus() {
    return {
      active: this.isActive,
      sessionId: this.sessionId,
      noteCount: this.notes.length,
      folderCount: this.folders.length,
      currentNoteId: this.currentNoteId,
      currentNote: this.currentNoteId ? this.getNote(this.currentNoteId) : null,
      isModified: this.isModified,
      tags: this.getAllTags().slice(0, 10)
    };
  }

  /**
   * Get detailed status for AI context
   */
  getDetailedStatus() {
    const status = this.getStatus();
    const recentNotes = this.getNotes({ limit: 5 });

    return {
      ...status,
      recentNotes: recentNotes.map(n => ({
        id: n.id,
        title: n.title,
        preview: n.content.substring(0, 100),
        tags: n.tags,
        updatedAt: n.updatedAt
      })),
      folders: this.folders,
      stats: {
        totalNotes: this.notes.length,
        totalTags: this.getAllTags().length,
        totalFolders: this.folders.length,
        notesThisWeek: this.notes.filter(n =>
          (Date.now() - new Date(n.createdAt)) < 7 * 24 * 60 * 60 * 1000
        ).length
      }
    };
  }

  /**
   * Log activity for debugging
   */
  logActivity(action, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      details
    };
    this.activityLog.push(entry);

    // Keep last 100 entries
    if (this.activityLog.length > 100) {
      this.activityLog = this.activityLog.slice(-100);
    }

    console.log(`[NotesManager] ${action}:`, details);
  }

  /**
   * Export notes to various formats
   */
  exportNotes(format = 'json', noteIds = null) {
    const notesToExport = noteIds
      ? this.notes.filter(n => noteIds.includes(n.id))
      : this.notes;

    switch (format) {
      case 'json':
        return JSON.stringify(notesToExport, null, 2);

      case 'markdown':
        return notesToExport.map(note =>
          `# ${note.title}\n\n${note.content}\n\n---\nTags: ${note.tags.join(', ')}\nCreated: ${note.createdAt}\n`
        ).join('\n\n');

      case 'text':
        return notesToExport.map(note =>
          `${note.title}\n${'='.repeat(note.title.length)}\n\n${note.content}\n`
        ).join('\n\n---\n\n');

      default:
        return JSON.stringify(notesToExport, null, 2);
    }
  }

  /**
   * Import notes from JSON
   */
  importNotes(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      const notes = Array.isArray(imported) ? imported : imported.notes || [];

      let count = 0;
      notes.forEach(note => {
        if (note.title && note.content !== undefined) {
          this.createNote(
            note.title,
            note.content,
            note.folderId || 'default',
            note.tags || []
          );
          count++;
        }
      });

      return { success: true, imported: count };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

// Singleton instance
const notesManager = new NotesManager();

module.exports = { notesManager, NotesManager };
