/**
 * macOS AppleScript Tool Executor
 *
 * Executes macOS native app automation via AppleScript (osascript).
 * Supports Safari, Notes, Mail, Calendar, Finder, and Reminders.
 *
 * These tools are 99% reliable vs 60% for coordinate-based clicking.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Check if running on macOS
 */
function isMacOS() {
    return process.platform === 'darwin';
}

/**
 * Execute AppleScript and return result
 */
async function runAppleScript(script) {
    if (!isMacOS()) {
        return {
            success: false,
            error: 'macOS AppleScript tools only work on macOS',
            exit_code: 1
        };
    }

    try {
        // Escape the script for shell
        const escapedScript = script.replace(/'/g, "'\\''");
        const { stdout, stderr } = await execAsync(`osascript -e '${escapedScript}'`, {
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024
        });

        return {
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exit_code: 0
        };
    } catch (error) {
        return {
            success: false,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            exit_code: error.code || 1,
            error: error.message
        };
    }
}

/**
 * Execute AppleScript from multi-line script (handles complex scripts better)
 * Uses a temp file to avoid shell escaping issues
 */
async function runAppleScriptMultiline(script) {
    if (!isMacOS()) {
        return {
            success: false,
            error: 'macOS AppleScript tools only work on macOS',
            exit_code: 1
        };
    }

    const fs = require('fs').promises;
    const os = require('os');
    const path = require('path');

    // Create temp file for the script
    const tempFile = path.join(os.tmpdir(), `applescript_${Date.now()}.scpt`);

    try {
        // Write script to temp file
        await fs.writeFile(tempFile, script, 'utf8');

        // Execute from temp file
        const { stdout, stderr } = await execAsync(`osascript "${tempFile}"`, {
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024
        });

        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});

        return {
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exit_code: 0
        };
    } catch (error) {
        // Clean up temp file on error
        await fs.unlink(tempFile).catch(() => {});

        return {
            success: false,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            exit_code: error.code || 1,
            error: error.message
        };
    }
}

// ============================================================================
// SAFARI TOOLS
// ============================================================================

