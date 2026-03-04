import type { SessionData } from './session';

export interface PromptFeedback {
  prompt: string;
  score: number;
  feedback: string;
}

export interface InsightResult {
  overallScore: number;
  summary: string;
  promptFeedback: PromptFeedback[];
  suggestions: string[];
}

declare global {
  interface Window {
    gridwatchAPI: {
      getSessions: () => Promise<SessionData[]>;
      getLogTokens: () => Promise<{ date: string; tokens: number; utilisation: number }[]>;
      renameSession: (sessionId: string, newSummary: string) => Promise<boolean>;
      archiveSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
      deleteSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
      setTags: (sessionId: string, tags: string[]) => Promise<boolean>;
      setNotes: (sessionId: string, notes: string) => Promise<boolean>;
      getContext: (sessionId: string) => Promise<{
        plan: string | null;
        checkpoints: string[];
        notes: string;
        tags: string[];
      }>;
      writeTransfer: (sessionId: string, content: string) => Promise<string | null>;
      listTransfers: (sessionId: string) => Promise<{ name: string; date: string; size: number }[]>;
      readTransfer: (sessionId: string, filename: string) => Promise<string | null>;
      deleteTransfer: (sessionId: string, filename: string) => Promise<boolean>;
      setZoomFactor: (factor: number) => void;
      getZoomFactor: () => number;
      checkForUpdate: () => Promise<{ hasUpdate: boolean; latestVersion?: string; downloadUrl?: string }>;
      openExternal: (url: string) => Promise<void>;
      showInFolder: (filePath: string) => Promise<void>;
      saveToken: (token: string) => Promise<boolean>;
      loadToken: () => Promise<string>;
      analyseSession: (apiKey: string, messages: string[]) => Promise<InsightResult>;
    };
  }
  const __APP_VERSION__: string;
}

export {};
