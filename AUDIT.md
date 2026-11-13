# Kinich Codebase Audit (STEP 1)

**Repo**: Kinich (`kinich.app`, formerly Zeno)  
**Verified Stack**: React 19 + Vite 8 + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`) + Lucide React (`lucide-react`), static site on Vercel (`vercel.json` rewrites `/api/:path*` to `zeno-api` on InstaCloud), Capacitor 8 Android (`capacitor.config.ts`, `appId: app.kinich.android`). Express backend in `server.ts` + `server/*` run via `tsx server.ts`. Auth: Firebase Auth. Payments: Dodo Payments (`dodopayments` / `server/billingEngine.ts`). Package manager: `npm` (`bun.lock` also present in root).

---

## 1. Baseline Build, Typecheck & Lint Counts

| Check | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Build** | `npm run build` (`vite build`) | **PASS** (8.02s, 3058 modules) | **6 Vite warnings**: 5 `configLoader: 'native'` extensionless import warnings + 1 large-chunk warning (`> 500 kB`) |
| **Bundle Size** | `dist/assets/*` | — | Main JS `index-D2f3zkJ_.js`: **4,780.25 kB** (`gzip: 1,379.12 kB`); CSS `index-DpWNPYWJ.css`: **259.92 kB** (`gzip: 37.20 kB`); `pdf-DclmahqW.js`: **430.24 kB**; `html2canvas`: **199.45 kB**; `index.es`: **151.38 kB**; `purify.es`: **29.02 kB**; `phonon_tts` JS (22.10 + 25.52 + 26.85 kB) + **4 WASM binaries totaling 17,538.07 kB** (~4.35–4.41 MB each) |
| **Typecheck** | `npm run lint` (`tsc --noEmit`) | **0 errors** | `tsconfig.json` does **not** enable `"strict": true`, allowing unchecked `any` types |
| **Lint** | `npm run lint:rules` (`eslint firestore.rules`) | **0 errors** | `eslint.config.js` only configures `@firebase/eslint-plugin-security-rules` on `firestore.rules`. **No JS/TS/React ESLint or Prettier config exists.** |

---

## 2. Dead Files, Unused Exports & Unused Dependencies

### 2.1 Candidate Dead / Unreferenced Files in `src/` & `public/` (18 files)
All verified unimported across `src/`, `server/`, `tests/`, and `scripts/`:
1. `src/components/AnalyticsDashboardModal.tsx` (482 lines)
2. `src/components/ChatMessage.tsx` (replaced by `GrokChatMessage.tsx`)
3. `src/components/GrokComposer.tsx` (replaced by `src/components/kobra/chat-input.tsx` / `composer.tsx`)
4. `src/components/HeaderTokenTracker.tsx`
5. `src/components/HomeReferralPopup.tsx`
6. `src/components/ReadingProgressBar.tsx`
7. `src/components/SignInModal.tsx`
8. `src/components/SmartContinuationStrip.tsx`
9. `src/components/TregCatalogModal.tsx`
10. `src/components/kokonutui/ai-autocomplete.tsx`
11. `src/components/kokonutui/ai-token-alternatives.tsx`
12. `src/components/ui/badge.tsx`
13. `src/components/ui/chain-of-thought.tsx`
14. `src/components/ui/demo.tsx`
15. `src/components/ui/trace.tsx`
16. `src/components/ui/voice-note.tsx`
17. `src/hooks/use-highlighted-code.ts`
18. `public/zeno-icon.svg` (leftover old-brand asset)

### 2.2 Unused Exports (372 symbols across 87 files)
Full static scan of `export function|const|let|class|interface|type|enum` not referenced in any other `.ts`/`.tsx`/test/script file:
- `src/components/AccountWorkspacePage.tsx` (2): `CancelSubscriptionSection:102`, `RefundPolicySection:510`
- `src/components/AnalyticsDashboardModal.tsx` (1): `AnalyticsDashboardModal:36`
- `src/components/CustomSearchSelect.tsx` (1): `SelectOptionItem:5`
- `src/components/DeepResearchModal.tsx` (1): `DeepResearchModalProps:667`
- `src/components/DodoStatusModal.tsx` (2): `DodoGatewayStatusData:19`, `DodoStatusModalProps:38`
- `src/components/GrokComposer.tsx` (2): `GrokComposerProps:7`, `GrokComposer:23`
- `src/components/GrokModelPicker.tsx` (1): `FREE_MODEL_IDS:826`
- `src/components/GrokTimingTooltip.tsx` (1): `TimingData:3`
- `src/components/HeaderTokenTracker.tsx` (1): `HeaderTokenTracker:27`
- `src/components/HomeReferralPopup.tsx` (1): `HomeReferralPopup:15`
- `src/components/InbuiltPdfViewer.tsx` (1): `InbuiltPdfViewerProps:60`
- `src/components/KinichGrowthHubModal.tsx` (1): `KinichGrowthHubModalProps:54`
- `src/components/LegalAndInfoPages.tsx` (8): `navigateToLegalRoute:125`, `StoredLegalConsent:140`, `getStoredLegalConsent:147`, `CookiePreferenceChoice:190`, `getCookiePreference:192`, `setCookiePreference:203`, `ReportModalPayload:249`, `CookieConsentBanner:375`
- `src/components/MathMarkdown.tsx` (1): `MathMarkdownProps:54`
- `src/components/PageExtractModal.tsx` (1): `PageExtractModalProps:19`
- `src/components/PricingModal.tsx` (1): `PricingModalProps:14`
- `src/components/PrismCodeBlock.tsx` (1): `PrismCodeBlockProps:31`
- `src/components/PublicArtifactView.tsx` (1): `PublicArtifactViewProps:21`
- `src/components/ui/thinking-state.tsx`: `ShimmerTextProps:8`, `ThinkingSource:39`, `ThinkingStateProps:57`, `ThinkingState:128`
- `src/components/ui/voice-note.tsx` (1): `VoiceNoteProps:170`
- `src/components/ui/web-search.tsx` (8): `WebSearchStatus:47`, `WebSource:49`, `getCleanDomain:167`, `cleanCitationDisplay:185`, `getDomainIcon:239`, `WebSearchProps:243`, `WebSearchCitationProps:850`, `WebSearchAnswerProps:1146`
- `src/hooks/use-highlighted-code.ts` (1): `useHighlightedCode:5`
- `src/legal/config.ts` (2): `SubprocessorEntry:69`, `StorageKeyAuditEntry:153`
- `src/legal/policiesData.ts` (2): `PolicyTableData:19`, `PolicySection:24`
- `src/lib/apiBase.ts` (5): `INSTACLOUD_ZENO_API_ORIGIN:7`, `PRODUCTION_PUBLIC_ORIGIN:10`, `isCapacitorOrMobileApp:12`, `getBackendBaseUrl:27`, `apiUrl:46`
- `src/lib/auth.ts` (2): `GoogleAuthErrorKind:14`, `MappedGoogleAuthError:23`
- `src/lib/exportChat.ts` (5): `ExportableThread:4`, `buildConversationMarkdown:41`, `WeeklyReportCardConfig:637`, `renderWeeklyReportCardToCanvas:651`, `downloadWeeklyReportCardPng:803`
- `src/lib/financeMarket.ts` (1): `KNOWN_ASSETS:16`
- `src/lib/firebase.ts` (13): `signInGuestAnonymously:54`, `OperationType:61`, `FirestoreErrorInfo:70`, `handleFirestoreError:102`, `UserStudySession:437`, `saveUserStudySessionToFirestore:450`, `loadUserStudySessionsFromFirestore:484`, `deleteUserStudySessionFromFirestore:503`, `SharedThreadSnapshotDoc:515`, `FirestoreDailyQuotaDoc:976`, `getCurrentUtcDateString:989`, `FirestoreQuizBattleQuestion:1276`, `FirestoreQuizBattleEntry:1284`
- `src/lib/growthStore.ts` (29): `VAULT_FREE_ITEM_LIMIT:74`, `DISCOVER_CATEGORIES:76`, `DEFAULT_VAULT_COLLECTIONS:87`, `getOrCreateClientId:137`, `publishKinichArtifact:1520`, `publishPublicArtifact:1607`, `updateKinichArtifact:1609`, `deleteKinichArtifact:1649`, `getMyPublishedArtifacts:1669`, `recordArtifactEngagement:1707`, `captureInboundReferralFromUrl:1803`, `validatePendingReferralIfEligible:1810`, `evaluateMissionsAndLevel:1828`, `computeMissionsAndIntelligenceLevel:1992`, `WeeklyIntelligenceReportSummary:1994`, `computeWeeklyIntelligenceReport:2005`, `DEFAULT_NOTIFICATION_PREFS:2075`, `saveNotificationPreferences:2098`, `getCreatorProfileLocal:2120`, `saveCreatorPublicProfile:2163`, `saveCreatorProfile:2185`, `LocalUserReferralRecord:2360`, `getLocalReferralTracker:2372`, `getClaimedReferrerBonuses:2376`, `syncReferralTrackerWithEntries:2385`, `incrementLocalReferralCountForUser:2440`, `claimTopReferrerBonus:2505`, `fetchGrowthLeaderboards:2588`, `ReferralRewardTier:2789`
- `src/lib/highlighter.tsx` (1): `highlightCode:120`
- `src/lib/locationStore.ts` (10): `LocationSource:9`, `LocationPermissionState:11`, `LocationPreference:47`, `PreciseLocationResult:61`, `pushLocationPrefToFirestore:177`, `saveStoredLocationPref:219`, `isSecureLocationContext:564`, `checkGeolocationPermission:571`, `reverseGeocodeCoords:705`, `requestPreciseLocationOnTap:967`
- `src/lib/modelGradients.ts` (2): `ModelGradientTheme:7`, `MODEL_GRADIENT_THEMES:45`
- `src/lib/pdfStudyEngine.ts` (5): `DocumentSectionSummary:1`, `DocumentConceptItem:7`, `DocumentFlashcardItem:14`, `DocumentQuizItem:23`, `DocumentFormulaOrRule:33`
- `src/lib/phononTTS.ts` (2): `loadPhonon:22`, `PhononCallbacks:54`
- `src/lib/referralClient.ts` (2): `extractReferralCodeFromUrl:138`, `clearPendingReferral:290`
- `src/lib/smallestAi.ts` (1): `TtsLanguageOption:10`
- `src/lib/studyLoopStore.ts` (8): `StudyLanguageOption:19`, `StudyExplainLanguage:71`, `ExamPlanDay:73`, `ChapterWeakSpot:77`, `DailyRevisionSummary:87`, `buildClientIstAutoPlan:291`, `getDaysUntilIstDate:361`, `computeSm2Local:373`
- `src/lib/userAccountStore.ts` (14): `StreakMilestone:133`, `AchievementBadge:201`, `ACHIEVEMENT_BADGES:223`, `getIstHoursAndMinutes:288`, `getPreviousDateKey:310`, `DEFAULT_PROFILE:404`, `DEFAULT_PERSONALIZATION:422`, `DEFAULT_PROJECT_FOLDERS:435`, `DEFAULT_WORKSPACE_FILES:437`, `DEFAULT_CITATIONS:439`, `DEFAULT_SESSIONS:441`, `DEFAULT_SUBSCRIPTION:515`, `DEFAULT_USAGE:523`, `DEFAULT_PRIVACY:544`
- `src/types.ts` (24): `SocialMediaAttachment:3`, `YouTubeStudyChapter:118`, `YouTubeStudySummary:126`, `YouTubeStudyConcept:132`, `YouTubeStudyExplanation:141`, `YouTubeStudyFlashcard:146`, `YouTubeStudyQuizItem:156`, `YouTubeStudyMetrics:167`, `ImageResult:218`, `PersonaWikiSpec:240`, `ResponseLength:386`, `ResponseStyle:387`, `SubscriptionPlan:451`, `PublicArtifactType:510`, `ArtifactVisibility:512`, `KnowledgeSourceType:539`, `VaultTimestamp:553`, `AgentMemoryDoc:718`, `AgentUsageDoc:725`, `RecallCardDoc:738`, `StudyPlanDayTask:757`, `StudyPlanDoc:766`, `MorningBriefDoc:778`, `EliteReferrerTier:908`
- `server.ts` (6), `server/agentFramework.ts` (23), `server/auth.ts` (4), `server/billingEngine.ts` (18), `server/config.ts` (4), `server/currencyRates.ts` (1), `server/growthEngine.ts` (19), `server/legalAndSafetyEngine.ts` (16), `server/locationContextService.ts` (3), `server/locationService.ts` (2), `server/modelProviders.ts` (1), `server/rateLimiter.ts` (19), `server/referralEngine.ts` (5), `server/searchProviders.ts` (5), `server/uploadProcessor.ts` (2), `server/voiceTts.ts` (1), `server/weatherService.ts` (3), `server/whisperAIEngine.ts` (2)

### 2.3 Unused Dependencies in `package.json`
Unreferenced across `.ts/.tsx/.js/.css/.html` and `package.json` scripts:
- **Runtime `dependencies` (10 candidates)**:
  - `@radix-ui/react-slot` (never imported; also `shadcn` CLI package in runtime deps!)
  - `ai-youtube-transcript`, `bgutils-js`, `youtubei.js` (check against `subclip-instacloud/server.mjs` before removing; unreferenced in `src/`, `server/`, `server.ts`)
  - `ts-fsrs` (SM-2 is hand-rolled in `studyLoopStore.ts` & `agentFramework.ts`)
  - `@types/better-sqlite3`, `@types/katex` (type packages listed in `dependencies` instead of `devDependencies`, and `katex` CSS is loaded via CDN in `index.html:37`, JS via `rehype-katex`)
  - `@capacitor/android`, `@capacitor/cli` (used via Capacitor CLI / `android/` project — keep!)
- **Dev `devDependencies` (8 candidates)**:
  - `@dietrichgebert/ponytail`
  - `autoprefixer` (Tailwind v4 `@tailwindcss/vite` handles vendor prefixing)
  - `esbuild` (bundled with Vite/tsx; not invoked directly)
  - `@types/prismjs`, `@types/supertest` (unimported or check `tests/`)
  - `@types/express`, `@types/node`, `@types/react`, `@types/react-dom` (TypeScript type defs — keep for IDE/typecheck)

---

## 3. Duplicate UI Components

No shared design system exists; UI primitives are duplicated ad hoc across `src/components/`, `src/components/ui/`, and `src/components/kobra/`:

- **Button variants**:
  - `src/components/ui/button.tsx` (1 wrapper using `cva`, barely adopted)
  - `src/components/DeleteAccountButton.tsx` (standalone custom button)
  - `src/components/GoogleSignInButton.tsx` (standalone custom button)
  - Dozens of bespoke inline `<button>` classes across `App.tsx`, `Sidebar.tsx`, `StudyWorkspace.tsx`, `StudyLoopPanel.tsx`, `PricingModal.tsx`, `AccountWorkspacePage.tsx`, `DeepResearchModal.tsx` (mixed radii `rounded-md`/`lg`/`xl`/`2xl`/`full`, mixed padding `py-0.5`–`py-3`, missing `>=44px` tap targets on mobile)
- **Card variants (14+ separate components + inline `rounded-2xl`/`3xl` card boxes)**:
  - `SourceCard.tsx`, `ArxivPaperCard.tsx`, `GithubRepoCard.tsx`, `XPostCard.tsx`, `FinanceTerminalCard.tsx`, `PersonaWikiCard.tsx`, `kobra/plan-card.tsx`, `kobra/product-cards.tsx`, `kobra/question-card.tsx`, `ui/web-search.tsx` (`CompactCitationCard`), `ui/github-activity.tsx`, `ui/voice-note.tsx`, `ui/signup-1.tsx` (inline card), `StudyWorkspace.tsx` (inline Space/Set cards)
- **Modal / Dialog / Overlay variants (19 separate `fixed inset-0` implementations)**:
  - `App.tsx:3068` (Dodo billing return modal), `App.tsx:3186` (Guest Sign-In modal)
  - `AccountWorkspacePage.tsx` (inline modals)
  - `DeepResearchModal.tsx:1886`
  - `DeleteAccountButton.tsx:66`
  - `DeleteThreadConfirmDialog.tsx:26`
  - `DodoStatusModal.tsx:104`
  - `InbuiltPdfViewer.tsx:730`
  - `KinichGrowthHubModal.tsx:969`
  - `LegalAndInfoPages.tsx:267` (Report modal)
  - `LocationChip.tsx:249`
  - `PageExtractModal.tsx:480`
  - `PricingModal.tsx:476`
  - `PublicArtifactView.tsx:251`
  - `QuickOnboardingModal.tsx:49`
  - `ShareExportStudioModal.tsx:427`
  - `SignInModal.tsx:25` (dead duplicate)
  - `StreakModal.tsx:390`
  - `StudyLoopPanel.tsx:702, 1185` (main modal + Add Exam sub-modal)
  - `TregCatalogModal.tsx:86`
  - `YouTubeTranscriptModal.tsx:24`
  - `HomeReferralPopup.tsx` & `AnalyticsDashboardModal.tsx` (unused modals)
- **Toast / Notification Banner variants (9 separate implementations)**:
  - `AchievementToast.tsx` (floating achievement card)
  - `StreakReminderToast.tsx` (floating reminder banner)
  - `HomeReferralPopup.tsx:19` (`toastMsg`)
  - `GrokChatMessage.tsx:389` (`segmentSavedToast`)
  - `KinichGrowthHubModal.tsx:247` (`feedbackToast`)
  - `StudyLoopPanel.tsx:153, 813` (`recallAddedToast`)
  - `StudyWorkspace.tsx:552, 5572` (`subclipToast`) & `1007, 3996` (`recallToastMsg`)
  - `StreakModal.tsx:557` (inline status toast banner)
  - `App.tsx` (`authNoticeBanner`, `sharedBannerId`)
- **Input / Composer variants**:
  - `src/components/ui/input.tsx`
  - `src/components/kobra/chat-input.tsx` (1090 lines), `src/components/kobra/composer.tsx`
  - `src/components/GrokComposer.tsx` (dead duplicate)
  - `src/components/CustomSearchSelect.tsx`
- **Loading / Skeleton / Shimmer variants**:
  - `src/components/ui/animated-loading-svg-text-shimmer.tsx`
  - `src/components/ui/thinking-state.tsx`
  - `src/components/kokonutui/ai-loading.tsx`
  - Ad-hoc spinners/skeletons inside `StudyWorkspace.tsx`, `DeepResearchModal.tsx`, `GrokChatMessage.tsx`

---

## 4. Hardcoded Hex Colors, Font Sizes, Spacing & URLs

### 4.1 Hardcoded Hex Colors (`src/` + `index.html`)
- **369 unique hex colors**, **1,973 total occurrences** (no central CSS tokens file — `src/index.css` only has minimal Tailwind imports + raw overrides).
- Top offenders:
  - `#fc4c01` (518x — e.g., `src/App.tsx:2516`, `Sidebar.tsx:1013`) & `#e04300` (40x — e.g., `App.tsx:3142`, `AccountWorkspacePage.tsx:657`)
  - Dark surfaces/borders: `#18181b` (94x), `#121215` (60x), `#09090b` (58x), `#0d0d0d` (51x), `#141418` (28x), `#1f1f1f` (22x), `#000000` (20x), `#111111` (16x), `#0a0a0a` (15x), `#222222` (12x), `#27272a` (9x), `#262626` (9x), `#12151e` (9x), `#141414` (8x)
  - Light surfaces/borders/muted text: `#f4f4f5` (64x), `#ffffff` (53x), `#fafafa` (40x), `#e5e5e5` (35x), `#8a8a8a` (32x), `#666666` (29x), `#f8f8fa` (20x), `#71717a` (18x), `#e4e4e7` (16x), `#f0f0f0` (13x), `#e0e0e0` (12x), `#a3a3a3` (12x), `#a1a1aa` (12x), `#868593` (11x), `#ededed` (9x), `#f8f9fb` (9x), `#f8f8f9` (9x)
  - Off-brand blues/accents: `#007aff` (30x — e.g., `AnalyticsDashboardModal.tsx:148`, `kobra/chat-input.tsx:522`), `#536471` (9x — `XPostCard.tsx:137`)
  - Plus `src/lib/modelGradients.ts` containing multi-color gradient themes (`bg-gradient-to-*`).

### 4.2 Hardcoded & Arbitrary Font Sizes (`src/` + `index.html`)
- **23+ distinct arbitrary `text-[...]` sizes** alongside standard Tailwind classes:
  - Standard: `text-xs` (960x), `text-sm` (226x), `text-base` (59x), `text-lg` (25x), `text-2xl` (15x), `text-xl` (10x), `text-3xl` (7x), `text-4xl` (2x)
  - Arbitrary px/rem/em: `text-[11px]` (360x), `text-[10px]` (193x), `text-[10.5px]` (40x), `text-[13px]` (19x), `text-[11.5px]` (12x), `text-[15px]` (12x), `text-[9px]` (12x), `text-[12px]` (11x), `text-[9.5px]` (10x), `text-[13.5px]` (7x), `text-[14px]` (5x), `text-[12.5px]` (5x), `text-[14.5px]` (2x), `text-[15.5px]` (2x), `text-[0.86em]` (2x), `text-[18px]` (1x), `text-[16px]` (1x), `text-[17px]` (1x), `text-[1.35rem]` (1x), `text-[1.18rem]` (1x), `text-[1.06rem]` (1x), `text-[0.98rem]` (1x), `text-[0.84rem]` (1x), `text-[0.84em]` (1x), `text-[0.8rem]` (1x), `text-[0.85em]` (1x), inline `fontSize: '12px'` (2x).

### 4.3 Off-Scale Spacing Tokens (`src/` + `index.html`)
- **196 unique spacing classes** (**4,633 total occurrences**); **100 unique off-scale classes** (**1,848 occurrences**) outside the target `4/8/12/16/24/32/48` (`1/2/3/4/6/8/12`) scale:
  - Top offenders: `gap-1.5` (269x), `py-1.5` (191x), `px-2.5` (162x), `px-3.5` (126x), `py-0.5` (107x), `gap-2.5` (82x), `mt-0.5` (78x), `py-2.5` (78x), `p-3.5` (66x), `p-5` (65x), `px-1.5` (50x), `space-y-2.5` (43x), `p-1.5` (42x), `space-y-1.5` (32x), `p-2.5` (25x), `mb-2.5` (25x), `mb-1.5` (20x), `px-5` (20x), `gap-0.5` (19x), `mt-1.5` (17x), `p-0.5` (17x), plus arbitrary `pb-[72px]`, `p-[1px]`, `p-[2px]`, `gap-[2.5px]`.

### 4.4 Hardcoded URLs
- **Duplicated InstaCloud `zeno-api` host** (`https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com`) hardcoded in 6 places:
  - `src/lib/apiBase.ts:8`
  - `src/App.tsx:106`
  - `src/components/DeepResearchModal.tsx:687`
  - `src/components/InbuiltPdfViewer.tsx:89`
  - `src/components/PageExtractModal.tsx:34`
  - `vercel.json:7`
- **Hardcoded transcript server URL**: `src/components/PageExtractModal.tsx:173` (`https://prod-main-transcript-api-6588e7-006jmayjabt.compute.instacloud-edge.com/api/transcript`)
- **Hardcoded placeholder / demo URLs**: `TregCatalogModal.tsx:36,184` (`https://example.com`), `kokonutui/*.tsx` (`https://kokonutui.com`), `InbuiltPdfViewer.tsx` / `App.tsx:3029` (`https://arxiv.org/pdf/1706.03762.pdf`), `kobra/image-generation.tsx:61` (`https://image.pollinations.ai/prompt/...`), `index.html:37` (`cdn.jsdelivr.net` KaTeX), `src/lib/pdfStudyEngine.ts:142` (`cdnjs.cloudflare.com` PDF.js worker).

---

## 5. `console.log`, `TODO`, Commented-Out Code, Mocks & Placeholders

- **`console.log` / `console.debug` / `console.info` (10 hits)**:
  - `src/components/DeepResearchModal.tsx:1315, 1317`
  - `src/components/StudyWorkspace.tsx:3398`
  - `src/components/__tests__/citationChipRender.test.tsx:125`
  - `server/legalAndSafetyEngine.ts:1372, 1431`
  - `server.ts:9933, 9964, 14146, 14168`
- **`TODO` / `FIXME` / `XXX` / `HACK`**: **0 hits**.
- **Commented-out code blocks**: **0 multi-line commented code blocks** (`// const ...` etc. = 0).
- **Mocks / Placeholders / Template Fallbacks**:
  - `src/App.tsx:3305` & `src/components/LegalAndInfoPages.tsx:1146` (`placeholder="you@example.com"`)
  - `src/components/TregCatalogModal.tsx:36, 184` (`{"url": "https://example.com"}`)
  - `server/agentFramework.ts:2580–2652` (hardcoded 5-question `const templates = [...]` synthetic MCQ fallback when LLM returns `< 5` weak-spot questions, with `Date.now()` IDs)
  - `server/agentFramework.ts:2977–3004` (template-generated flashcards & MCQs when `uploadStudyPack` LLM returns empty: e.g., `"What is the key takeaway presented on Page ${b.page}..."`, `"According to Page ${b.page}..."`, `"An unrelated hypothesis..."`, with `Date.now()` IDs)

---

## 6. Slop Checklist (`file:line` Hits)

- **Narrating comments (35+ hits)**: `src/App.tsx:1813`, `src/main.tsx:2`, `AnalyticsDashboardModal.tsx:74`, `DeepResearchModal.tsx:440, 599, 644, 929, 1116`, `GrokChatMessage.tsx:1738`, `InbuiltPdfViewer.tsx:413, 600`, `studyLoopStore.ts:578`, `userAccountStore.ts:364, 1531`, `server.ts:151, 2016, 2971, 3334, 3378, 3407, 3422, 3547, 4455, 4505, 4996, 5050, 5287, 5403, 8698, 8745, 9138, 12030, 12126`, `server/agentFramework.ts:3044`, `server/billingEngine.ts:1742`.
- **Emojis in code/logs/UI (41 lines)**:
  - `src/App.tsx:398, 1629, 2196, 2364, 3076 (⚡), 3226 (✕), 3359 (✕)`
  - `HomeReferralPopup.tsx:211`, `KinichGrowthHubModal.tsx:1799`, `Sidebar.tsx:971 (★/✓/🛡)`, `StreakModal.tsx:719, 723`, `StudyWorkspace.tsx:2925`
  - `src/lib/exportChat.ts:115`
  - `server.ts:3357, 11916, 12965, 13248, 13281, 13283, 13301 (⭐/🍴)`
  - `server/growthEngine.ts:1974 (★)`, `server/weatherService.ts:83–93` (`☀️`..`⛈️`).
- **Empty `catch {}` blocks (312 hits)**: e.g., `src/App.tsx:300, 553, 564, 572, 736, 790, 1000, 1010, 1051, 1066, 1265, 1280, 1333, 2793, 3019`, `AccountWorkspacePage.tsx:558, 825, 2192`, `DeepResearchModal.tsx:701, 781, 1459`, `GrokChatMessage.tsx:502, 686, 1374`, `InbuiltPdfViewer.tsx:103, 307, 333, 451, 469, 2134`, `LegalAndInfoPages.tsx:173, 187, 212`, `server/agentFramework.ts:3263, 3391`, `server.ts:9993, 13227, 13241, 13345`.
- **Scattered raw `fetch()`**: **102 calls** in `src/` and **102 calls** in `server.ts` + `server/*` instead of a single typed API client.
- **Type escapes**: **698 explicit `any` annotations** (181 in `src/`, 517+ in `server.ts` & `server/*`) + **2 `as unknown as`** (`server/billingEngine.ts:2499`, `server/rateLimiter.ts:295`). `@ts-ignore` / `@ts-expect-error`: **0**.
- **AI UI slop (100+ lines)**:
  - `Sparkles` icon: `kobra/chat-input.tsx:19`, `ui/signup-1.tsx:2, 300`, `AnalyticsDashboardModal.tsx:8, 211`, `DeepResearchModal.tsx:18, 1939, 2796`, `Sidebar.tsx:20`, `HomeReferralPopup.tsx:2, 191`, `GrokChatMessage.tsx:36, 2904`, `StudyWorkspace.tsx:44, 3047`, `ChatMessage.tsx:3, 44`, `GithubRepoCard.tsx:2`
  - `animate-bounce`: `kobra/chat-input.tsx:522`, `InbuiltPdfViewer.tsx:802`
  - Gradients / glassmorphism (`bg-gradient-to-*`, `bg-clip-text`, `backdrop-blur-*`): `ChatMessage.tsx:43` (`from-sky-500 to-indigo-600`), `TregCatalogModal.tsx:94` (`from-sky-500/20 to-indigo-500/20`), `App.tsx:2589, 2658, 2670, 3068`, `Sidebar.tsx:770, 775`, `GrokChatMessage.tsx:1053, 1080`, `modelGradients.ts`, `kobra/reasoning-steps.tsx:144–145`.
- **Clickable `<div>`s (`<div onClick=...>`)**: `StudyWorkspace.tsx:2583, 2628`, `Sidebar.tsx:768, 1276`, `DodoStatusModal.tsx:161` (and overlays).
- **Dual / inconsistent terminology**:
  - `Daily Recall` (`StudyLoopPanel.tsx:762`, `StudyWorkspace.tsx:2531, 3631`) vs `Daily Revision` (`StudyLoopPanel.tsx:110`, `studyLoopStore.ts:87`) vs `Study Loop` (`StudyWorkspace.tsx:6130`)
  - `Exam Plan` (`StudyLoopPanel.tsx:763`) vs `Auto Plan` (`server/agentFramework.ts:2395`)
- **Copy slop (hype, `!`, `—`, `"unlimited"`)**:
  - Hype: `metadata.json:3` (`"supercharged ... powered by Treg and Google Gemini"`), `server.ts:316` (`"seamlessly"`).
  - Em-dash (`—`): **84+ lines** in `src/` (`App.tsx:861, 893, 3066`, `StudyLoopPanel.tsx:801`, etc.).
  - `"unlimited"`: **6 hits**, all internal comments (`kobra/chat-input.tsx:211`, `userAccountStore.ts:1014`, `server/agentFramework.ts:187, 1925`, `server/rateLimiter.ts:14, 376`). Must keep out of all UI copy.
- **Leftover `Zeno` branding**:
  - `public/zeno-icon.svg`
  - `vite.config.ts:13, 16, 43` (`zenoStaticPrerenderPlugin` / `zeno-static-prerender`)
  - `vercel.json:7`, `src/lib/apiBase.ts:7, 39, 65, 88, 104, 108, 114, 119` (`INSTACLOUD_ZENO_API_ORIGIN`, comments)
  - `src/lib/growthStore.ts:1457, 1710` (`ZENO PAGES`, `ZENO PASSES`)
  - `src/types.ts:489` (`ZENO GROWTH ENGINE TYPES`)
  - `src/components/LegalAndInfoPages.tsx:671` (`ZENO-TICKET`)
  - `src/components/ShareExportStudioModal.tsx:484`
  - `package.json:15` (`demo-zeno-security`)
  - `server.ts` & `server/*` (**75 hits**: `zeno-fast` model alias at `server.ts:578, 1356`, `User-Agent: ZenoAI/1.0` / `Zeno-AI-App`, CORS `https://zeno0x.vercel.app`, `X-Zeno-Client-Id`, `X-Zeno-Voice-Gender`, `ZENO_FAVICON_SVG` in `server/legalAndSafetyEngine.ts:20`).

---

## 7. Root Causes of the 5 Listed BUGS (Verified `file:line`)

1. **Bug 1 — `POST /api/study/snap-solve` returns 404 & must return `{steps: string[], answer: string}`**:
   - Duplicate handlers exist in backend: `server/agentFramework.ts:3423` (mounted via `registerAgentFrameworkRoutes(app)` at `server.ts:4454`) AND `server.ts:9850` (`app.post('/api/study/snap-solve')`), with divergent JSON shapes (`{ ok, steps, finalAnswer }` vs `{ success, ok, steps, answer, finalAnswer }`) and model `zro/deepseek-v4.1-flash` (`server.ts:9895`) vs `callAgentLlm` (`agentFramework.ts:3383`). Also `vercel.json:7` and `src/lib/apiBase.ts:8, 104` proxy `/api/*` to the remote `zeno-api` deployment, which returns 404 when out of sync with local routes. Consolidating to one authoritative handler returning `{ ok: true, success: true, steps: string[], answer: string, ... }` and checking `zeno-api` deployment parity is required.
2. **Bug 2 — Quiz & flashcards quality (no timestamps in stems, no templates, schema-validated single LLM call + 1 retry)**:
   - `server/agentFramework.ts:2580–2652` (`/api/study-loop/weak-spots/practice`) falls back to 5 hardcoded `templates` stems with `Date.now()` IDs whenever the LLM returns `< 5` questions.
   - `server/agentFramework.ts:2977–3004` (`/api/study/upload`) falls back to template-string flashcards (`"What is the key takeaway presented on Page..."`) and template MCQs (`"According to Page ... which statement accurately reflects..."`, `"An unrelated hypothesis..."`) with `Date.now()` IDs.
   - `server.ts:10731–11064` (`validateStudyBundleJson` + `synthesizeStudyBundleViaLLM`): enforces no timestamps & retries once, but currently uses `numChunks` parallel loops (`server.ts:10713, 11010`); inspect/align per bug spec if single schema-validated call + 1 retry is required.
3. **Bug 3 — `/snap-solve` deep link opens Daily Recall instead of Snap & Solve**:
   - `src/App.tsx:690–713` initializes `isSignedIn` to `true` for `/study`, `/battle`, `/vault`, `/pricing`, `/research`, `/discover`, `/share/`, `/p/`, **omitting `/snap-solve`**, so cold deep links to `/snap-solve` hit the Sign-In landing screen (`Signup1`) for unauthenticated users.
   - `src/components/StudyWorkspace.tsx:443–449, 2520–2552` renders `/snap-solve` inside a collapsible toggle `"Daily Recall, Exam Plan & Snap Solve"` below the Study Space search/Spaces list instead of opening Snap & Solve directly, and `StudyWorkspace.tsx:3633` opens the `'study_loop'` workspace tab titled `'Daily Recall'` without syncing route/tab state on `navigateRoute`.
4. **Bug 4 — Guest Explorer chip opens Streaks instead of Profile/Sign-In**:
   - `src/lib/userAccountStore.ts:597–616`: `isGuest()` checks `!isUserSignedIn() || isAnonymous || signinProvider === 'guest' || email === 'guest@kinich.app' || id.startsWith('guest_')`, whereas `isGuestUser()` only checks `profile?.signinProvider === 'guest'`. When `userProfile.displayName` defaults to `'Guest Explorer'` (`userAccountStore.ts:44`) without `signinProvider === 'guest'` (e.g., anonymous/guest session or initial profile), `Sidebar.tsx:1267` fails the `isGuestUser()` check and renders the `else` branch (`Sidebar.tsx:1275–1289`) whose clickable chip invokes `e.stopPropagation(); openStreakCenter('badges')` (opening `StreakModal` instead of Auth/Profile).
5. **Bug 5 — Chat ignores length asks (e.g. `"3 lines"`) & apostrophe handling**:
   - `server.ts:12809–12814` & `server.ts:12923–12926` inject multi-paragraph/bullet formatting instructions (`"start with a clear 1-2 sentence opening paragraph... short paragraphs... bullet points"`) without parsing or honoring explicit length constraints in `userQuery` (such as `"in 3 lines"`, `"3 sentences"`, `"one paragraph"`).
   - Apostrophes & HTML entities: `server.ts:12773` & `server/searchProviders.ts:143` decode `&#39;`/`&apos;`, `server/legalAndSafetyEngine.ts:126` & `server/growthEngine.ts:161` encode `'`, `src/components/MathMarkdown.tsx:23` runs `.normalize('NFKD')`, and `src/components/GrokChatMessage.tsx` passes content through `ReactMarkdown` with `rehypeRaw`; any upstream HTML-encoded apostrophe or markdown/NFKD normalization must preserve literal `'` cleanly across chat replies.

---

## 8. `NEEDS HUMAN`

Items deliberately untouched and requiring human action/decision:
1. **Remote backend (`zeno-api`) parity**: `vercel.json:7` rewrites `/api/*` to `https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com/api/:path*`. Frontend/local `server.ts` fixes (such as `/api/study/snap-solve`, quiz/flashcard LLM validation, and `/api/chat` length/apostrophe fixes) will **not** take effect on `kinich.app` until the InstaCloud `zeno-api` container is redeployed from this repo.
2. **Legal Entity / Officer Details (`src/legal/config.ts:8–18`)**: `OPERATOR_NAME` (`'Kinich'`), `ADDRESS` (`'Operated online from India'`), `GRIEVANCE_OFFICER_NAME` (`'Kinich Grievance Officer'`), and `kinich.app@kinich.app` are placeholders/generic labels in legal pages and will **not** be altered by code cleanup.
3. **Environment & Secrets**: `.env`, `keys/`, Firebase config values, Dodo webhook/signature handlers, pricing, plans, and checkout flows will remain strictly untouched.
4. **Heavy Client Audio WASM Assets (`phonon-tts`)**: `dist/` ships 4 WASM files (~17.5 MB total) from `phonon-tts`; confirm whether client-side `phonon-tts` is still desired or should be lazy-loaded/dropped in favor of server TTS.