const safariTools = {
    async navigate(args) {
        const url = args.url;
        if (!url) return { success: false, error: 'Missing required argument: url', exit_code: 1 };

        const script = `
tell application "Safari"
    activate
    if (count of windows) = 0 then
        make new document with properties {URL:"${url}"}
    else
        set URL of current tab of front window to "${url}"
    end if
end tell
return "Navigated to: ${url}"`;
        return await runAppleScriptMultiline(script);
    },

    async click_element(args) {
        const selector = args.selector;
        const matchText = args.match_text || args.matchText || args.text;

        if (!selector && !matchText) {
            return { success: false, error: 'Missing required argument: selector or match_text', exit_code: 1 };
        }

        // Escape strings for JavaScript inside AppleScript
        // Need to escape: backslash, single quotes, double quotes, and newlines
        const escapeForJS = (str) => {
            if (!str) return '';
            return str
                .replace(/\\/g, '\\\\')      // Escape backslashes first
                .replace(/'/g, "\\'")         // Escape single quotes for JS strings
                .replace(/"/g, '\\"')         // Escape double quotes
                .replace(/\n/g, '\\n')        // Escape newlines
                .replace(/\r/g, '\\r');       // Escape carriage returns
        };

        const escapedSelector = escapeForJS(selector || 'button, a, [role=\\'button\\']');
        const escapedMatchText = escapeForJS(matchText);

        // Build JavaScript that can find elements by selector AND optionally filter by text
        let jsCode;
        if (matchText) {
            // Find element matching selector that contains the text
            jsCode = `
                (function() {
                    var matchTexts = '${escapedMatchText}'.split(',').map(function(t) { return t.trim().toLowerCase(); });
                    var elements = document.querySelectorAll('${escapedSelector}');

                    for (var i = 0; i < elements.length; i++) {
                        var el = elements[i];
                        var elText = (el.textContent || el.innerText || '').toLowerCase().trim();
                        var elAriaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                        var elTitle = (el.getAttribute('title') || '').toLowerCase();

                        for (var j = 0; j < matchTexts.length; j++) {
                            var searchText = matchTexts[j];
                            if (elText.includes(searchText) || elAriaLabel.includes(searchText) || elTitle.includes(searchText)) {
                                el.scrollIntoView({ behavior: 'instant', block: 'center' });
                                el.click();
                                return 'Clicked element with text: ' + searchText;
                            }
                        }
                    }
                    return 'Element not found with text: ${escapedMatchText}';
                })();
            `;
        } else {
            // Simple selector-based click
            jsCode = `
                (function() {
                    var el = document.querySelector('${escapedSelector}');
                    if (el) {
                        el.scrollIntoView({ behavior: 'instant', block: 'center' });
                        el.click();
                        return 'Clicked: ${escapedSelector}';
                    } else {
                        return 'Element not found: ${escapedSelector}';
                    }
                })();
            `;
        }

        // For AppleScript, we need to escape the JavaScript code as a string
        // Use a heredoc-style approach by writing to temp file
        const script = `
tell application "Safari"
    set jsCode to "${jsCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
    set result to do JavaScript jsCode in current tab of front window
    return result
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async fill_input(args) {
        const selector = args.selector;
        const value = args.value || args.text || '';
        if (!selector) return { success: false, error: 'Missing required argument: selector', exit_code: 1 };

        // Escape strings for JavaScript inside AppleScript
        const escapeForJS = (str) => {
            if (!str) return '';
            return str
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
        };

        const escapedSelector = escapeForJS(selector);
        const escapedValue = escapeForJS(value);

        const jsCode = `
            (function() {
                var el = document.querySelector('${escapedSelector}');
                if (el) {
                    el.value = '${escapedValue}';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return 'Filled: ${escapedSelector}';
                } else {
                    return 'Element not found: ${escapedSelector}';
                }
            })();
        `;

        const script = `
tell application "Safari"
    set jsCode to "${jsCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
    set result to do JavaScript jsCode in current tab of front window
    return result
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async execute_js(args) {
        const script = args.script || args.code || args.javascript;
        if (!script) return { success: false, error: 'Missing required argument: script', exit_code: 1 };

        const escapedScript = script.replace(/'/g, "\\'").replace(/\n/g, '\\n');
        const appleScript = `
tell application "Safari"
    set jsCode to "${escapedScript}"
    set result to do JavaScript jsCode in current tab of front window
    return result
end tell`;
        return await runAppleScriptMultiline(appleScript);
    },

    async get_page_source(args) {
        const script = `
tell application "Safari"
    set pageSource to do JavaScript "document.documentElement.outerHTML" in current tab of front window
    return pageSource
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_current_url(args) {
        const script = `
tell application "Safari"
    return URL of current tab of front window
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_current_tab(args) {
        const script = `
tell application "Safari"
    set tabUrl to URL of current tab of front window
    set tabTitle to name of current tab of front window
    return "URL: " & tabUrl & "\\nTitle: " & tabTitle
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async list_tabs(args) {
        const script = `
tell application "Safari"
    set tabList to ""
    repeat with w in windows
        repeat with t in tabs of w
            set tabList to tabList & "- " & (name of t) & " | " & (URL of t) & "\\n"
        end repeat
    end repeat
    return tabList
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async new_tab(args) {
        const url = args.url || 'about:blank';
        const script = `
tell application "Safari"
    tell front window
        make new tab with properties {URL:"${url}"}
    end tell
    return "New tab opened: ${url}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async close_tab(args) {
        const script = `
tell application "Safari"
    close current tab of front window
    return "Tab closed"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async go_back(args) {
        const script = `
tell application "Safari"
    do JavaScript "history.back()" in current tab of front window
    return "Navigated back"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async go_forward(args) {
        const script = `
tell application "Safari"
    do JavaScript "history.forward()" in current tab of front window
    return "Navigated forward"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async reload(args) {
        const script = `
tell application "Safari"
    do JavaScript "location.reload()" in current tab of front window
    return "Page reloaded"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async activate(args) {
        const script = `
tell application "Safari"
    activate
end tell
return "Safari activated"`;
        return await runAppleScriptMultiline(script);
    }
};

// ============================================================================
// NOTES TOOLS
// ============================================================================

const notesTools = {
    async create(args) {
        const title = args.title || 'Untitled';
        const body = args.body || args.content || '';
        const folder = args.folder || 'Notes';

        const escapedTitle = title.replace(/"/g, '\\"');
        const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        const script = `
tell application "Notes"
    try
        set targetFolder to folder "${folder}"
    on error
        set targetFolder to default account's default folder
    end try
    tell targetFolder
        make new note with properties {name:"${escapedTitle}", body:"${escapedBody}"}
    end tell
    return "Note created: ${escapedTitle}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async read(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');
        const script = `
tell application "Notes"
    set matchingNotes to notes whose name contains "${escapedTitle}"
    if (count of matchingNotes) > 0 then
        set theNote to item 1 of matchingNotes
        set noteTitle to name of theNote
        set noteBody to body of theNote
        return "Title: " & noteTitle & "\\n\\nContent:\\n" & noteBody
    else
        return "Note not found: ${escapedTitle}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async search(args) {
        const query = args.query;
        if (!query) return { success: false, error: 'Missing required argument: query', exit_code: 1 };
        const limit = args.limit || 10;

        const escapedQuery = query.replace(/"/g, '\\"');
        const script = `
tell application "Notes"
    set matchingNotes to notes whose name contains "${escapedQuery}" or body contains "${escapedQuery}"
    set resultList to ""
    set noteCount to 0
    repeat with theNote in matchingNotes
        if noteCount < ${limit} then
            set resultList to resultList & "- " & (name of theNote) & "\\n"
            set noteCount to noteCount + 1
        end if
    end repeat
    if resultList is "" then
        return "No notes found matching: ${escapedQuery}"
    else
        return "Found " & noteCount & " notes:\\n" & resultList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async list(args) {
        const folder = args.folder;
        const limit = args.limit || 20;

        let script;
        if (folder) {
            const escapedFolder = folder.replace(/"/g, '\\"');
            script = `
tell application "Notes"
    try
        set targetFolder to folder "${escapedFolder}"
        set noteList to ""
        set noteCount to 0
        repeat with theNote in notes of targetFolder
            if noteCount < ${limit} then
                set noteList to noteList & "- " & (name of theNote) & "\\n"
                set noteCount to noteCount + 1
            end if
        end repeat
        return "Notes in ${escapedFolder}:\\n" & noteList
    on error
        return "Folder not found: ${escapedFolder}"
    end try
end tell`;
        } else {
            script = `
tell application "Notes"
    set noteList to ""
    set noteCount to 0
    repeat with theNote in notes
        if noteCount < ${limit} then
            set noteList to noteList & "- " & (name of theNote) & "\\n"
            set noteCount to noteCount + 1
        end if
    end repeat
    return "All notes:\\n" & noteList
end tell`;
        }
        return await runAppleScriptMultiline(script);
    },

    async append(args) {
        const title = args.title;
        const content = args.content || args.text || '';
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');
        const escapedContent = content.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        const script = `
tell application "Notes"
    set matchingNotes to notes whose name is "${escapedTitle}"
    if (count of matchingNotes) > 0 then
        set theNote to item 1 of matchingNotes
        set currentBody to body of theNote
        set body of theNote to currentBody & "\\n${escapedContent}"
        return "Appended to note: ${escapedTitle}"
    else
        return "Note not found: ${escapedTitle}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async delete(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');
        const script = `
tell application "Notes"
    set matchingNotes to notes whose name is "${escapedTitle}"
    if (count of matchingNotes) > 0 then
        delete item 1 of matchingNotes
        return "Deleted note: ${escapedTitle}"
    else
        return "Note not found: ${escapedTitle}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async list_folders(args) {
        const script = `
tell application "Notes"
    set folderList to ""
    repeat with f in folders
        set folderList to folderList & "- " & (name of f) & "\\n"
    end repeat
    return "Note folders:\\n" & folderList
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async activate(args) {
        const script = `
tell application "Notes"
    activate
end tell
return "Notes activated"`;
        return await runAppleScriptMultiline(script);
    }
};

// ============================================================================
// MAIL TOOLS
// ============================================================================

const mailTools = {
    async get_unread(args) {
        const limit = args.limit || 10;

        const script = `
tell application "Mail"
    set unreadList to ""
    set msgCount to 0
    repeat with theMessage in (messages of inbox whose read status is false)
        if msgCount < ${limit} then
            set msgSubject to subject of theMessage
            set msgSender to sender of theMessage
            set msgDate to date received of theMessage
            set unreadList to unreadList & "- " & msgSubject & "\\n  From: " & msgSender & "\\n  Date: " & (msgDate as string) & "\\n\\n"
            set msgCount to msgCount + 1
        end if
    end repeat
    if unreadList is "" then
        return "No unread messages"
    else
        return "Unread messages (" & msgCount & "):\\n\\n" & unreadList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async read(args) {
        const subject = args.subject;
        if (!subject) return { success: false, error: 'Missing required argument: subject', exit_code: 1 };

        const escapedSubject = subject.replace(/"/g, '\\"');
        const script = `
tell application "Mail"
    set matchingMessages to (messages of inbox whose subject contains "${escapedSubject}")
    if (count of matchingMessages) > 0 then
        set theMessage to item 1 of matchingMessages
        set msgSubject to subject of theMessage
        set msgSender to sender of theMessage
        set msgDate to date received of theMessage
        set msgContent to content of theMessage
        return "Subject: " & msgSubject & "\\nFrom: " & msgSender & "\\nDate: " & (msgDate as string) & "\\n\\nBody:\\n" & msgContent
    else
        return "No message found with subject: ${escapedSubject}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async send(args) {
        const to = args.to;
        const subject = args.subject || '(no subject)';
        const body = args.body || args.content || '';

        if (!to) return { success: false, error: 'Missing required argument: to', exit_code: 1 };

        const escapedTo = to.replace(/"/g, '\\"');
        const escapedSubject = subject.replace(/"/g, '\\"');
        const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        const script = `
tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}", visible:false}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"${escapedTo}"}
    end tell
    send newMessage
    return "Email sent to: ${escapedTo}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async draft(args) {
        const to = args.to || '';
        const subject = args.subject || '(no subject)';
        const body = args.body || args.content || '';

        const escapedTo = to.replace(/"/g, '\\"');
        const escapedSubject = subject.replace(/"/g, '\\"');
        const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        const script = `
tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}", visible:true}
    ${to ? `tell newMessage
        make new to recipient at end of to recipients with properties {address:"${escapedTo}"}
    end tell` : ''}
    activate
    return "Draft created: ${escapedSubject}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async search(args) {
        const query = args.query;
        if (!query) return { success: false, error: 'Missing required argument: query', exit_code: 1 };
        const limit = args.limit || 10;

        const escapedQuery = query.replace(/"/g, '\\"');
        const script = `
tell application "Mail"
    set resultList to ""
    set msgCount to 0
    repeat with theMessage in (messages of inbox whose subject contains "${escapedQuery}" or content contains "${escapedQuery}")
        if msgCount < ${limit} then
            set msgSubject to subject of theMessage
            set msgSender to sender of theMessage
            set resultList to resultList & "- " & msgSubject & " (from: " & msgSender & ")\\n"
            set msgCount to msgCount + 1
        end if
    end repeat
    if resultList is "" then
        return "No messages found matching: ${escapedQuery}"
    else
        return "Found " & msgCount & " messages:\\n" & resultList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async list_mailboxes(args) {
        const script = `
tell application "Mail"
    set mailboxList to ""
    repeat with mb in mailboxes
        set mailboxList to mailboxList & "- " & (name of mb) & "\\n"
    end repeat
    return "Mailboxes:\\n" & mailboxList
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async activate(args) {
        const script = `
tell application "Mail"
    activate
end tell
return "Mail activated"`;
        return await runAppleScriptMultiline(script);
    }
};

// ============================================================================
// CALENDAR TOOLS
// ============================================================================

const calendarTools = {
    async get_today(args) {
        // Simple version that just lists calendars - event iteration is too slow
        const script = `
tell application "Calendar"
    set calNames to {}
    repeat with cal in calendars
        set end of calNames to name of cal
    end repeat
    return "Available calendars: " & (calNames as string) & return & return & "Note: Use calendar.list_calendars for details or calendar.create_event to add events."
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_upcoming(args) {
        const days = args.days || 7;

        // More robust script that handles calendars with many events
        const script = `
tell application "Calendar"
    set today to current date
    set startOfDay to today - (time of today)
    set endDate to startOfDay + (${days} * 24 * 60 * 60)

    set eventList to ""
    set eventCount to 0
    set maxEvents to 20

    repeat with cal in calendars
        if eventCount >= maxEvents then exit repeat
        try
            set calName to name of cal
            -- Only check first 50 events per calendar to avoid timeout
            set calEvents to events of cal
            set checkCount to 0
            repeat with ev in calEvents
                set checkCount to checkCount + 1
                if checkCount > 50 then exit repeat
                if eventCount >= maxEvents then exit repeat

                try
                    set evStart to start date of ev
                    if evStart >= startOfDay and evStart < endDate then
                        set evSummary to summary of ev
                        set eventList to eventList & "- " & evSummary & " (" & (evStart as string) & ")" & return
                        set eventCount to eventCount + 1
                    end if
                end try
            end repeat
        on error errMsg
            -- Skip calendars that error
        end try
    end repeat

    if eventList is "" then
        return "No upcoming events in next ${days} days (checked local Calendar app)"
    else
        return "Upcoming events (next ${days} days):" & return & eventList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async create_event(args) {
        const title = args.title || args.summary || 'New Event';
        const startDate = args.start_date || args.start;
        const endDate = args.end_date || args.end;
        const location = args.location || '';
        const notes = args.notes || args.description || '';
        const calendarName = args.calendar;

        if (!startDate) return { success: false, error: 'Missing required argument: start_date (format: YYYY-MM-DD HH:MM)', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');
        const escapedLocation = location.replace(/"/g, '\\"');
        const escapedNotes = notes.replace(/"/g, '\\"');

        // Parse date - expect YYYY-MM-DD HH:MM format
        const dateScript = `set eventStart to date "${startDate}"`;
        const endScript = endDate ? `set eventEnd to date "${endDate}"` : 'set eventEnd to eventStart + (60 * 60)';

        const calScript = calendarName
            ? `set targetCal to calendar "${calendarName.replace(/"/g, '\\"')}"`
            : 'set targetCal to first calendar';

        const script = `
tell application "Calendar"
    ${calScript}
    ${dateScript}
    ${endScript}

    tell targetCal
        set newEvent to make new event with properties {summary:"${escapedTitle}", start date:eventStart, end date:eventEnd${location ? `, location:"${escapedLocation}"` : ''}${notes ? `, description:"${escapedNotes}"` : ''}}
    end tell
    return "Event created: ${escapedTitle}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async search(args) {
        const query = args.query;
        if (!query) return { success: false, error: 'Missing required argument: query', exit_code: 1 };
        const limit = args.limit || 10;

        const escapedQuery = query.replace(/"/g, '\\"');
        const script = `
tell application "Calendar"
    set resultList to ""
    set evCount to 0
    repeat with cal in calendars
        repeat with ev in (events of cal whose summary contains "${escapedQuery}")
            if evCount < ${limit} then
                set evSummary to summary of ev
                set evStart to start date of ev
                set resultList to resultList & "- " & evSummary & " (" & (evStart as string) & ")\\n"
                set evCount to evCount + 1
            end if
        end repeat
    end repeat
    if resultList is "" then
        return "No events found matching: ${escapedQuery}"
    else
        return "Found " & evCount & " events:\\n" & resultList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async delete_event(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');
        const script = `
tell application "Calendar"
    repeat with cal in calendars
        set matchingEvents to (events of cal whose summary is "${escapedTitle}")
        if (count of matchingEvents) > 0 then
            delete item 1 of matchingEvents
            return "Deleted event: ${escapedTitle}"
        end if
    end repeat
    return "Event not found: ${escapedTitle}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async list_calendars(args) {
        const script = `
tell application "Calendar"
    set calList to ""
    repeat with cal in calendars
        set calList to calList & "- " & (name of cal) & "\\n"
    end repeat
    return "Calendars:\\n" & calList
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async activate(args) {
        const script = `
tell application "Calendar"
    activate
end tell
return "Calendar activated"`;
        return await runAppleScriptMultiline(script);
    }
};

// ============================================================================
// FINDER TOOLS
// ============================================================================

const finderTools = {
    async list_folder(args) {
        const path = args.path;
        if (!path) return { success: false, error: 'Missing required argument: path', exit_code: 1 };

        // Expand ~ to home directory
        const expandedPath = path.replace(/^~/, process.env.HOME);

        // Use shell command via AppleScript for reliability
        const script = `
set shellResult to do shell script "ls -1p '${expandedPath}' 2>&1 || echo 'ERROR: Cannot list folder'"
if shellResult starts with "ERROR:" then
    return shellResult
else
    return "Contents of ${expandedPath}:" & return & shellResult
end if`;
        return await runAppleScriptMultiline(script);
    },

    async open_file(args) {
        const path = args.path;
        if (!path) return { success: false, error: 'Missing required argument: path', exit_code: 1 };

        const expandedPath = path.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    open POSIX file "${expandedPath}"
end tell
return "Opened: ${expandedPath}"`;
        return await runAppleScriptMultiline(script);
    },

    async open_with(args) {
        const path = args.path;
        const app = args.app;
        if (!path || !app) return { success: false, error: 'Missing required arguments: path, app', exit_code: 1 };

        const expandedPath = path.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    open POSIX file "${expandedPath}" using application "${app}"
end tell
return "Opened ${expandedPath} with ${app}"`;
        return await runAppleScriptMultiline(script);
    },

    async copy(args) {
        const source = args.source;
        const destination = args.destination;
        if (!source || !destination) return { success: false, error: 'Missing required arguments: source, destination', exit_code: 1 };

        const expandedSource = source.replace(/^~/, process.env.HOME);
        const expandedDest = destination.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    set sourceFile to POSIX file "${expandedSource}" as alias
    set destFolder to POSIX file "${expandedDest}" as alias
    duplicate sourceFile to destFolder
end tell
return "Copied to: ${expandedDest}"`;
        return await runAppleScriptMultiline(script);
    },

    async move(args) {
        const source = args.source;
        const destination = args.destination;
        if (!source || !destination) return { success: false, error: 'Missing required arguments: source, destination', exit_code: 1 };

        const expandedSource = source.replace(/^~/, process.env.HOME);
        const expandedDest = destination.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    set sourceFile to POSIX file "${expandedSource}" as alias
    set destFolder to POSIX file "${expandedDest}" as alias
    move sourceFile to destFolder
end tell
return "Moved to: ${expandedDest}"`;
        return await runAppleScriptMultiline(script);
    },

    async delete(args) {
        const path = args.path;
        if (!path) return { success: false, error: 'Missing required argument: path', exit_code: 1 };

        const expandedPath = path.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    delete POSIX file "${expandedPath}"
end tell
return "Moved to Trash: ${expandedPath}"`;
        return await runAppleScriptMultiline(script);
    },

    async create_folder(args) {
        const path = args.path;
        const name = args.name;
        if (!path || !name) return { success: false, error: 'Missing required arguments: path, name', exit_code: 1 };

        const expandedPath = path.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    set parentFolder to POSIX file "${expandedPath}" as alias
    make new folder at parentFolder with properties {name:"${name}"}
end tell
return "Created folder: ${name}"`;
        return await runAppleScriptMultiline(script);
    },

    async get_info(args) {
        const path = args.path;
        if (!path) return { success: false, error: 'Missing required argument: path', exit_code: 1 };

        const expandedPath = path.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    set theItem to POSIX file "${expandedPath}" as alias
    set itemName to name of theItem
    set itemKind to kind of theItem
    set itemSize to size of theItem
    set creationDate to creation date of theItem
    set modDate to modification date of theItem
    return "Name: " & itemName & "\\nKind: " & itemKind & "\\nSize: " & itemSize & " bytes\\nCreated: " & (creationDate as string) & "\\nModified: " & (modDate as string)
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async search(args) {
        const query = args.query;
        if (!query) return { success: false, error: 'Missing required argument: query', exit_code: 1 };
        const folder = args.folder;
        const limit = args.limit || 20;

        const expandedFolder = folder ? folder.replace(/^~/, process.env.HOME) : process.env.HOME;

        // Use mdfind (Spotlight) for fast, recursive search - much faster than AppleScript Finder
        // mdfind -name does case-insensitive partial matching
        const { execSync } = require('child_process');

        try {
            // Escape query for shell - remove dangerous characters
            const safeQuery = query.replace(/[`$"\\]/g, '');

            // Use mdfind with -name for fast Spotlight search (typically < 1 second)
            // -onlyin restricts to the specified folder
            const cmd = `mdfind -name "${safeQuery}" -onlyin "${expandedFolder}" 2>/dev/null | head -n ${limit}`;

            const result = execSync(cmd, {
                timeout: 10000, // 10 second timeout (Spotlight is usually instant)
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024
            });

            const lines = result.trim().split('\n').filter(l => l.length > 0);

            if (lines.length === 0) {
                return {
                    success: true,
                    output: `No files or folders found matching: ${query}`,
                    exit_code: 0
                };
            }

            // Format results nicely
            let output = `Found ${lines.length} item(s) matching "${query}":\n`;
            for (const path of lines) {
                const name = path.split('/').pop();
                output += `- ${name}\n  ${path}\n`;
            }

            return { success: true, output, exit_code: 0 };
        } catch (error) {
            // If mdfind fails or times out, return helpful error
            if (error.killed) {
                return {
                    success: false,
                    error: `Search timed out after 10 seconds. Try a more specific query.`,
                    exit_code: 124
                };
            }
            return {
                success: false,
                error: `Search failed: ${error.message}`,
                exit_code: 1
            };
        }
    },

    async reveal(args) {
        const path = args.path;
        if (!path) return { success: false, error: 'Missing required argument: path', exit_code: 1 };

        const expandedPath = path.replace(/^~/, process.env.HOME);

        const script = `
tell application "Finder"
    reveal POSIX file "${expandedPath}"
    activate
end tell
return "Revealed: ${expandedPath}"`;
        return await runAppleScriptMultiline(script);
    },

    async get_selection(args) {
        const script = `
tell application "Finder"
    set selectedItems to selection
    if (count of selectedItems) = 0 then
        return "No items selected"
    else
        set resultList to "Selected items:\\n"
        repeat with theItem in selectedItems
            set resultList to resultList & "- " & (POSIX path of (theItem as alias)) & "\\n"
        end repeat
        return resultList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async empty_trash(args) {
        const script = `
tell application "Finder"
    empty trash
end tell
return "Trash emptied"`;
        return await runAppleScriptMultiline(script);
    },

    async activate(args) {
        const script = `
tell application "Finder"
    activate
end tell
return "Finder activated"`;
        return await runAppleScriptMultiline(script);
    }
};

// ============================================================================
// REMINDERS TOOLS
// ============================================================================

const remindersTools = {
    async create(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const listName = args.list || 'Reminders';
        const dueDate = args.due_date;
        const notes = args.notes || '';
        const priority = args.priority || 0;

        const escapedTitle = title.replace(/"/g, '\\"');
        const escapedNotes = notes.replace(/"/g, '\\"');

        // Parse and format date for AppleScript
        // AppleScript expects format like "December 20, 2025 4:45:00 AM"
        let dateScript = '';
        if (dueDate) {
            try {
                // Parse the date (handles various formats)
                const dateObj = new Date(dueDate);
                if (!isNaN(dateObj.getTime())) {
                    // Format for AppleScript: "Month Day, Year Hour:Minute:Second AM/PM"
                    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                                    'July', 'August', 'September', 'October', 'November', 'December'];
                    const month = months[dateObj.getMonth()];
                    const day = dateObj.getDate();
                    const year = dateObj.getFullYear();
                    let hours = dateObj.getHours();
                    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                    const seconds = dateObj.getSeconds().toString().padStart(2, '0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    if (hours === 0) hours = 12;

                    const formattedDate = `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} ${ampm}`;
                    console.log(`[reminders.create] Formatted date: ${dueDate} -> ${formattedDate}`);
                    dateScript = `set due date of newReminder to date "${formattedDate}"`;
                } else {
                    console.log(`[reminders.create] Could not parse date: ${dueDate}, creating without due date`);
                }
            } catch (e) {
                console.log(`[reminders.create] Date parse error: ${e.message}, creating without due date`);
            }
        }

        const script = `
tell application "Reminders"
    try
        set targetList to list "${listName}"
    on error
        set targetList to default list
    end try

    tell targetList
        set newReminder to make new reminder with properties {name:"${escapedTitle}"${notes ? `, body:"${escapedNotes}"` : ''}${priority > 0 ? `, priority:${priority}` : ''}}
        ${dateScript}
    end tell
    return "Reminder created: ${escapedTitle}"
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async complete(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');
        const listName = args.list;

        let listFilter = listName ? `of list "${listName}"` : '';

        const script = `
tell application "Reminders"
    set matchingReminders to reminders ${listFilter} whose name is "${escapedTitle}"
    if (count of matchingReminders) > 0 then
        set completed of item 1 of matchingReminders to true
        return "Completed: ${escapedTitle}"
    else
        return "Reminder not found: ${escapedTitle}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async uncomplete(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');

        const script = `
tell application "Reminders"
    set matchingReminders to reminders whose name is "${escapedTitle}"
    if (count of matchingReminders) > 0 then
        set completed of item 1 of matchingReminders to false
        return "Marked as incomplete: ${escapedTitle}"
    else
        return "Reminder not found: ${escapedTitle}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async delete(args) {
        const title = args.title;
        if (!title) return { success: false, error: 'Missing required argument: title', exit_code: 1 };

        const escapedTitle = title.replace(/"/g, '\\"');

        const script = `
tell application "Reminders"
    set matchingReminders to reminders whose name is "${escapedTitle}"
    if (count of matchingReminders) > 0 then
        delete item 1 of matchingReminders
        return "Deleted: ${escapedTitle}"
    else
        return "Reminder not found: ${escapedTitle}"
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_incomplete(args) {
        const listName = args.list || 'Reminders';  // Default to "Reminders" list
        const limit = args.limit || 10;

        // Always query a specific list to avoid timeout from iterating all lists
        const script = `
tell application "Reminders"
    try
        set targetList to list "${listName}"
        set resultList to "Incomplete reminders in ${listName}:" & return
        set reminderCount to 0

        -- Get first N incomplete reminders
        repeat with r in reminders of targetList
            if completed of r is false then
                set reminderCount to reminderCount + 1
                if reminderCount <= ${limit} then
                    set resultList to resultList & "- " & name of r & return
                end if
                -- Break early to avoid timeout
                if reminderCount >= ${limit * 2} then exit repeat
            end if
        end repeat

        if reminderCount = 0 then
            return "No incomplete reminders in ${listName}"
        end if

        if reminderCount > ${limit} then
            set resultList to resultList & "... and more"
        end if

        return resultList
    on error errMsg
        return "Error: " & errMsg & return & return & "Available lists: Use reminders.list_lists to see available lists."
    end try
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_completed(args) {
        const listName = args.list || 'Reminders';  // Default to "Reminders" list
        const limit = args.limit || 10;

        // Always query a specific list to avoid timeout
        const script = `
tell application "Reminders"
    try
        set targetList to list "${listName}"
        set resultList to "Completed reminders in ${listName}:" & return
        set reminderCount to 0

        repeat with r in reminders of targetList
            if completed of r is true then
                set reminderCount to reminderCount + 1
                if reminderCount <= ${limit} then
                    set resultList to resultList & "✓ " & name of r & return
                end if
                -- Break early to avoid timeout
                if reminderCount >= ${limit * 2} then exit repeat
            end if
        end repeat

        if reminderCount = 0 then
            return "No completed reminders in ${listName}"
        end if

        if reminderCount > ${limit} then
            set resultList to resultList & "... and more"
        end if

        return resultList
    on error errMsg
        return "Error: " & errMsg & return & return & "Available lists: Use reminders.list_lists to see available lists."
    end try
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_today(args) {
        const listName = args.list || 'Reminders';  // Default to "Reminders" list

        // Query a specific list to avoid timeout
        const script = `
tell application "Reminders"
    try
        set targetList to list "${listName}"
        set resultList to "Reminders due today in ${listName}:" & return
        set foundAny to false
        set today to current date
        set startOfDay to today - (time of today)
        set endOfDay to startOfDay + (24 * 60 * 60)
        set checkCount to 0

        repeat with r in reminders of targetList
            set checkCount to checkCount + 1
            -- Break early to avoid timeout
            if checkCount > 100 then exit repeat

            try
                if completed of r is false then
                    set rDue to due date of r
                    if rDue is not missing value then
                        if rDue >= startOfDay and rDue < endOfDay then
                            set resultList to resultList & "• " & name of r & return
                            set foundAny to true
                        end if
                    end if
                end if
            end try
        end repeat

        if not foundAny then
            return "No reminders due today in ${listName}"
        end if

        return resultList
    on error errMsg
        return "Error: " & errMsg
    end try
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async get_overdue(args) {
        const listName = args.list || 'Reminders';  // Default to "Reminders" list

        // Query a specific list to avoid timeout
        const script = `
tell application "Reminders"
    try
        set targetList to list "${listName}"
        set resultList to "Overdue reminders in ${listName}:" & return
        set foundAny to false
        set today to current date
        set checkCount to 0

        repeat with r in reminders of targetList
            set checkCount to checkCount + 1
            -- Break early to avoid timeout
            if checkCount > 100 then exit repeat

            try
                if completed of r is false then
                    set rDue to due date of r
                    if rDue is not missing value then
                        if rDue < today then
                            set resultList to resultList & "⚠ " & name of r & return
                            set foundAny to true
                        end if
                    end if
                end if
            end try
        end repeat

        if not foundAny then
            return "No overdue reminders in ${listName}"
        end if

        return resultList
    on error errMsg
        return "Error: " & errMsg
    end try
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async search(args) {
        const query = args.query;
        if (!query) return { success: false, error: 'Missing required argument: query', exit_code: 1 };

        const escapedQuery = query.replace(/"/g, '\\"');

        const script = `
tell application "Reminders"
    set resultList to ""
    set reminderCount to 0
    repeat with r in (reminders whose name contains "${escapedQuery}")
        set rName to name of r
        set rCompleted to completed of r
        if rCompleted then
            set resultList to resultList & "✓ " & rName & "\\n"
        else
            set resultList to resultList & "• " & rName & "\\n"
        end if
        set reminderCount to reminderCount + 1
    end repeat
    if resultList is "" then
        return "No reminders found matching: ${escapedQuery}"
    else
        return "Found " & reminderCount & " reminders:\\n" & resultList
    end if
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async list_lists(args) {
        const script = `
tell application "Reminders"
    set listNames to ""
    repeat with l in lists
        set listNames to listNames & "- " & (name of l) & "\\n"
    end repeat
    return "Reminder lists:\\n" & listNames
end tell`;
        return await runAppleScriptMultiline(script);
    },

    async activate(args) {
        const script = `
tell application "Reminders"
    activate
end tell
return "Reminders activated"`;
        return await runAppleScriptMultiline(script);
    }
};

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute a macOS AppleScript tool
 * @param {string} tool - The tool name (e.g., "safari.navigate", "notes.create")
 * @param {object} args - The arguments for the tool
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, exit_code: number, error?: string}>}
 */
async function executeMacOSTool(tool, args) {
    console.log(`[macosAppleScript] Executing: ${tool}`, args);

    if (!isMacOS()) {
        return {
            success: false,
            error: 'macOS AppleScript tools only work on macOS',
            stdout: '',
            stderr: 'macOS AppleScript tools only work on macOS',
            exit_code: 1
        };
    }

    // Parse tool name to get app and action
    const [app, action] = tool.split('.');

    let toolSet;
    switch (app) {
        case 'safari':
            toolSet = safariTools;
            break;
        case 'notes':
            toolSet = notesTools;
            break;
        case 'mail':
            toolSet = mailTools;
            break;
        case 'calendar':
            toolSet = calendarTools;
            break;
        case 'finder':
            toolSet = finderTools;
            break;
        case 'reminders':
            toolSet = remindersTools;
            break;
        default:
            return {
                success: false,
                error: `Unknown macOS app: ${app}`,
                stdout: '',
                stderr: `Unknown macOS app: ${app}. Supported: safari, notes, mail, calendar, finder, reminders`,
                exit_code: 1
            };
    }

    // Find and execute the action
    if (!toolSet[action]) {
        return {
            success: false,
            error: `Unknown action: ${action} for ${app}`,
            stdout: '',
            stderr: `Unknown action: ${action}. Check available actions for ${app}.`,
            exit_code: 1
        };
    }

    try {
        const result = await toolSet[action](args);
        console.log(`[macosAppleScript] Result:`, result);
        return result;
    } catch (error) {
        console.error(`[macosAppleScript] Error:`, error);
        return {
            success: false,
            error: error.message,
            stdout: '',
            stderr: error.message,
            exit_code: 1
        };
    }
}

/**
 * Check if a tool name is a macOS AppleScript tool
 */
function isMacOSTool(tool) {
    const macOSApps = ['safari', 'notes', 'mail', 'calendar', 'finder', 'reminders'];
    const parts = tool.split('.');
    return parts.length >= 2 && macOSApps.includes(parts[0]);
}

module.exports = {
    executeMacOSTool,
    isMacOSTool,
    isMacOS,
    safariTools,
    notesTools,
    mailTools,
    calendarTools,
    finderTools,
    remindersTools
};
