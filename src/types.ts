export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  mainCategory?: string;
  description: string;
  promptText: string;
  systemGuidance?: string;
  canvasTemplate?: string;
  tags: string[];
  runs: number;
  satisfaction: number; // For statistics (1-100)
  efficiency: number; // token/time savings index
  isHidden: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Teacher {
  id: string;
  name: string;
  badge: string;
  badgeColor: 'mint' | 'yellow' | 'coral' | 'navy';
  runs: number;
  institution?: string;
}

export interface AnalyticsRecord {
  id: string;
  metric: string;
  value: string | number;
  change: string;
  type: 'positive' | 'neutral' | 'negative';
}
