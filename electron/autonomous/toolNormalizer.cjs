/**
 * Tool Name Normalizer
 *
 * Provides consistent tool name resolution across the application.
 * Maps all known aliases to their canonical tool names.
 *
 * This solves the problem of inconsistent tool name checking throughout
 * pullExecutor.cjs, where some tools check multiple variants and others don't.
 */

// Map of all known aliases to their canonical names
const TOOL_ALIASES = {
    // === SHELL TOOLS ===
    'shell_exec': 'shell.exec',
    'shell.command': 'shell.exec',
    'command': 'shell.exec',

    // === FILE TOOLS ===
    // fs.write and fs.read are already canonical

    // === WEB TOOLS ===
    'web_fetch': 'web.fetch',
    'web_search': 'browser',           // Legacy - both redirect to workspace.search
    'delegate_to_web_agent': 'web.delegate',
    'delegate_to_web_agents': 'web.delegate_parallel',

    // === SYSTEM TOOLS ===
    'start_background_process': 'system.start_process',
    'monitor_process': 'system.monitor_process',
    'stop_process': 'system.stop_process',
    'system_info': 'system.info',
    'notify': 'system.notify',
    'notification': 'system.notify',

    // === DESKTOP TOOLS ===
    'screenshot': 'desktop.screenshot',
    'mouse_click': 'desktop.mouse_click',
    'mouse.click': 'desktop.mouse_click',
    'mouse_move': 'desktop.mouse_move',
    'mouse.move': 'desktop.mouse_move',
    'type_text': 'desktop.type_text',
    'type': 'desktop.type_text',
    'hotkey': 'desktop.hotkey',
    'keyboard_shortcut': 'desktop.hotkey',

    // === CLIPBOARD TOOLS ===
    'clipboard_read': 'clipboard.read',
    'clipboard_write': 'clipboard.write',

    // === WINDOW TOOLS ===
    'list_apps': 'window.list_apps',
    'running_apps': 'window.list_apps',
    'focus_app': 'window.focus_app',
    'activate_app': 'window.focus_app',
    'get_active_window': 'window.get_active',
    'active_window': 'window.get_active',
    'resize_window': 'window.resize',
    'window_resize': 'window.resize',
    'arrange_windows': 'window.arrange',
    'window_arrange': 'window.arrange',

    // === UI TOOLS ===
    'show_options': 'ui.show_options',
    'comparison_table': 'ui.comparison_table',

    // === LEGACY TOOLS (still map for graceful handling) ===
    'speak': 'dictate',
    'say': 'dictate',
    'audio_play': 'play_sound',
    'watch_directory': 'file_watch',

    // === GOOGLE TOOLS ===
    'google_command': 'google.command'
};

/**
 * Normalize a tool name to its canonical form.
 *
 * @param {string} name - The tool name to normalize
 * @returns {string} - The canonical tool name
 *
 * @example
 * normalizeTool('shell_exec')  // returns 'shell.exec'
 * normalizeTool('shell.exec')  // returns 'shell.exec'
 * normalizeTool('unknown')     // returns 'unknown'
 */
function normalizeTool(name) {
    if (!name || typeof name !== 'string') {
        return name;
    }
    return TOOL_ALIASES[name] || name;
}

/**
 * Check if a tool name is an alias (not canonical).
 *
 * @param {string} name - The tool name to check
 * @returns {boolean} - True if the name is an alias
 */
function isAlias(name) {
    return name in TOOL_ALIASES;
}

/**
 * Get all aliases for a canonical tool name.
 *
 * @param {string} canonicalName - The canonical tool name
 * @returns {string[]} - Array of aliases (including the canonical name itself)
 */
function getAliases(canonicalName) {
    const aliases = [canonicalName];
    for (const [alias, canonical] of Object.entries(TOOL_ALIASES)) {
        if (canonical === canonicalName) {
            aliases.push(alias);
        }
    }
    return aliases;
}

module.exports = {
    TOOL_ALIASES,
    normalizeTool,
    isAlias,
    getAliases
};
