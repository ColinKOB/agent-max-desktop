import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const UpdateNotification = ({ updateInfo, updateProgress, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canShow, setCanShow] = useState(true);

  useEffect(() => {
    const checkViewport = () => {
      try {
        const h = window?.innerHeight || 0;
        const w = window?.innerWidth || 0;
        setCanShow(h >= 120 && w >= 200);
      } catch {
        setCanShow(true);
      }
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  if (!updateInfo || !canShow) return null;

  const handleDownload = () => {
    if (window.AMX?.showUpdate) {
      window.AMX.showUpdate('downloading');
      return;
    }
    if (window.electronAPI?.downloadUpdate) {
      window.electronAPI.downloadUpdate();
    }
  };

  const handleInstall = () => {
    if (window.AMX?.showUpdate) {
      try { window.AMX.showUpdate('clear'); } catch {}
      try { window.location.reload(); } catch {}
      return;
    }
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  const handleRestart = () => {
    if (window.AMX?.showUpdate) {
      try { window.AMX.showUpdate('clear'); } catch {}
      try { window.location.reload(); } catch {}
      return;
    }
    if (window.electronAPI?.restartForUpdate) {
      window.electronAPI.restartForUpdate();
    }
  };

  const renderContent = () => {
    // Error state
    if (updateInfo.error) {
      return (
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-200">Update Failed</p>
            <p className="text-xs text-red-300 mt-1">{updateInfo.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-red-200 hover:text-red-100 mt-2 underline"
            >
              Restart App
            </button>
          </div>
        </div>
      );
    }

    // Download progress
    if (updateProgress) {
      return (
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-200">Downloading Update</p>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-blue-300 mb-1">
                <span>{Math.round(updateProgress.percent)}%</span>
                <span>{Math.round(updateProgress.bytesPerSecond / 1024)} KB/s</span>
              </div>
              <div className="w-full bg-blue-900/50 rounded-full h-1.5">
                <div
                  className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Update downloaded and ready to install
    if (updateInfo.downloaded) {
      return (
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-200">
              Update Ready to Install
            </p>
            <p className="text-xs text-green-300 mt-1">
              Version {updateInfo.version} is downloaded. Restart to apply updates.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRestart}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded-md transition-colors"
              >
                Restart Now
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Update available
    return (
      <div className="flex items-start gap-3">
        <RefreshCw className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-200">
            Update Available
          </p>
          <p className="text-xs text-yellow-300 mt-1">
            Version {updateInfo.version} is ready to download.
          </p>
          {updateInfo.releaseNotes && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-yellow-200 hover:text-yellow-100 mt-2 underline"
            >
              {isExpanded ? 'Hide' : 'Show'} Release Notes
            </button>
          )}
          {isExpanded && updateInfo.releaseNotes && (
            <div className="mt-2 p-2 bg-black/20 rounded text-xs text-gray-300 max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{updateInfo.releaseNotes}</pre>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDownload}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded-md transition-colors"
            >
              Update Now
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[10050] pointer-events-auto max-w-sm">
      <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700 rounded-lg shadow-xl p-4 min-w-[320px]">
        <div className="flex items-start justify-between">
          {renderContent()}
          <button
            onClick={onDismiss}
            className="ml-3 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
