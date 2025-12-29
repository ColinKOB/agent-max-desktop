/**
 * Max's Notes - Preload Script
 * Bridges IPC communication between main process and renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose notes API to renderer
contextBridge.exposeInMainWorld('notesAPI', {
  // Receive sync updates from main process
  onSync: (callback) => {
    ipcRenderer.on('notes-sync', (event, data) => callback(data));
  },

  // Request operations from main process
  createNote: (title, content, folderId, tags) => {
    return ipcRenderer.invoke('notes-create-note', { title, content, folderId, tags });
  },

  updateNote: (noteId, updates) => {
    return ipcRenderer.invoke('notes-update-note', { noteId, updates });
  },

  deleteNote: (noteId) => {
    return ipcRenderer.invoke('notes-delete-note', { noteId });
  },

  getNote: (noteId) => {
    return ipcRenderer.invoke('notes-get-note', { noteId });
  },

  getNotes: (options) => {
    return ipcRenderer.invoke('notes-get-notes', options);
  },

  searchNotes: (query) => {
    return ipcRenderer.invoke('notes-search', { query });
  },

  createFolder: (name, icon) => {
    return ipcRenderer.invoke('notes-create-folder', { name, icon });
  },

  deleteFolder: (folderId) => {
    return ipcRenderer.invoke('notes-delete-folder', { folderId });
  },

  linkNotes: (noteId1, noteId2) => {
    return ipcRenderer.invoke('notes-link', { noteId1, noteId2 });
  },

  getAllTags: () => {
    return ipcRenderer.invoke('notes-get-tags');
  },

  exportNotes: (format, noteIds) => {
    return ipcRenderer.invoke('notes-export', { format, noteIds });
  },

  importNotes: (data) => {
    return ipcRenderer.invoke('notes-import', { data });
  },

  // Quick actions
  createDailyNote: () => {
    return ipcRenderer.invoke('notes-quick-today');
  },

  createScratchNote: () => {
    return ipcRenderer.invoke('notes-quick-scratch');
  },

  // Set current note
  setCurrentNote: (noteId) => {
    return ipcRenderer.invoke('notes-set-current', { noteId });
  }
});

// Also expose as window.notes for compatibility
contextBridge.exposeInMainWorld('notes', {
  getStatus: () => ipcRenderer.invoke('notes-status'),
  getDetailedStatus: () => ipcRenderer.invoke('notes-detailed-status')
});

console.log('[NotesPreload] API exposed to renderer');
