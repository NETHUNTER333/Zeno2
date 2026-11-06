export type SearchMode = 'organic' | 'news' | 'deep' | 'off';

export interface SocialMediaAttachment {
  type: string;
  url: string;
  videoUrl?: string;
  width?: number;
  height?: number;
}

export interface SocialThreadItem {
  id?: string;
  authorName: string;
  authorUsername: string;
  authorImage?: string;
  authorVerified?: boolean;
  text: string;
  url?: string;
  createdUtc?: number;
  createdDate?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  media?: SocialMediaAttachment[];
}

export interface SocialMeta {
  platform: 'x' | 'twitter' | 'reddit' | 'youtube' | 'instagram' | 'github' | 'tiktok' | 'linkedin';
  postId?: string;
  authorName: string;
  authorUsername: string;
  authorImage?: string;
  authorVerified?: boolean;
  authorFollowers?: number;
  authorFollowing?: number;
  text: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  quoteCount?: number;
  createdUtc?: number;
  createdDate?: string;
  media?: SocialMediaAttachment[];
  thread?: SocialThreadItem[];
}

export interface SearchSource {
  position: number;
  title: string;
  url: string;
  snippet: string;
  displayed_url?: string;
  domain?: string;
  source?: string;
  date?: string;
  provider?: string;
  socialMeta?: SocialMeta;
}

export interface ToolUsed {
  tool: string;
  query?: string;
  url?: string;
  durationMs: number;
  resultsCount?: number;
  bytes?: number;
  endpoint?: string;
  org?: string;
}

export interface XPost {
  id: string;
  authorName: string;
  authorUsername: string;
  authorImage?: string;
  authorVerified?: boolean;
  authorFollowers?: number;
  text: string;
  url: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  quoteCount?: number;
  createdUtc?: number;
  platform?: 'x' | 'twitter' | 'reddit' | 'youtube' | 'instagram' | 'github' | 'tiktok' | 'linkedin';
  media?: SocialMediaAttachment[];
  thread?: SocialThreadItem[];
}

export interface YouTubeTranscriptSegment {
  start_s: number;
  duration_s: number;
  text: string;
}

export interface YouTubeVideoInfo {
  videoId?: string;
  title: string;
  author: string;
  thumbnail?: string;
  videoUrl?: string;
  embedUrl?: string;
  link?: string;
  source?: string;
  views?: string;
  length?: string;
  date?: string;
  snippet?: string;
  transcript?: YouTubeTranscriptSegment[];
}

export interface YouTubeStudyChapter {
  start_s?: number;
  end_s?: number;
  timestamp: number;
  title: string;
  summary: string;
}

export interface YouTubeStudySummary {
  overview: string;
  keyPoints: string[];
  chapters: YouTubeStudyChapter[];
}

export interface YouTubeStudyConcept {
  term: string;
  definition: string;
  mechanism: string;
  timestamp?: number;
  citation?: string;
  proofQuote?: string;
}

export interface YouTubeStudyExplanation {
  coreThesis: string;
  concepts: YouTubeStudyConcept[];
}

export interface YouTubeStudyFlashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  timestamp_s?: number;
  timestamp?: number;
  sourceQuote?: string;
}

export interface YouTubeStudyQuizItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  timestamp_s?: number;
  timestamp?: number;
  sourceQuote?: string;
}

export interface YouTubeStudyMetrics {
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  modelUsed: string;
  cached?: boolean;
}

export interface YouTubeStudyBundle {
  videoId: string;
  title: string;
  author?: string;
  summary: YouTubeStudySummary;
  explanation: YouTubeStudyExplanation;
  flashcards: YouTubeStudyFlashcard[];
  quiz: YouTubeStudyQuizItem[];
  metrics?: YouTubeStudyMetrics;
}

export interface GithubRepo {
  name: string;
  fullName?: string;
  url: string;
  description: string;
  stars?: number | string;
  forks?: number | string;
  language?: string;
  ownerAvatar?: string;
  topics?: string[];
  openIssues?: number;
  license?: string;
  updatedAt?: string;
  downloads?: string;
}

