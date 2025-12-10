import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface ModelInfo {
  name: string;
  path: string;
  size_bytes: number;
  size_display: string;
  quantization: string | null;
  loaded: boolean;
}

interface LoadingProgress {
  progress: number;
  status: string;
}

interface ModelLoaderProps {
  onModelLoaded?: (info: ModelInfo) => void;
  onModelUnloaded?: () => void;
}

export function ModelLoader({ onModelLoaded, onModelUnloaded }: ModelLoaderProps) {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgress>({ progress: 0, status: "No model loaded" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkModelStatus();
    checkLastModelPath();
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    if (loading) {
      interval = window.setInterval(async () => {
        try {
          const prog = await invoke<LoadingProgress>("get_loading_progress");
          setProgress(prog);
        } catch (e) {
          console.error("Failed to get loading progress:", e);
        }
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const checkModelStatus = async () => {
    try {
      const info = await invoke<ModelInfo | null>("get_model_info");
      if (info) {
        setModelInfo(info);
        onModelLoaded?.(info);
      }
    } catch (e) {
      console.error("Failed to check model status:", e);
    }
  };

  const checkLastModelPath = async () => {
    try {
      const lastPath = await invoke<string | null>("get_last_model_path");
      if (lastPath && !modelInfo) {
        setProgress({ progress: 0, status: `Last used: ${lastPath.split("/").pop()}` });
      }
    } catch (e) {
      console.error("Failed to get last model path:", e);
    }
  };

  const handleSelectModel = async () => {
    try {
      setError(null);
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "GGUF Models",
            extensions: ["gguf"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        await loadModel(selected);
      }
    } catch (e) {
      setError(`Failed to select file: ${e}`);
    }
  };

  const loadModel = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      setProgress({ progress: 0, status: "Loading model..." });

      const info = await invoke<ModelInfo>("load_model", { path });
      setModelInfo(info);
      setProgress({ progress: 1, status: "Model loaded" });
      onModelLoaded?.(info);
    } catch (e) {
      setError(`Failed to load model: ${e}`);
      setProgress({ progress: 0, status: "Load failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnloadModel = async () => {
    try {
      setError(null);
      await invoke("unload_model");
      setModelInfo(null);
      setProgress({ progress: 0, status: "No model loaded" });
      onModelUnloaded?.();
    } catch (e) {
      setError(`Failed to unload model: ${e}`);
    }
  };

  const handleLoadLastModel = async () => {
    try {
      const lastPath = await invoke<string | null>("get_last_model_path");
      if (lastPath) {
        await loadModel(lastPath);
      }
    } catch (e) {
      setError(`Failed to load last model: ${e}`);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-cyan-200 uppercase tracking-wider">Model Controls</h3>
      
      {error && (
        <div className="p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      {modelInfo ? (
        <div className="space-y-3">
          <button
            onClick={handleUnloadModel}
            className="w-full px-3 py-2 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all"
          >
            Unload Model
          </button>
          
          <button
            onClick={handleSelectModel}
            className="w-full px-3 py-2 text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/70 transition-all"
          >
            Change Model
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-slate-400">{progress.status}</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-xs text-slate-400">{progress.status}</span>
              </div>
              
              <button
                onClick={handleSelectModel}
                className="glow-button w-full px-3 py-2.5 text-sm rounded-lg flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Load GGUF
              </button>

              <button
                onClick={handleLoadLastModel}
                className="w-full px-3 py-2 text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/70 transition-all"
              >
                Load Last Model
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
