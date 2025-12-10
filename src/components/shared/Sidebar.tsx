import React from "react";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function Sidebar({ isOpen, onToggle, children }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-base-secondary border-r border-tertiary transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-tertiary">
            <h1 className="text-xl font-bold text-primary">LocalHands</h1>
            <button
              onClick={onToggle}
              className="p-2 rounded-lg hover:bg-tertiary transition-colors lg:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {children || (
              <div className="text-basic text-sm">
                <p>No conversations yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-tertiary">
            <button className="w-full flex items-center gap-2 px-4 py-2 bg-primary text-base rounded-lg hover:bg-primary/90 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Chat
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