export interface ArxivPaper {
  id: string;
  rawId?: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated?: string;
  categories: string[];
  pdfUrl: string;
  absUrl: string;
  githubRepos?: GithubRepo[];
}

export interface ImageResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source?: string;
  domain?: string;
  link?: string;
  width?: number;
  height?: number;
}

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  url?: string;
  dataUrl?: string;
  textContent?: string;
  width?: number;
  height?: number;
}

export interface PersonaWikiSpec {
  label: string;
  value: string;
  category?: 'vital' | 'physical' | 'career' | 'background';
}

export interface PersonaWiki {
  name: string;
  fullName?: string;
  moniker?: string;
  category: string;
  scaleTier: string;
  summary: string;
  primaryImage?: string;
  images: ImageResult[];
  age?: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  height?: string;
  weight?: string;
  occupation?: string;
  organizationOrTeam?: string;
  positionOrRole?: string;
  statusOrRank?: string;
  netWorthOrValue?: string;
  education?: string;
  specs: PersonaWikiSpec[];
  careerHighlights?: string[];
  wikiUrl?: string;
  socialLinks?: { platform: string; url: string; label?: string }[];
}

export interface FinanceQuote {
  symbol: string;
  name: string;
  assetType: 'stock' | 'crypto';
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  marketCap?: string;
  volume24h?: string;
  high52w?: number;
  low52w?: number;
  exchange?: string;
  updatedAt: string;
  sparkline: Array<{ time: string; price: number }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: SearchSource[];
  sourcesNotLinked?: boolean;
  images?: ImageResult[];
  personaWiki?: PersonaWiki;
  searchQueries?: string[];
  toolsUsed?: ToolUsed[];
  modelUsed?: string;
  isStreaming?: boolean;
  loadingMode?: 'vision' | 'file' | 'search' | 'thinking';
  timing?: {
    firstTokenSec: number;
    totalSec: number;
    speedTokPerSec: number;
    chunks: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  attachments?: ChatAttachment[];
  videos?: YouTubeVideoInfo[];
  arxivPapers?: ArxivPaper[];
  githubRepos?: GithubRepo[];
  xPosts?: XPost[];
  financeQuotes?: FinanceQuote[];
  webSearchSteps?: {
    label: string;
    query?: string;
    brand?: string;
    meta?: string;
    sources?: {
      title: string;
      domain: string;
      brand?: string;
      href: string;
    }[];
  }[];
  reaction?: 'good' | 'bad' | null;
  agentReply?: AgentReplyCard;
  agentReplies?: AgentReplyCard[];
}

export interface TregStatus {
  success: boolean;
  tregConnected: boolean;
  org: string;
  tokenConfigured: boolean;
  tregVersion?: string;
  totalTools?: string;
  providers?: number;
  userTeam?: string;
  error?: string;
}

export interface CatalogEndpoint {
  id: string;
  provider: string;
  provider_display?: string;
  name: string;
  summary?: string;
  method?: string;
  cost?: {
    usd?: number;
    currency?: string;
    value?: number;
    type?: string;
  };
  call_template?: string;
  docs_url?: string;
}

// User Account & Workspace Types
export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatar: string;
  avatarType: 'preset' | 'custom' | 'initials';
  signinProvider: 'google' | 'apple' | 'email' | 'guest';
  createdAt: number;
  accountStatus: 'active' | 'verified' | 'trial';
  bio?: string;
  phoneNumber?: string;
  occupation?: string;
  nickname?: string;
  age?: string;
}

export type ResponseLength = 'concise' | 'balanced' | 'detailed';
export type ResponseStyle = 'casual' | 'professional' | 'technical' | 'creative';
export interface UserPersonalization {
  preferredName: string;
  preferredLanguage: string;
  responseLength: ResponseLength;
  responseStyle: ResponseStyle;
  customInstructionsAbout: string; // What Kinich should know about you
  customInstructionsResponse: string; // How Kinich should respond
  customInstructionsEnabled: boolean;
  voicePersona: string;
  voiceSpeed: number; // 0.75 - 1.5
  defaultModelId: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
  createdAt: number;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadedAt: number;
  threadId?: string;
  threadTitle?: string;
  category: 'pdf' | 'image' | 'code' | 'doc' | 'export';
}

