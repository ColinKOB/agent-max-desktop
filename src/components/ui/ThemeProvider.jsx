/**
 * Theme Provider Component
 * Advanced theming system with liquid glass support
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme presets
const themes = {
  light: {
    name: 'Light',
    class: 'theme-light',
    colors: {
      primary: '82 146 255',
      secondary: '122 83 255',
      accent: '15 181 174',
      background: '255 255 255',
      surface: '248 250 252',
      text: '16 18 30',
      textSecondary: '60 64 78',
      border: '226 232 240'
    },
    glass: {
      alpha: 0.28,
      blur: '28px',
      saturation: 1.6
    }
  },
  dark: {
    name: 'Dark',
    class: 'theme-dark',
    colors: {
      primary: '96 165 250',
      secondary: '147 107 255',
      accent: '20 184 166',
      background: '10 10 15',
      surface: '20 20 28',
      text: '248 250 252',
      textSecondary: '156 163 175',
      border: '55 65 81'
    },
    glass: {
      alpha: 0.12,
      blur: '32px',
      saturation: 1.4
    }
  },
  ocean: {
    name: 'Ocean',
    class: 'theme-ocean',
    colors: {
      primary: '59 130 246',
      secondary: '6 182 212',
      accent: '34 211 238',
      background: '240 249 255',
      surface: '224 242 254',
      text: '7 89 133',
      textSecondary: '12 74 110',
      border: '186 230 253'
    },
    glass: {
      alpha: 0.22,
      blur: '24px',
      saturation: 1.5
    }
  },
  sunset: {
    name: 'Sunset',
    class: 'theme-sunset',
    colors: {
      primary: '251 146 60',
      secondary: '244 63 94',
      accent: '236 72 153',
      background: '255 251 235',
      surface: '254 243 199',
      text: '92 45 10',
      textSecondary: '120 53 15',
      border: '253 224 71'
    },
    glass: {
      alpha: 0.25,
      blur: '26px',
      saturation: 1.7
    }
  },
  forest: {
    name: 'Forest',
    class: 'theme-forest',
    colors: {
      primary: '34 197 94',
      secondary: '16 185 129',
      accent: '52 211 153',
      background: '240 253 244',
      surface: '220 252 231',
      text: '20 83 45',
      textSecondary: '22 101 52',
      border: '187 247 208'
    },
    glass: {
      alpha: 0.24,
      blur: '25px',
      saturation: 1.6
    }
  },
  midnight: {
    name: 'Midnight',
    class: 'theme-midnight',
    colors: {
      primary: '139 92 246',
      secondary: '167 139 250',
      accent: '196 181 253',
      background: '15 7 30',
      surface: '25 15 45',
      text: '243 244 246',
      textSecondary: '209 213 219',
      border: '75 65 95'
    },
    glass: {
      alpha: 0.15,
      blur: '35px',
      saturation: 1.3
    }
  }
};

// Accent colors for customization
const accentColors = {
  blue: '59 130 246',
  purple: '147 51 234',
  green: '34 197 94',
  orange: '251 146 60',
  red: '239 68 68',
  pink: '236 72 153',
  cyan: '6 182 212',
  yellow: '250 204 21'
};

// Theme context
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [customAccent, setCustomAccent] = useState(null);
  const [animations, setAnimations] = useState(true);
  const [transparency, setTransparency] = useState(true);
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem('theme-preferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      setCurrentTheme(prefs.theme || 'light');
      setCustomAccent(prefs.accent || null);
      setAnimations(prefs.animations !== false);
      setTransparency(prefs.transparency !== false);
      setFontSize(prefs.fontSize || 'medium');
    }
    
    // Check system preference
    if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setCurrentTheme('dark');
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    const theme = themes[currentTheme];
    const root = document.documentElement;
    
    // Remove old theme classes
    Object.values(themes).forEach(t => {
      root.classList.remove(t.class);
    });
    
    // Add new theme class
    root.classList.add(theme.class);
    
    // Set CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
    
    // Set glass variables
    root.style.setProperty('--glass-alpha', theme.glass.alpha);
    root.style.setProperty('--glass-blur', theme.glass.blur);
    root.style.setProperty('--glass-saturation', theme.glass.saturation);
    
    // Apply custom accent if set
    if (customAccent) {
      root.style.setProperty('--theme-accent', accentColors[customAccent]);
    }
    
    // Apply animations preference
    root.classList.toggle('no-animations', !animations);
    
    // Apply transparency preference
    root.classList.toggle('no-transparency', !transparency);
    
    // Apply font size
    root.classList.remove('text-small', 'text-medium', 'text-large');
    root.classList.add(`text-${fontSize}`);
    
    // Save preferences
    localStorage.setItem('theme-preferences', JSON.stringify({
      theme: currentTheme,
      accent: customAccent,
      animations,
      transparency,
      fontSize
    }));
  }, [currentTheme, customAccent, animations, transparency, fontSize]);

  // Theme API
  const value = {
    // Current settings
    theme: currentTheme,
    themeName: themes[currentTheme].name,
    accent: customAccent,
    animations,
    transparency,
    fontSize,
    
    // Available options
    themes: Object.keys(themes),
    accentColors: Object.keys(accentColors),
    
    // Setters
    setTheme: setCurrentTheme,
    setAccent: setCustomAccent,
    setAnimations,
    setTransparency,
    setFontSize,
    
    // Helpers
    toggleTheme: () => {
      const themeKeys = Object.keys(themes);
      const currentIndex = themeKeys.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % themeKeys.length;
      setCurrentTheme(themeKeys[nextIndex]);
    },
    
    toggleDarkMode: () => {
      setCurrentTheme(current => current === 'dark' ? 'light' : 'dark');
    },
    
    reset: () => {
      setCurrentTheme('light');
      setCustomAccent(null);
      setAnimations(true);
      setTransparency(true);
      setFontSize('medium');
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Theme selector component
export function ThemeSelector() {
  const { 
    theme, 
    themes: availableThemes, 
    setTheme,
    accent,
    accentColors: availableAccents,
    setAccent,
    animations,
    setAnimations,
    transparency,
    setTransparency,
    fontSize,
    setFontSize
  } = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Theme button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Theme settings"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
        </svg>
      </button>

      {/* Theme panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="fixed right-4 top-16 z-50 w-80 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Theme Settings</h3>
            
            {/* Theme selection */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {availableThemes.map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                      theme === t
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {themes[t].name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Accent color */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Accent Color</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(availableAccents).map(color => (
                  <button
                    key={color}
                    onClick={() => setAccent(accent === color ? null : color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      accent === color
                        ? 'border-gray-900 dark:border-white scale-110'
                        : 'border-transparent hover:scale-110'
                    }`}
                    style={{ 
                      backgroundColor: `rgb(${accentColors[color]})` 
                    }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            
            {/* Font size */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Font Size</label>
              <div className="flex gap-2">
                {['small', 'medium', 'large'].map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                      fontSize === size
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Settings */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={animations}
                  onChange={(e) => setAnimations(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Enable animations</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={transparency}
                  onChange={(e) => setTransparency(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Enable transparency</span>
              </label>
            </div>
          </div>
        </>
      )}
    </>
  );
}
