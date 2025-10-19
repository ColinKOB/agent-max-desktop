/**
 * Accessibility Panel Component
 * Comprehensive accessibility controls with liquid glass styling
 */
import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX,
  Type,
  Palette,
  MousePointer,
  Keyboard,
  Settings,
  X
} from 'lucide-react';
import { LiquidGlassCard } from './LiquidGlassCard';

export function AccessibilityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    // Visual
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    darkMode: false,
    colorBlindMode: 'none', // none, protanopia, deuteranopia, tritanopia
    
    // Audio
    screenReader: false,
    soundEffects: true,
    
    // Navigation
    keyboardNavigation: true,
    focusIndicators: true,
    skipLinks: true,
    
    // Reading
    dyslexicFont: false,
    lineHeight: 'normal', // compact, normal, relaxed
    letterSpacing: 'normal', // tight, normal, wide
    
    // Interaction
    clickHelper: false,
    tapTargetSize: 'normal', // small, normal, large
    autoComplete: true
  });

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  // Apply settings
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast
    root.classList.toggle('high-contrast', settings.highContrast);
    
    // Large text
    root.classList.toggle('large-text', settings.largeText);
    
    // Reduce motion
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    
    // Dark mode
    root.classList.toggle('dark', settings.darkMode);
    
    // Color blind modes
    root.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
    if (settings.colorBlindMode !== 'none') {
      root.classList.add(settings.colorBlindMode);
    }
    
    // Dyslexic font
    root.classList.toggle('dyslexic-font', settings.dyslexicFont);
    
    // Line height
    root.classList.remove('line-compact', 'line-normal', 'line-relaxed');
    root.classList.add(`line-${settings.lineHeight}`);
    
    // Letter spacing
    root.classList.remove('spacing-tight', 'spacing-normal', 'spacing-wide');
    root.classList.add(`spacing-${settings.letterSpacing}`);
    
    // Focus indicators
    root.classList.toggle('enhanced-focus', settings.focusIndicators);
    
    // Tap target size
    root.classList.remove('tap-small', 'tap-normal', 'tap-large');
    root.classList.add(`tap-${settings.tapTargetSize}`);
    
    // Save settings
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    
    // Announce changes to screen readers
    if (window.ariaLive) {
      window.ariaLive.announce('Accessibility settings updated');
    }
  }, [settings]);

  // Toggle setting
  const toggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Set option
  const setOption = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Quick presets
  const applyPreset = (preset) => {
    switch (preset) {
      case 'vision':
        setSettings(prev => ({
          ...prev,
          highContrast: true,
          largeText: true,
          focusIndicators: true
        }));
        break;
      case 'motor':
        setSettings(prev => ({
          ...prev,
          tapTargetSize: 'large',
          clickHelper: true,
          keyboardNavigation: true
        }));
        break;
      case 'cognitive':
        setSettings(prev => ({
          ...prev,
          reduceMotion: true,
          dyslexicFont: true,
          lineHeight: 'relaxed'
        }));
        break;
      case 'reset':
        setSettings({
          highContrast: false,
          largeText: false,
          reduceMotion: false,
          darkMode: false,
          colorBlindMode: 'none',
          screenReader: false,
          soundEffects: true,
          keyboardNavigation: true,
          focusIndicators: true,
          skipLinks: true,
          dyslexicFont: false,
          lineHeight: 'normal',
          letterSpacing: 'normal',
          clickHelper: false,
          tapTargetSize: 'normal',
          autoComplete: true
        });
        break;
    }
  };

  return (
    <>
      {/* Accessibility Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Accessibility settings"
      >
        <Eye className="w-5 h-5" />
      </button>

      {/* Accessibility Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="fixed right-4 top-16 z-50 w-96 max-h-[600px] animate-slide-in">
            <LiquidGlassCard variant="elevated" className="flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Accessibility</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Quick presets */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => applyPreset('vision')}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg"
                  >
                    Vision
                  </button>
                  <button
                    onClick={() => applyPreset('motor')}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-lg"
                  >
                    Motor
                  </button>
                  <button
                    onClick={() => applyPreset('cognitive')}
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg"
                  >
                    Cognitive
                  </button>
                  <button
                    onClick={() => applyPreset('reset')}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Reset
                  </button>
                </div>
              </div>
              
              {/* Settings */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Visual Settings */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Visual
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.highContrast}
                        onChange={() => toggleSetting('highContrast')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">High Contrast</div>
                        <div className="text-xs text-gray-500">Increase color contrast for better readability</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.largeText}
                        onChange={() => toggleSetting('largeText')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Large Text</div>
                        <div className="text-xs text-gray-500">Increase font size throughout the app</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.reduceMotion}
                        onChange={() => toggleSetting('reduceMotion')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Reduce Motion</div>
                        <div className="text-xs text-gray-500">Minimize animations and transitions</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.darkMode}
                        onChange={() => toggleSetting('darkMode')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Dark Mode</div>
                        <div className="text-xs text-gray-500">Use dark color scheme</div>
                      </div>
                    </label>
                    
                    <div>
                      <label className="text-sm font-medium block mb-1">Color Blind Mode</label>
                      <select
                        value={settings.colorBlindMode}
                        onChange={(e) => setOption('colorBlindMode', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                      >
                        <option value="none">None</option>
                        <option value="protanopia">Protanopia (Red-blind)</option>
                        <option value="deuteranopia">Deuteranopia (Green-blind)</option>
                        <option value="tritanopia">Tritanopia (Blue-blind)</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Audio Settings */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Audio
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.screenReader}
                        onChange={() => toggleSetting('screenReader')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Screen Reader Support</div>
                        <div className="text-xs text-gray-500">Optimize for screen reader software</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.soundEffects}
                        onChange={() => toggleSetting('soundEffects')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Sound Effects</div>
                        <div className="text-xs text-gray-500">Play audio feedback for actions</div>
                      </div>
                    </label>
                  </div>
                </div>
                
                {/* Navigation Settings */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Navigation
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.keyboardNavigation}
                        onChange={() => toggleSetting('keyboardNavigation')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Keyboard Navigation</div>
                        <div className="text-xs text-gray-500">Navigate using keyboard only</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.focusIndicators}
                        onChange={() => toggleSetting('focusIndicators')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Enhanced Focus Indicators</div>
                        <div className="text-xs text-gray-500">Show clear focus outlines</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.skipLinks}
                        onChange={() => toggleSetting('skipLinks')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Skip Links</div>
                        <div className="text-xs text-gray-500">Quick navigation to main content</div>
                      </div>
                    </label>
                  </div>
                </div>
                
                {/* Reading Settings */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Reading
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.dyslexicFont}
                        onChange={() => toggleSetting('dyslexicFont')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Dyslexic Font</div>
                        <div className="text-xs text-gray-500">Use OpenDyslexic font for better readability</div>
                      </div>
                    </label>
                    
                    <div>
                      <label className="text-sm font-medium block mb-1">Line Height</label>
                      <div className="flex gap-2">
                        {['compact', 'normal', 'relaxed'].map(height => (
                          <button
                            key={height}
                            onClick={() => setOption('lineHeight', height)}
                            className={`flex-1 px-2 py-1 text-xs rounded capitalize ${
                              settings.lineHeight === height
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            {height}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium block mb-1">Letter Spacing</label>
                      <div className="flex gap-2">
                        {['tight', 'normal', 'wide'].map(spacing => (
                          <button
                            key={spacing}
                            onClick={() => setOption('letterSpacing', spacing)}
                            className={`flex-1 px-2 py-1 text-xs rounded capitalize ${
                              settings.letterSpacing === spacing
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            {spacing}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Interaction Settings */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Interaction
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.clickHelper}
                        onChange={() => toggleSetting('clickHelper')}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Click Helper</div>
                        <div className="text-xs text-gray-500">Make clickable areas more visible</div>
                      </div>
                    </label>
                    
                    <div>
                      <label className="text-sm font-medium block mb-1">Touch Target Size</label>
                      <div className="flex gap-2">
                        {['small', 'normal', 'large'].map(size => (
                          <button
                            key={size}
                            onClick={() => setOption('tapTargetSize', size)}
                            className={`flex-1 px-2 py-1 text-xs rounded capitalize ${
                              settings.tapTargetSize === size
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 text-center">
                  Accessibility settings are saved automatically
                </p>
              </div>
            </LiquidGlassCard>
          </div>
        </>
      )}
    </>
  );
}