export interface SavedCitation {
  id: string;
  title: string;
  url: string;
  domain: string;
  dateAdded: number;
  note?: string;
}

export interface SavedBookmark {
  id: string;
  threadId: string;
  messageId: string;
  role: 'user' | 'assistant';
  snippet: string;
  savedAt: number;
  threadTitle: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  isCurrent: boolean;
  lastActive: number;
}

export type SubscriptionPlan = 'free' | 'spark' | 'fire' | 'pro' | 'enterprise';

export interface UserSubscription {
  plan: SubscriptionPlan;
  status: 'active' | 'trialing' | 'canceled';
  renewalDate: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethod?: string;
}

export interface UsageQuota {
  messagesUsed: number;
  messageLimit: number;
  filesUploaded: number;
  fileUploadLimit: number;
  maxFilesPerMessage: number;
  tokensUsed: number;
  tokenLimit: number;
  searchesUsed: number;
  searchLimit: number;
  deepResearchUsed: number;
  deepResearchLimit: number;
  pdfStudyUsed: number;
  pdfStudyLimit: number;
  toolsUsed: number;
  toolLimit: number;
  storageBytesUsed: number;
  storageBytesLimit: number;
  resetDate: string;
}

export interface PrivacySettings {
  historyRetention: 'indefinite' | '30d' | '90d' | '365d';
  allowAiTraining: boolean;
  twoFactorEnabled: boolean;
}

// ============================================================================
// ZENO GROWTH ENGINE TYPES
// ============================================================================

export type DiscoverCategory =
  | 'Learning'
  | 'Research'
  | 'Science'
  | 'Technology'
  | 'Programming'
  | 'Writing'
  | 'Productivity'
  | 'Study Resources';

export type ArtifactOutputType =
  | 'explanation'
  | 'research_summary'
  | 'study_guide'
  | 'document_summary'
  | 'structured_notes'
  | 'workflow';

export type PublicArtifactType = ArtifactOutputType;

export type ArtifactVisibility = 'public' | 'private';

export interface PublicArtifact {
  id: string;
  ownerId: string;
  authorName: string;
  authorUsername?: string;
  authorBio?: string;
  authorAvatar?: string;
  showAuthorAttribution: boolean;
  title: string;
  summary: string;
  content: string;
  promptText?: string;
  modelUsed?: string;
  category: DiscoverCategory;
  tags: string[];
  visibility: ArtifactVisibility;
  outputType: ArtifactOutputType;
  sources?: SearchSource[];
  createdAt: number;
  updatedAt: number;
  viewsCount: number;
  savesCount: number;
  forksCount: number;
}

export type KnowledgeSourceType =
  | 'lecture'
  | 'note'
  | 'quiz'
  | 'flashcard_deck'
  | 'research_report'
  | 'chat_answer'
  | 'ai_response'
  | 'research_summary'
  | 'study_guide'
  | 'pdf_insight'
  | 'discover_resource'
  | 'personal_note';

export interface VaultTimestamp {
  timeSec: number;
  label: string;
}

export interface KnowledgeVaultItem {
  id: string;
  userId: string;
  type: KnowledgeSourceType;
  title: string;
  subject: string;
  chapter: string;
  tags: string[];
  sourceUrl?: string;
  timestamps?: Array<string | VaultTimestamp>;
  content: string;
  summary: string;
  collectionId: string;
  sourceType: KnowledgeSourceType;
  threadId?: string;
  sourceThreadId?: string;
  messageId?: string;
  sourceMessageId?: string;
  artifactId?: string;
  sources?: SearchSource[];
  isPinned: boolean;
  pinned?: boolean;
  relatedItemIds?: string[];
  sageNote?: string;
  organizedBySage?: boolean;
  organizingStatus?: 'pending' | 'organizing' | 'organized' | 'manual';
  createdAt: number;
  lastReviewedAt: number;
  updatedAt: number;
}

export type VaultThreadType = 'youtube' | 'web_link' | 'pdf' | 'image' | 'text';

