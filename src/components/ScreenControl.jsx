import { useState, useEffect } from 'react';
import {
  Monitor,
  Mouse,
  Keyboard,
  Camera,
  Eye,
  Info,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { screenAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ScreenControl() {
  const [screenInfo, setScreenInfo] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('click');

  // Form states
  const [clickX, setClickX] = useState('');
  const [clickY, setClickY] = useState('');
  const [textToType, setTextToType] = useState('');
  const [textToFind, setTextToFind] = useState('');
  const [elementDesc, setElementDesc] = useState('');

  useEffect(() => {
    loadScreenData();
    // Refresh screen info every 2 seconds
    const interval = setInterval(loadScreenData, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadScreenData = async () => {
    try {
      const [infoRes, capsRes] = await Promise.all([
        screenAPI.getInfo().catch(() => null),
        screenAPI.getCapabilities().catch(() => null),
      ]);

      if (infoRes) setScreenInfo(infoRes.data);
      if (capsRes) setCapabilities(capsRes.data);
    } catch (error) {
      console.error('Failed to load screen data:', error);
    }
  };

  const handleClick = async () => {
    if (!clickX || !clickY) {
      toast.error('Enter both X and Y coordinates');
      return;
    }

    setLoading(true);
    try {
      await screenAPI.click(parseInt(clickX), parseInt(clickY));
      toast.success('Click executed!');
    } catch (error) {
      toast.error(`Click failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleType = async () => {
    if (!textToType) {
      toast.error('Enter text to type');
      return;
    }

    setLoading(true);
    try {
      await screenAPI.typeText(textToType);
      toast.success('Text typed!');
      setTextToType('');
    } catch (error) {
      toast.error(`Type failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClickText = async () => {
    if (!textToFind) {
      toast.error('Enter text to find');
      return;
    }

    setLoading(true);
    try {
      await screenAPI.clickText(textToFind);
      toast.success(`Found and clicked: "${textToFind}"`);
    } catch (error) {
      toast.error(`Text not found: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClickElement = async () => {
    if (!elementDesc) {
      toast.error('Describe the element');
      return;
    }

    setLoading(true);
    try {
      await screenAPI.clickElement(elementDesc);
      toast.success('Element clicked!');
    } catch (error) {
      toast.error(`Element not found: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshot = async () => {
    setLoading(true);
    try {
      const res = await screenAPI.takeScreenshot();
      toast.success(`Screenshot saved: ${res.data.path}`);
    } catch (error) {
      toast.error(`Screenshot failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header with live info */}
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold">Screen Control</h2>
          </div>
          {screenInfo && (
            <div className="text-xs text-gray-400 font-mono">
              {screenInfo.screen?.resolution} • ({screenInfo.mouse?.x}, {screenInfo.mouse?.y})
            </div>
          )}
        </div>

        {capabilities && !capabilities.available && (
          <div className="mt-2 flex items-center gap-2 text-xs text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            <span>Install: {capabilities.requirements?.missing_packages?.join(', ')}</span>
          </div>
        )}
      </div>

      
      <div className="flex gap-1 p-2 bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {[
          { id: 'click', label: 'Click', icon: Mouse },
          { id: 'type', label: 'Type', icon: Keyboard },
          { id: 'find', label: 'Find Text', icon: Eye },
          { id: 'ai', label: 'AI Click', icon: Eye },
          { id: 'screenshot', label: 'Screenshot', icon: Camera },
        ].map((tab) => {
          const Icon = tab.icon;
          const unavailable = capabilities && capabilities.available === false;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={unavailable}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                unavailable
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'click' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">X Coordinate</label>
                <input
                  type="number"
                  value={clickX}
                  onChange={(e) => setClickX(e.target.value)}
                  placeholder="500"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Y Coordinate</label>
                <input
                  type="number"
                  value={clickY}
                  onChange={(e) => setClickY(e.target.value)}
                  placeholder="300"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleClick}
              disabled={loading || !clickX || !clickY || (capabilities && capabilities.available === false)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mouse className="w-4 h-4" />
              )}
              Click at Coordinates
            </button>
          </div>
        )}

        {activeTab === 'type' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Text to Type</label>
              <textarea
                value={textToType}
                onChange={(e) => setTextToType(e.target.value)}
                placeholder="Enter text..."
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleType}
              disabled={loading || !textToType || (capabilities && capabilities.available === false)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Keyboard className="w-4 h-4" />
              )}
              Type Text
            </button>
          </div>
        )}

        {activeTab === 'find' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Text to Find (OCR)</label>
              <input
                type="text"
                value={textToFind}
                onChange={(e) => setTextToFind(e.target.value)}
                placeholder="e.g., Submit, Save, OK"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleClickText}
              disabled={loading || !textToFind || (capabilities && capabilities.available === false)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Find & Click
            </button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Element Description</label>
              <input
                type="text"
                value={elementDesc}
                onChange={(e) => setElementDesc(e.target.value)}
                placeholder="e.g., the blue submit button"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleClickElement}
              disabled={loading || !elementDesc || (capabilities && capabilities.available === false)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              AI Click Element
            </button>
          </div>
        )}

        {activeTab === 'screenshot' && (
          <div className="space-y-3">
            <button
              onClick={handleScreenshot}
              disabled={loading || (capabilities && capabilities.available === false)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              Take Screenshot
            </button>
            <div className="text-xs text-gray-400 text-center">
              Screenshots are saved to state/screenshots/
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
