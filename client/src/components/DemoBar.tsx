import React from 'react';
import { isDemoMode, resetDemoData } from '../services';

interface DemoBarProps {
  onReset: () => void;
}

export const DemoBar: React.FC<DemoBarProps> = ({ onReset }) => {
  if (!isDemoMode) return null;
  return (
    <div className="demo-bar">
      <span>Demo: everything runs in your browser with sample data.</span>
      <span className="demo-links">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            resetDemoData();
            onReset();
          }}
        >
          Reset sample data
        </button>
        <a href="https://github.com/Taan1el/logiroute" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </span>
    </div>
  );
};
