/**
 * Max's Notes - API Server
 * HTTP API server for AI control of the note-taking application
 * Port: 3849
 */

const http = require('http');
const { notesManager } = require('./notesManager.cjs');

const PORT = 3849;
let server = null;

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle API requests
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  console.log(`[NotesAPI] ${method} ${path}`);

  try {
    // Window management
    if (path === '/notes/create' && method === 'POST') {
      const result = await notesManager.create();
      sendJson(res, result);
      return;
    }

    if (path === '/notes/destroy' && method === 'POST') {
      const result = notesManager.destroy();
      sendJson(res, result);
      return;
    }

    if (path === '/notes/status' && method === 'GET') {
      const status = notesManager.getStatus();
      sendJson(res, status);
      return;
    }

    if (path === '/notes/detailed-status' && method === 'GET') {
      const status = notesManager.getDetailedStatus();
      sendJson(res, status);
      return;
    }

    if (path === '/notes/capture-frame' && method === 'GET') {
      const frame = notesManager.getFrame();
      sendJson(res, { frame });
      return;
    }

    // Note CRUD operations
    if (path === '/notes/note/create' && method === 'POST') {
      const body = await parseBody(req);
      const note = notesManager.createNote(
        body.title || 'Untitled Note',
        body.content || '',
        body.folderId || 'default',
        body.tags || []
      );
      sendJson(res, { success: true, note });
      return;
    }

    if (path === '/notes/note/update' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.noteId) {
        sendJson(res, { success: false, error: 'noteId required' }, 400);
        return;
      }
      const result = notesManager.updateNote(body.noteId, {
        title: body.title,
        content: body.content,
        folderId: body.folderId,
        tags: body.tags,
        linkedNotes: body.linkedNotes,
        metadata: body.metadata
      });
      sendJson(res, result);
      return;
    }

    if (path === '/notes/note/delete' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.noteId) {
        sendJson(res, { success: false, error: 'noteId required' }, 400);
        return;
      }
      const result = notesManager.deleteNote(body.noteId);
      sendJson(res, result);
      return;
    }

    if (path === '/notes/note/get' && method === 'GET') {
      const noteId = url.searchParams.get('noteId');
      if (!noteId) {
        sendJson(res, { success: false, error: 'noteId required' }, 400);
        return;
      }
      const note = notesManager.getNote(noteId);
      if (note) {
        sendJson(res, { success: true, note });
      } else {
        sendJson(res, { success: false, error: 'Note not found' }, 404);
      }
      return;
    }

    if (path === '/notes/note/list' && method === 'GET') {
      const options = {
        folderId: url.searchParams.get('folderId'),
        query: url.searchParams.get('query'),
        tags: url.searchParams.get('tags')?.split(',').filter(Boolean),
        sortBy: url.searchParams.get('sortBy'),
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : undefined
      };
      const notes = notesManager.getNotes(options);
      sendJson(res, { success: true, notes, count: notes.length });
      return;
    }

    if (path === '/notes/note/search' && method === 'GET') {
      const query = url.searchParams.get('query');
      if (!query) {
        sendJson(res, { success: false, error: 'query required' }, 400);
        return;
      }
      const results = notesManager.searchNotes(query);
      sendJson(res, { success: true, results, count: results.length });
      return;
    }

    // Folder operations
    if (path === '/notes/folder/create' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        sendJson(res, { success: false, error: 'name required' }, 400);
        return;
      }
      const folder = notesManager.createFolder(body.name, body.icon);
      sendJson(res, { success: true, folder });
      return;
    }

    if (path === '/notes/folder/delete' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.folderId) {
        sendJson(res, { success: false, error: 'folderId required' }, 400);
        return;
      }
      const result = notesManager.deleteFolder(body.folderId);
      sendJson(res, result);
      return;
    }

    if (path === '/notes/folder/list' && method === 'GET') {
      sendJson(res, { success: true, folders: notesManager.folders });
      return;
    }

    // Linking
    if (path === '/notes/link' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.noteId1 || !body.noteId2) {
        sendJson(res, { success: false, error: 'noteId1 and noteId2 required' }, 400);
        return;
      }
      const result = notesManager.linkNotes(body.noteId1, body.noteId2);
      sendJson(res, result);
      return;
    }

    // Tags
    if (path === '/notes/tags' && method === 'GET') {
      const tags = notesManager.getAllTags();
      sendJson(res, { success: true, tags });
      return;
    }

    // Export/Import
    if (path === '/notes/export' && method === 'GET') {
      const format = url.searchParams.get('format') || 'json';
      const noteIds = url.searchParams.get('noteIds')?.split(',').filter(Boolean);
      const exported = notesManager.exportNotes(format, noteIds);
      sendJson(res, { success: true, data: exported, format });
      return;
    }

    if (path === '/notes/import' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.data) {
        sendJson(res, { success: false, error: 'data required' }, 400);
        return;
      }
      const result = notesManager.importNotes(body.data);
      sendJson(res, result);
      return;
    }

    // AI-specific endpoints
    if (path === '/notes/ai/summarize' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.noteId) {
        sendJson(res, { success: false, error: 'noteId required' }, 400);
        return;
      }
      const note = notesManager.getNote(body.noteId);
      if (!note) {
        sendJson(res, { success: false, error: 'Note not found' }, 404);
        return;
      }
      // Return note content for AI to summarize
      sendJson(res, {
        success: true,
        noteId: note.id,
        title: note.title,
        content: note.content,
        instruction: 'Please summarize this note and update it with the summary'
      });
      return;
    }

    if (path === '/notes/ai/organize' && method === 'POST') {
      const body = await parseBody(req);
      // Get all notes for AI to analyze and suggest organization
      const notes = notesManager.getNotes({});
      sendJson(res, {
        success: true,
        notes: notes.map(n => ({
          id: n.id,
          title: n.title,
          preview: n.content.substring(0, 200),
          tags: n.tags,
          folderId: n.folderId
        })),
        folders: notesManager.folders,
        instruction: 'Analyze these notes and suggest better organization (tags, folders, links)'
      });
      return;
    }

    if (path === '/notes/ai/extract-tasks' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.noteId) {
        sendJson(res, { success: false, error: 'noteId required' }, 400);
        return;
      }
      const note = notesManager.getNote(body.noteId);
      if (!note) {
        sendJson(res, { success: false, error: 'Note not found' }, 404);
        return;
      }
      sendJson(res, {
        success: true,
        noteId: note.id,
        content: note.content,
        instruction: 'Extract action items and tasks from this note content'
      });
      return;
    }

    // Quick actions
    if (path === '/notes/quick/today' && method === 'POST') {
      // Create or get today's daily note
      const today = new Date().toISOString().split('T')[0];
      const todayTitle = `Daily Note - ${today}`;

      let note = notesManager.notes.find(n => n.title === todayTitle);
      if (!note) {
        note = notesManager.createNote(
          todayTitle,
          `# ${today}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Ideas\n\n`,
          'default',
          ['daily']
        );
      }

      notesManager.currentNoteId = note.id;
      notesManager.syncToWindow();
      sendJson(res, { success: true, note });
      return;
    }

    if (path === '/notes/quick/scratch' && method === 'POST') {
      // Create a quick scratch note
      const note = notesManager.createNote(
        `Scratch - ${new Date().toLocaleTimeString()}`,
        '',
        'default',
        ['scratch']
      );
      sendJson(res, { success: true, note });
      return;
    }

    // 404
    sendJson(res, { error: 'Not found', path }, 404);

  } catch (err) {
    console.error(`[NotesAPI] Error handling ${path}:`, err);
    sendJson(res, { error: err.message }, 500);
  }
}

/**
 * Start the API server
 */
function startNotesApiServer() {
  if (server) {
    console.log('[NotesAPI] Server already running');
    return;
  }

  server = http.createServer(handleRequest);

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[NotesAPI] Server running on http://127.0.0.1:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[NotesAPI] Port ${PORT} is already in use`);
    } else {
      console.error('[NotesAPI] Server error:', err);
    }
  });
}

/**
 * Stop the API server
 */
function stopNotesApiServer() {
  if (server) {
    server.close();
    server = null;
    console.log('[NotesAPI] Server stopped');
  }
}

module.exports = { startNotesApiServer, stopNotesApiServer, PORT };
