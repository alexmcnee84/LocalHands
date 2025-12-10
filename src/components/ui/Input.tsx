import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-content">{label}</label>
      )}
      <input
        className={`px-4 py-2 bg-base-secondary border border-tertiary rounded-lg text-content placeholder-basic focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
          error ? "border-danger" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
