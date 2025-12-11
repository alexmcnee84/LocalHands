import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  config: {
    workspaceDir: string;
    modelPath?: string;
    modelLoaded: boolean;
    confirmDestructive: boolean;
    maxIterations: number;
  } | null;
  onClose: () => void;
  onLoadModel: () => void;
  onSetWorkspace: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onClose,
  onLoadModel,
  onSetWorkspace,
}) => {
  const [maxIterations, setMaxIterations] = useState(config?.maxIterations || 10);
  const [confirmDestructive, setConfirmDestructive] = useState(config?.confirmDestructive ?? true);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = async () => {
    try {
      await window.electronAPI.setConfig({
        maxIterations,
        confirmDestructive,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Model Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Model</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Current Model</div>
                  <div className="text-xs text-gray-500">
                    {config?.modelPath ? config.modelPath.split('/').pop() : 'No model loaded'}
                  </div>
                </div>
                <button
                  onClick={onLoadModel}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                >
                  {config?.modelLoaded ? 'Change Model' : 'Load Model'}
                </button>
              </div>
              <div className={`flex items-center gap-2 text-sm ${config?.modelLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                <div className={`w-2 h-2 rounded-full ${config?.modelLoaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {config?.modelLoaded ? 'Model loaded and ready' : 'No model loaded'}
              </div>
            </div>
          </div>

          {/* Workspace Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Workspace</h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">Workspace Directory</div>
                <div className="text-xs text-gray-500 truncate max-w-xs" title={config?.workspaceDir}>
                  {config?.workspaceDir || 'Not set'}
                </div>
              </div>
              <button
                onClick={onSetWorkspace}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                Change
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              All file operations and bash commands are sandboxed to this directory.
            </p>
          </div>

          {/* Agent Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Settings</h3>
            <div className="space-y-4">
              {/* Max Iterations */}
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm">Max Iterations</span>
                  <input
                    type="number"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(parseInt(e.target.value) || 10)}
                    min={1}
                    max={50}
                    className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Maximum number of tool calls per message (prevents infinite loops).
                </p>
              </div>

              {/* Confirm Destructive */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={confirmDestructive}
                    onChange={(e) => setConfirmDestructive(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Confirm destructive operations</span>
                </label>
                <p className="mt-1 text-xs text-gray-500 ml-7">
                  Ask for confirmation before executing potentially dangerous commands.
                </p>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">About</h3>
            <div className="text-sm text-gray-400">
              <p>LocalHands - Local AI Assistant with Sandbox Capabilities</p>
              <p className="mt-1 text-xs text-gray-500">
                Powered by node-llama-cpp for local GGUF model inference.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
