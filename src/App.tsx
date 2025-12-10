import { useState, useRef, useCallback } from 'react'
import { Paperclip, Send, X, FileText, Image, File } from 'lucide-react'
import './App.css'

interface UploadedFile {
  id: string
  name: string
  type: string
  size: number
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    
    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
    }))
    
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id))
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() && files.length === 0) return
    
    console.log('Submitted:', { prompt, files })
    setPrompt('')
    setFiles([])
  }, [prompt, files])

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />
    if (type.includes('pdf') || type.includes('document')) return <FileText className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Ornate frame decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-8 left-8 w-24 h-24 text-cyan-500/30" viewBox="0 0 100 100" fill="none">
          <path d="M0 20 L0 0 L20 0" stroke="currentColor" strokeWidth="2" />
          <path d="M10 30 L10 10 L30 10" stroke="currentColor" strokeWidth="1" />
          <circle cx="5" cy="5" r="3" fill="currentColor" />
        </svg>
        <svg className="absolute top-8 right-8 w-24 h-24 text-cyan-500/30 rotate-90" viewBox="0 0 100 100" fill="none">
          <path d="M0 20 L0 0 L20 0" stroke="currentColor" strokeWidth="2" />
          <path d="M10 30 L10 10 L30 10" stroke="currentColor" strokeWidth="1" />
          <circle cx="5" cy="5" r="3" fill="currentColor" />
        </svg>
        <svg className="absolute bottom-8 left-8 w-24 h-24 text-cyan-500/30 -rotate-90" viewBox="0 0 100 100" fill="none">
          <path d="M0 20 L0 0 L20 0" stroke="currentColor" strokeWidth="2" />
          <path d="M10 30 L10 10 L30 10" stroke="currentColor" strokeWidth="1" />
          <circle cx="5" cy="5" r="3" fill="currentColor" />
        </svg>
        <svg className="absolute bottom-8 right-8 w-24 h-24 text-cyan-500/30 rotate-180" viewBox="0 0 100 100" fill="none">
          <path d="M0 20 L0 0 L20 0" stroke="currentColor" strokeWidth="2" />
          <path d="M10 30 L10 10 L30 10" stroke="currentColor" strokeWidth="1" />
          <circle cx="5" cy="5" r="3" fill="currentColor" />
        </svg>
      </div>

      {/* Logo/Title */}
      <div className="relative z-10 mb-12 text-center">
        <div className="relative inline-block">
          {/* Ornate gear icon frame */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Outer ornate frame */}
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#cyanGradient)" strokeWidth="1" strokeDasharray="4 2" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#cyanGradient)" strokeWidth="2" />
              {/* Inner gear shape */}
              <path 
                d="M50 15 L55 25 L65 20 L65 32 L77 32 L72 42 L82 50 L72 58 L77 68 L65 68 L65 80 L55 75 L50 85 L45 75 L35 80 L35 68 L23 68 L28 58 L18 50 L28 42 L23 32 L35 32 L35 20 L45 25 Z"
                fill="none"
                stroke="url(#cyanGradient)"
                strokeWidth="2"
                className="drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]"
              />
              <circle cx="50" cy="50" r="12" fill="none" stroke="url(#cyanGradient)" strokeWidth="2" />
              <defs>
                <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00ffff" />
                  <stop offset="50%" stopColor="#00cccc" />
                  <stop offset="100%" stopColor="#00ffff" />
                </linearGradient>
              </defs>
            </svg>
            {/* Glow effect */}
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-wider">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]">
              LocalHands
            </span>
          </h1>
          <p className="mt-3 text-cyan-400/60 text-sm tracking-widest uppercase">
            Your AI Assistant
          </p>
        </div>
      </div>

      {/* Main prompt container */}
      <div className="relative z-10 w-full max-w-3xl">
        <form onSubmit={handleSubmit}>
          {/* Prompt input area with drag-and-drop */}
          <div
            className={`relative rounded-2xl transition-all duration-300 ${
              isDragging 
                ? 'bg-cyan-500/10 border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5),0_0_60px_rgba(0,255,255,0.3)]' 
                : 'bg-gray-900/50 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,255,255,0.3),0_0_30px_rgba(0,255,255,0.15)]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm z-20">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Paperclip className="w-8 h-8 text-cyan-400" />
                  </div>
                  <p className="text-cyan-400 font-medium">Drop files here</p>
                </div>
              </div>
            )}

            {/* File attachments display */}
            {files.length > 0 && (
              <div className="px-4 pt-4 flex flex-wrap gap-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-sm"
                  >
                    <span className="text-cyan-400">{getFileIcon(file.type)}</span>
                    <span className="text-gray-300 max-w-32 truncate">{file.name}</span>
                    <span className="text-gray-500 text-xs">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-gray-500 hover:text-cyan-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-3 p-4">
              {/* File upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-transparent border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/10 flex items-center justify-center transition-all duration-200 group"
              >
                <Paperclip className="w-5 h-5 text-cyan-500/70 group-hover:text-cyan-400 transition-colors" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What can I help you with today?"
                  rows={1}
                  className="w-full bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none text-lg leading-relaxed max-h-40 overflow-y-auto"
                  style={{ minHeight: '28px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = `${Math.min(target.scrollHeight, 160)}px`
                  }}
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!prompt.trim() && files.length === 0}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] disabled:shadow-none"
              >
                <Send className="w-5 h-5 text-black" />
              </button>
            </div>
          </div>

          {/* Helper text */}
          <p className="mt-4 text-center text-gray-600 text-sm">
            Press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 text-xs">Enter</kbd> to send, <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 text-xs">Shift + Enter</kbd> for new line
          </p>
        </form>
      </div>

      {/* Bottom decorative elements */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
    </div>
  )
}

export default App
