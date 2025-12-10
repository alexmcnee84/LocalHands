import React from 'react';

interface SidebarProps {
  config: {
    workspaceDir: string;
    modelPath?: string;
    modelLoaded: boolean;
    confirmDestructive: boolean;
    maxIterations: number;
  } | null;
  onLoadModel: () => void;
  onSetWorkspace: () => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  config,
  onLoadModel,
  onSetWorkspace,
  onClearHistory,
  onOpenSettings,
}) => {
  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="h-14 border-b border-gray-700 flex items-center px-4">
        <span className="text-xl font-bold text-blue-400">🤖 LocalHands</span>
      </div>

      {/* Model Status */}
      <div className="p-4 border-b border-gray-700">
        <div className="text-sm text-gray-400 mb-2">Model Status</div>
        <div className={`flex items-center gap-2 ${config?.modelLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
          <div className={`w-2 h-2 rounded-full ${config?.modelLoaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="text-sm">
            {config?.modelLoaded ? 'Loaded' : 'Not loaded'}
          </span>
        </div>
        {config?.modelPath && (
          <div className="mt-2 text-xs text-gray-500 truncate" title={config.modelPath}>
            {config.modelPath.split('/').pop()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-1 p-4 space-y-2">
        <button
          onClick={onLoadModel}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <span>📂</span>
          <span>Load Model</span>
        </button>

        <button
          onClick={onSetWorkspace}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <span>📁</span>
          <span>Set Workspace</span>
        </button>

        <button
          onClick={onClearHistory}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <span>🗑️</span>
          <span>Clear History</span>
        </button>
      </div>

      {/* Workspace Info */}
      {config?.workspaceDir && (
        <div className="p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Workspace</div>
          <div className="text-xs text-gray-500 truncate" title={config.workspaceDir}>
            {config.workspaceDir}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onOpenSettings}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
