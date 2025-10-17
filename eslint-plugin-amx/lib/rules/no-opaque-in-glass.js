/**
 * ESLint Rule: no-opaque-in-glass
 * 
 * Prevents use of opaque Tailwind utility classes (bg-gray-*, border-gray-*, text-gray-*)
 * in components using glass design system utilities (amx-*-glass classes).
 * 
 * This enforces design system consistency and prevents accidental use of
 * solid backgrounds that break the liquid glass aesthetic.
 * 
 * @example
 * // ❌ Bad - opaque classes in glass context
 * <div className="amx-settings-panel">
 *   <div className="bg-gray-800 text-gray-100">...</div>
 * </div>
 * 
 * // ✅ Good - glass utilities throughout
 * <div className="amx-settings-panel">
 *   <div className="bg-white/10 text-white/95">...</div>
 * </div>
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow opaque Tailwind classes in glass design contexts',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      opaqueInGlass: 'Opaque Tailwind class "{{className}}" found in glass context. Use amx-* glass utilities or white/[opacity] instead.',
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    // Banned class prefixes
    const bannedPrefixes = [
      'bg-gray-',
      'border-gray-',
      'text-gray-',
      'dark:bg-gray-',
      'dark:border-gray-',
      'dark:text-gray-',
    ];

    // Glass context indicators
    const glassPatterns = [
      /amx-.*-glass/,
      /amx-settings-panel/,
      /amx-stat-card/,
      /amx-tag-glass/,
    ];

    /**
     * Check if a node is within a glass context
     * @param {Object} node - AST node
     * @returns {boolean}
     */
    function isInGlassContext(node) {
      let current = node;
      while (current) {
        // Check JSX element's className
        if (current.type === 'JSXElement') {
          const classNameAttr = current.openingElement.attributes.find(
            attr => attr.type === 'JSXAttribute' && attr.name.name === 'className'
          );

          if (classNameAttr && classNameAttr.value) {
            const classNameValue = context.getSourceCode().getText(classNameAttr.value);
            if (glassPatterns.some(pattern => pattern.test(classNameValue))) {
              return true;
            }
          }
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Extract banned class names from className string
     * @param {string} classNameStr - Full className value
     * @returns {string[]}
     */
    function findBannedClasses(classNameStr) {
      const banned = [];
      for (const prefix of bannedPrefixes) {
        if (classNameStr.includes(prefix)) {
          // Extract the full class name
          const regex = new RegExp(`(${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\w-]+)`, 'g');
          const matches = classNameStr.match(regex);
          if (matches) {
            banned.push(...matches);
          }
        }
      }
      return banned;
    }

    return {
      JSXAttribute(node) {
        // Only check className attributes
        if (node.name.name !== 'className') return;
        if (!node.value) return;

        // Get the className value as string
        const classNameValue = context.getSourceCode().getText(node.value);

        // Check if we're in a glass context
        if (!isInGlassContext(node)) return;

        // Find any banned classes
        const bannedClasses = findBannedClasses(classNameValue);

        // Report each violation
        for (const bannedClass of bannedClasses) {
          context.report({
            node: node.value,
            messageId: 'opaqueInGlass',
            data: {
              className: bannedClass,
            },
          });
        }
      },
    };
  },
};
