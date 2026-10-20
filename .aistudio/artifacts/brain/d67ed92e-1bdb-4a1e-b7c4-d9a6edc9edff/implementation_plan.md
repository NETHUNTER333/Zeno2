# Zeno — Read Aloud Padded Selector & YouTube Study Workspace

This plan details the upgrade to the **Read Aloud** language and voice selector (replacing the native browser `<select>` element with a custom, padded, surface-matched dropdown menu) and the creation of a **Full-Screen YouTube Study & Analysis Workspace** powered by an **InstaCloud Subclip** transcript extraction pipeline with automatic multi-tier fallback, interactive **Transcript**, **Summary**, **Explanation**, **Flashcards**, **Quiz**, and **Contextual Video Chat**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All core product and UX decisions below were confirmed during the interactive clarification phase:

- **Confirmed Decision 1 (Study & Analysis Tools)**: Include **Transcript**, **Summary**, **Explanation**, **Flashcards**, **Quiz**, and **Chat** inside the YouTube workspace.
- **Confirmed Decision 2 (Workspace Presentation)**: Render as a **Full-Screen Dedicated Study Modal** with clean tab switching, synchronized video player + timestamped transcript, and zero decorative clutter.
- **Confirmed Decision 3 (Read Aloud Language Selector)**: Replace the native browser `<select>` dropdown in `TtsPopup` with a **custom padded dropdown menu** matching the application's dark/light surface aesthetic (`#121215` / `#1a1a1f`, crisp 1px hairline borders, proper inner/outer padding, and active checkmark indicator).
- **Confirmed Decision 4 (Transcript Extraction Architecture)**: Configure and deploy the **Subclip (`palamut62/subclip` / Reclips)** transcript extraction service on **InstaCloud** (project `d374ae51-92bc-4bcb-83e0-ecc46ea5794a`) as the primary extraction tier, backed by automatic server-side fallback (YouTube Innertube caption tracks, timed XML/JSON3 parser, and Treg extraction) so every YouTube video with captions or audio metadata resolves reliably.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Grounded Read Aloud Control (`TtsPopup`)**: Replaces the default OS/browser `<select>` box with a bespoke, padded dropdown menu and segmented voice gender toggle that matches Zeno's custom model picker and action popovers.
  2. **YouTube Link & Video Study Workspace**: Allows users to paste any YouTube URL (via a dedicated trigger in the composer, video cards, or message links) to open a full-screen, distraction-free study workspace.
  3. **InstaCloud Subclip Transcript Pipeline**: Extracts timed transcripts (`start_s`, `duration_s`, `text`) from YouTube links via the InstaCloud Subclip service (`d374ae51-92bc-4bcb-83e0-ecc46ea5794a`) with automatic server fallback.
  4. **AI Study Synthesis Engine**: Generates structured, grounded **Summaries**, **First-Principles Explanations**, **Interactive 3D-Flip Flashcards**, **Multiple-Choice Quizzes with instant explanations**, and **Timestamp-Grounded Q&A Chat** directly from the video's transcript.
- **Target Audience / Persona**: Researchers, engineers, and students using Zeno to turn lectures, technical talks, and YouTube videos into interactive study material without leaving the workspace.
- **Key Value**: Eliminates browser-default form controls and promotional "website slop" (no sparkle icons, no fake badges, no decorative pulsing dots, no marketing banners) in favor of a fast, high-density, tactile study environment.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Read Aloud Padded Language & Voice Selector**:
   - Clicking the speaker icon beneath any assistant response opens the `Read Aloud` popover.
   - The voice gender toggle (`Female` / `Male`) and the custom language trigger button sit side-by-side with balanced `p-1.5` / `px-3 py-2` padding and consistent `rounded-xl` geometry.
   - Clicking the language button opens a custom-rendered, scrollable, padded menu (`p-1.5`, `gap-0.5`) displaying all 16 supported languages with native script subtitles and a clean checkmark on the active language.
2. **Launching the YouTube Study Workspace**:
   - Users can open the workspace from any YouTube video card in chat, by clicking a YouTube link, or via the YouTube Study button in the chat composer bar (where they can also paste any `youtube.com` or `youtu.be` URL directly).
3. **Navigating Study Tabs**:
   - **Left Column (Video & Timed Transcript)**: Embedded YouTube player (`youtube-nocookie.com`) at the top; below it, a searchable, auto-scrolling timestamped transcript where clicking any `[MM:SS]` timestamp seeks the video player.
   - **Right Column (Segmented Study Tools)**: Clean single-line segmented control switching between:
     - **Summary**: Executive overview, key takeaways, and timestamped chapter breakdown.
     - **Explanation**: Deep conceptual breakdown of core mechanisms, mental models, and technical terms from the video.
     - **Flashcards**: Interactive deck with front/back card flip, keyboard navigation (`Space` to flip, `←`/`→` to navigate), and mastery tracking (`Known` vs `Review Again`).
     - **Quiz**: Interactive multiple-choice assessment generated from the transcript, with immediate option validation, rationale readout, and final score tally.
     - **Chat**: Dedicated contextual Q&A thread grounded strictly in the video transcript, citing exact `[MM:SS]` timestamps in responses.

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian, high-craft dark/light workspace matching Zeno's existing `#0a0a0a` / `#121215` dark surfaces and `#ffffff` / `#f8f8f8` light surfaces.
- **Anti-Slop & Restraint Rules**:
  - Zero sparkle icons, zero promotional banners, zero colored pill sandwiches, zero decorative pulsing dots, and zero `//` code-comment headers.
  - All metadata (video duration, segment count, timestamps, card progress) uses unboxed text with `·` separators and `tabular-nums` monospace alignment.