export interface VaultKeyPoint {
  id: string;
  text: string;
  timestamp?: string; // e.g. "04:15"
  timeSec?: number;
  score?: number;
  upvoted?: boolean;
  downvoted?: boolean;
}

export interface VaultThreadComment {
  id: string;
  threadId: string;
  userId?: string;
  author: 'user' | 'sage' | 'recall' | 'planner' | 'doubt_buddy' | string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: number;
  parentId?: string | null;
  score: number;
  upvoted?: boolean;
  downvoted?: boolean;
  replies?: VaultThreadComment[];
}

export interface VaultThread {
  id: string;
  userId: string;
  type: VaultThreadType;
  title: string;
  sourceUrl?: string;
  thumbnail?: string;
  tldr: string;
  keyPoints: VaultKeyPoint[];
  subject: string;
  chapter: string;
  tags: string[];
  createdAt: number; // UTC timestamp ms
  updatedAt: number; // UTC timestamp ms
  pinned: boolean;
  score: number;
  upvoted?: boolean;
  downvoted?: boolean;
  commentCount: number;
  comments?: VaultThreadComment[];
}

export interface VaultMemoryIndexItem {
  id: string;
  threadId: string;
  userId: string;
  type: VaultThreadType;
  title: string;
  keyPointText: string;
  timestamp?: string;
  sourceUrl?: string;
  subject: string;
  chapter: string;
  createdAt: number;
}

export type AgentTriggerType = 'on_save' | 'on_message' | 'schedule';

export type AgentToolName =
  | 'searchWeb'
  | 'deepResearch'
  | 'getTranscript'
  | 'makeQuiz'
  | 'makeFlashcards'
  | 'summarize'
  | 'readVault'
  | 'writeVault';

export interface PersonalAgentDefinition {
  id: 'sage' | 'recall' | 'planner' | 'doubt_buddy' | 'morning_brief';
  name: string;
  role: string;
  description: string;
  icon: string;
  systemPrompt: string;
  tools: AgentToolName[];
  trigger: AgentTriggerType;
  tierRequired: 'spark' | 'fire';
  phase: 1 | 2 | 3 | 4;
}

export interface AgentReplyCard {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentIcon: string;
  content: string;
  subject?: string;
  chapter?: string;
  tags?: string[];
  relatedItems?: Array<{
    id: string;
    title: string;
    subject?: string;
    chapter?: string;
    reason?: string;
  }>;
  linkedItems?: Array<{
    id: string;
    title: string;
    subject?: string;
    chapter?: string;
    reason?: string;
  }>;
  citedTimestamps?: Array<{
    timeSec: number;
    label: string;
    vaultItemId?: string;
    vaultItemTitle?: string;
  }>;
  citations?: Array<{
    vaultItemId: string;
    title: string;
    timestamp?: string;
  }>;
  toolsCalled?: AgentToolName[];
  tokensUsed?: number;
  createdAt: number;
}

export interface AgentMemoryDoc {
  agentId: string;
  userId: string;
  facts: string[];
  updatedAt: number;
}

export interface AgentUsageDoc {
  id: string;
  userId: string;
  agentId: string;
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callsCount: number;
  updatedAt: number;
}