- **Spatial & Typographic Math**:
  - Outer container padding (`p-4` / `p-5`) $\ge$ inner child gaps (`gap-2.5` / `gap-3`).
  - Nested border radii follow $r_{\text{inner}} = r_{\text{outer}} - \text{padding}$ (e.g., `rounded-2xl` outer popover $\to$ `rounded-xl` inner control group $\to$ `rounded-lg` active button).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Custom Padded Language Dropdown vs. Native `<select>`**
  - *Chosen Approach*: Build a custom React dropdown state in `TtsPopup` with outside-click dismissal, keyboard `Escape` handling, and custom padded list items.
  - *Why*: Native `<select>` elements render unstyled OS-level menus that ignore CSS padding, border radius, and theme tokens, creating the jarring "website default" look shown in the user's screenshot.
- **Decision 2: Dual-Tier InstaCloud Subclip + Local Innertube Transcript Extraction**
  - *Chosen Approach*: Configure InstaCloud project `d374ae51-92bc-4bcb-83e0-ecc46ea5794a` for Subclip transcript extraction and pair it with a resilient server-side YouTube Innertube / caption track extractor and Treg fallback on `/api/youtube/transcript`.
  - *Why*: Ensures that any YouTube video with closed captions, auto-generated subtitles, or metadata extracts cleanly in under 2 seconds even if one upstream provider is rate-limited.
- **Decision 3: Structured JSON Synthesis for Study Modes**
  - *Chosen Approach*: Dedicated backend route `/api/youtube/study` that accepts the extracted transcript and generates structured JSON for `summary`, `explanation`, `flashcards`, and `quiz`, plus contextual `/api/youtube/chat` for timestamp-grounded Q&A.
  - *Why*: Guarantees deterministic, interactive UI state (flippable cards, clickable quiz choices, clickable timestamp chips) rather than raw markdown walls.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               Zeno Client UI                                 │
│                                                                              │
│  ┌─────────────────────────┐       ┌──────────────────────────────────────┐  │
│  │        TtsPopup         │       │   YouTubeTranscriptModal (Full-Screen│  │
│  │  • Segmented Gender     │       │            Study Workspace)          │  │
│  │  • Custom Padded Lang   │       │  ┌────────────────┬───────────────┐  │  │
│  │    Dropdown Menu        │       │  │ Left Stage:    │ Right Deck:   │  │  │
│  │  • Audio Playback Row   │       │  │ • YT URL Input │ • Summary     │  │  │
│  └────────────┬────────────┘       │  │ • Video Player │ • Explanation │  │  │
│               │                    │  │ • Timed Search │ • Flashcards  │  │  │
│               │                    │  │   Transcript   │ • Quiz        │  │  │
│               │                    │  │                │ • Video Chat  │  │  │
│               │                    │  └───────┬────────┴───────┬───────┘  │  │
│               │                    └──────────┼────────────────┼──────────┘  │
└───────────────┼───────────────────────────────┼────────────────┼─────────────┘
                │                               │                │
                ▼                               ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Zeno Express Server (server.ts)                      │
│                                                                              │
│  POST /api/tts                POST /api/youtube/transcript  POST /api/youtube│
│  • Language Translation       • Tier 1: InstaCloud Subclip    /study & /chat │
│  • Multi-Tier Neural Audio      (d374ae51-92bc-4bcb-83e0...)• Structured JSON│
│                               • Tier 2: YouTube Innertube     Flashcards,    │
│                                 Caption Track & XML Parser    Quiz, Summary, │
│                               • Tier 3: Treg YT Transcript    & Explanation  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`YouTubeTranscriptSegment`**: `{ start_s: number; duration_s: number; text: string }`
- **`YouTubeStudyBundle`**:
  - `summary`: `{ overview: string; keyPoints: string[]; chapters: Array<{ timestamp: number; title: string; summary: string }> }`
  - `explanation`: `{ coreThesis: string; concepts: Array<{ term: string; definition: string; mechanism: string; timestamp?: number }> }`
  - `flashcards`: `Array<{ id: string; front: string; back: string; category: string; timestamp?: number }>`
  - `quiz`: `Array<{ id: string; question: string; options: string[]; correctIndex: number; explanation: string; timestamp?: number }>`

### Interactive Component & State Mapping

- **`TtsPopup`**:
  - `isLangDropdownOpen`: toggles the custom padded language popover (`max-h-60 overflow-y-auto p-1.5 rounded-xl border`).
  - Selecting a language updates `ttsLang`, persists via `setSavedTtsLanguage`, closes the menu, and stops any active audio playback cleanly.
- **`YouTubeTranscriptModal` (Full-Screen Study Workspace)**:
  - **URL Bar**: Allows pasting or switching to any YouTube link (`https://www.youtube.com/watch?v=...` or `https://youtu.be/...`) on the fly.
  - **Tab Controller**: Switches active view between `transcript` (mobile) / split view (desktop) and `summary`, `explanation`, `flashcards`, `quiz`, and `chat`.
  - **Flashcard Deck State**: Tracks `currentCardIndex`, `isFlipped`, and `cardMastery` (`Record<string, 'known' | 'review'>`) with a reset and filter-by-unmastered control.
  - **Quiz Assessment State**: Tracks `selectedAnswers` (`Record<string, number>`), `submittedQuestions`, live score counter (`tabular-nums`), and `Reset Quiz` / `Generate New Set` actions.
  - **Contextual Video Chat**: Maintains a message list scoped to the active `videoId`, sending the transcript context + user question to `/api/youtube/study` (`mode: 'chat'`) and rendering clickable `[MM:SS]` timestamp buttons that seek the video player.