// Phase 2 Schema: Recall (Spaced-repetition SM-2 flashcards)
export interface RecallCardDoc {
  id: string;
  userId: string;
  vaultItemId: string;
  subject: string;
  chapter: string;
  front: string;
  back: string;
  repetitions: number;
  easinessFactor: number;
  intervalDays: number;
  dueAt: number;
  lastReviewedAt: number;
  pushReminderEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// Phase 3 Schema: Planner (Exam date + subjects -> day-by-day plan from Vault)
export interface StudyPlanDayTask {
  date: string;
  subject: string;
  chapter: string;
  tasks: string[];
  vaultItemIds: string[];
  completed: boolean;
}

export interface StudyPlanDoc {
  id: string;
  userId: string;
  examName: string;
  examDate: string;
  subjects: string[];
  days: StudyPlanDayTask[];
  createdAt: number;
  updatedAt: number;
}

// Phase 4 Schema: Morning Brief (Scheduled daily in IST default with cards due, today's plan, one quiz)
export interface MorningBriefDoc {
  id: string;
  userId: string;
  briefDate: string;
  scheduledTime: string;
  timezone: string;
  dueCardsCount: number;
  todayPlanSummary: string;
  dailyQuiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    vaultItemId?: string;
  };
  createdAt: number;
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface CreatorPublicProfile {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl?: string;
  isPublic: boolean;
  specialtyTags?: string[];
  publishedCount?: number;
  joinedAt?: number;
  featuredArtifactIds: string[];
  updatedAt: number;
}

export interface KinichReferralStatus {
  referralCode: string;
  code?: string;
  referrerUid: string;
  inviteUrl: string;
  referralUrl?: string;
  visitsCount: number;
  validatedSignupsCount: number;
  verifiedReferralsCount?: number;
  qualifiedActionsCount: number;
  unlockedThemes: string[];
  referredByCode?: string | null;
  attributionWindowDays: number;
  createdAt: number;
}

export interface KinichMissionItem {
  id: string;
  title: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  completed: boolean;
  completedAt?: number;
}

export interface KinichIntelligenceLevel {
  level: number;
  name: 'Explorer' | 'Researcher' | 'Analyst' | 'Scholar' | 'Architect' | 'Polymath';
  achievement: string;
  xp?: number;
  currentXp: number;
  nextLevelXp: number;
}

export interface KinichNotificationPreferences {
  enabled: boolean;
  unfinishedResearchReminders: boolean;
  weeklyIntelligenceBrief: boolean;
  weeklyIntelligenceReport?: boolean;
  referralMilestones: boolean;
  frequency: 'daily' | 'weekly' | 'off';
  updatedAt: number;
}

export type GrowthAnalyticsEventName =
  | 'signup_completed'
  | 'first_core_action_completed'
  | 'knowledge_item_saved'
  | 'share_card_created'
  | 'share_action_initiated'
  | 'public_artifact_created'
  | 'public_artifact_opened'
  | 'discover_resource_opened'
  | 'referral_link_created'
  | 'referral_visit_recorded'
  | 'referral_signup_validated'
  | 'weekly_report_viewed'
  | 'returning_session_started';

export interface GrowthFunnelSummary {
  totalEvents: number;
  totalRecordedEvents?: number;
  countsByEvent: Record<GrowthAnalyticsEventName, number>;
  acquisition: {
    referralVisits: number;
    publicArtifactOpens: number;
    publicArtifactVisits?: number;
    discoverOpens: number;
    discoverResourceOpens?: number;
  };
  activation: {
    signupsCompleted: number;
    firstCoreActions: number;
    knowledgeItemsSaved: number;
  };
  virality: {
    shareCardsCreated: number;
    shareActionsInitiated: number;
    publicArtifactsCreated: number;
    validatedReferrals: number;
  };
  retention: {
    returningSessions: number;
    weeklyReportsViewed: number;
    activeDaysLast7: number;
    activeDaysObserved?: number;
  };
}

export type EliteReferrerTier =
  | 'Grand Ambassador'
  | 'Apex Referrer'
  | 'Catalyst'
  | 'Vanguard'
  | 'Scout';

export interface EliteReferrerLeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  referralCode: string;
  claimedReferrals: number;
  visitsCount: number;
  conversionRate: number;
  tier: EliteReferrerTier;
  unlockedThemes: string[];
  specialtyTag?: string;
  isCurrentUser?: boolean;
}

export interface TopContributorEntry {
  rank: number;
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  publishedCount: number;
  totalSaves: number;
  totalForks: number;
  totalViews: number;
  impactScore: number;
  specialtyTags: string[];
  badge: string;
  topArtifactTitle?: string;
  topArtifactId?: string;
  isCurrentUser?: boolean;
}

export type KinichFeedbackCategory =
  | 'feature'
  | 'bug'
  | 'model_quality'
  | 'ui_ux'
  | 'research_tools'
  | 'praise';

export interface KinichFeedbackSubmission {
  id: string;
  category: KinichFeedbackCategory;
  rating: number;
  subject: string;
  message: string;
  includeDiagnostics?: boolean;
  status: 'received' | 'routed' | 'reviewed';
  createdAt: number;
}
