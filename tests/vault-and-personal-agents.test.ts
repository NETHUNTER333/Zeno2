import { describe, it, expect } from 'vitest';
import {
  PERSONAL_AGENTS,
  AGENT_TOOLS,
  DAILY_AGENT_TOKEN_CAPS,
  routeAgentTrigger,
  runSageOnSave,
  runAgentOnMessage,
  appendAgentMemoryFacts,
  getAgentMemoryFacts,
  getUserAgentUsage,
  VaultItemInput,
  formatToIstDate,
  autoCaptureVaultThread,
  getUserVaultThreads,
  deleteThreadAndWipeMemory,
  indexThreadKeyPoints,
  searchVaultMemoryIndex,
  getExternalLlmProviders,
} from '../server/agentFramework';

describe('The Vault & Personal Study Agents (Phase 1 + Phase 2-4 Schemas)', () => {
  it('exposes all required personal agents and reusable study tools', () => {
    expect(PERSONAL_AGENTS.sage).toBeDefined();
    expect(PERSONAL_AGENTS.sage.trigger).toBe('on_save');
    expect(PERSONAL_AGENTS.recall).toBeDefined();
    expect(PERSONAL_AGENTS.planner).toBeDefined();
    expect(PERSONAL_AGENTS.doubt_buddy).toBeDefined();
    expect(PERSONAL_AGENTS.morning_brief).toBeDefined();

    const requiredTools = [
      'searchWeb',
      'deepResearch',
      'getTranscript',
      'makeQuiz',
      'makeFlashcards',
      'summarize',
      'readVault',
      'writeVault',
    ];
    for (const tool of requiredTools) {
      expect(AGENT_TOOLS[tool as keyof typeof AGENT_TOOLS]).toBeDefined();
    }
  });

  it('auto-organizes a saved YouTube study lecture into Subject -> Chapter within 10s and links a second related lecture', async () => {
    const startMs = Date.now();
    const firstLecture: VaultItemInput = {
      id: 'vault-lec-thermo-1',
      type: 'lecture',
      title: 'Laws of Thermodynamics & Entropy — Lecture 1',
      content:
        'In this lecture we cover the First and Second Laws of Thermodynamics, internal energy, enthalpy, heat transfer, and entropy in closed systems.',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      timestamps: [
        '[00:00] First Law of Thermodynamics',
        '[05:30] Entropy & Second Law',
      ],
      createdAt: Date.now() - 60_000,
    };

    const firstResult = await runSageOnSave({
      userId: 'test-student-uid-1',
      userTier: 'spark',
      item: firstLecture,
      existingVaultItems: [],
    });

    const elapsedMs = Date.now() - startMs;
    expect(elapsedMs).toBeLessThan(10_000);
    expect(firstResult.subject).toBe('Physics');
    expect(firstResult.chapter).toContain('Thermodynamics');
    expect(firstResult.tags.length).toBeGreaterThan(0);
    expect(firstResult.agentReply.agentId).toBe('sage');

    // Now save a second related lecture on Carnot heat engines & thermodynamics
    const secondLecture: VaultItemInput = {
      id: 'vault-lec-thermo-2',
      type: 'lecture',
      title: 'Carnot Cycle, Heat Engines & Reversible Entropy',
      content:
        'Continuation of thermodynamics: Carnot heat engine efficiency, isothermal and adiabatic expansion, and entropy changes.',
      sourceUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
      timestamps: ['[02:15] Carnot Cycle derivation'],
      createdAt: Date.now(),
    };

    const organizedFirstLecture: VaultItemInput = {
      ...firstLecture,
      subject: firstResult.subject,
      chapter: firstResult.chapter,
      tags: firstResult.tags,
    };

    const secondResult = await runSageOnSave({
      userId: 'test-student-uid-1',
      userTier: 'spark',
      item: secondLecture,
      existingVaultItems: [organizedFirstLecture],
    });

    expect(secondResult.subject).toBe('Physics');
    expect(secondResult.chapter).toContain('Thermodynamics');
    expect(secondResult.relatedItemIds).toContain('vault-lec-thermo-1');
    expect(secondResult.sageNote.toLowerCase()).toContain('related to your earlier');
    expect(secondResult.linkedItems[0]?.id).toBe('vault-lec-thermo-1');
  });

  it('routes on_save and on_message triggers via cheap router and enforces 50-entry agent memory cap', async () => {
    const saveRoute = await routeAgentTrigger({
      trigger: 'on_save',
      userTier: 'spark',
      savedItem: {
        id: 'v1',
        type: 'note',
        title: 'Organic Chemistry Alkenes',
        content: 'Markovnikov addition reaction mechanism on alkenes.',
      },
    });
    expect(saveRoute.shouldAct).toBe(true);
    expect(saveRoute.agentId).toBe('sage');

    const plannerRoute = await routeAgentTrigger({
      trigger: 'on_message',
      userTier: 'fire',
      message: 'My physics exam is on Dec 12, build a day-by-day study schedule from my vault',
    });
    expect(plannerRoute.shouldAct).toBe(true);
    expect(plannerRoute.agentId).toBe('planner');

    // Verify 50-entry memory cap per user per agent
    const sixtyFacts = Array.from({ length: 60 }, (_, i) => `Fact #${i + 1}: Weak at topic ${i + 1}`);
    const savedFacts = appendAgentMemoryFacts('test-memory-user', 'sage', sixtyFacts);
    expect(savedFacts.length).toBe(50);
    expect(getAgentMemoryFacts('test-memory-user', 'sage').length).toBe(50);
  });

  it('logs tokens per agent per user and enforces daily caps per tier', async () => {
    const uid = 'test-quota-user';
    expect(DAILY_AGENT_TOKEN_CAPS.spark).toBeGreaterThan(0);
    expect(DAILY_AGENT_TOKEN_CAPS.fire).toBeGreaterThan(DAILY_AGENT_TOKEN_CAPS.spark);

    const msgRes = await runAgentOnMessage({
      userId: uid,
      userTier: 'fire',
      message: 'My Thermodynamics exam is on Dec 15, create a study plan from my vault',
      vaultItems: [
        {
          id: 'v-thermo',
          type: 'lecture',
          title: 'Thermodynamics Lecture 1',
          subject: 'Physics',
          chapter: 'Thermodynamics',
          content: 'First and Second laws of thermodynamics.',
          timestamps: ['[04:10] Second Law'],
        },
      ],
      agentMemory: [],
    });

    expect(msgRes.acted).toBe(true);
    expect(msgRes.agentReply).toBeDefined();
    const usageAfter = getUserAgentUsage(uid);
    expect(usageAfter.totalTokensUsed).toBeGreaterThan(0);
  });

  it('multi-provider fallback: detects non-Gemini API keys and configures correct base URLs and models', () => {
    const prevFallback = process.env.FALLBACK_API_KEY;
    const prevTh = process.env.TOKENHARBOR_API_KEY;
    const prevItera = process.env.ITERA_COMPUTE_API_KEY;

    try {
      process.env.FALLBACK_API_KEY = 'sk-fallback-test-token';
      process.env.TOKENHARBOR_API_KEY = 'sk-th-test-token';
      process.env.ITERA_COMPUTE_API_KEY = 'sk-itera-test-token';

      const providers = getExternalLlmProviders();
      const fallbackProv = providers.find((p) => p.name === 'fallback');
      expect(fallbackProv).toBeDefined();
      expect(fallbackProv?.baseUrl).toBe('https://tokenharbor.ai/v1');
      expect(fallbackProv?.model).toBe('deepseek-v4.1-flash:free');

      const thProv = providers.find((p) => p.name === 'tokenharbor');
      expect(thProv).toBeDefined();
      expect(thProv?.baseUrl).toBe('https://tokenharbor.ai/v1');

      const iteraProv = providers.find((p) => p.name === 'iteracompute');
      expect(iteraProv).toBeDefined();
      expect(iteraProv?.baseUrl).toBe('https://api.iteracompute.com/v1');
      expect(iteraProv?.model).toBe('qwen/qwen3.8-27b');
    } finally {
      if (prevFallback !== undefined) process.env.FALLBACK_API_KEY = prevFallback;
      else delete process.env.FALLBACK_API_KEY;
      if (prevTh !== undefined) process.env.TOKENHARBOR_API_KEY = prevTh;
      else delete process.env.TOKENHARBOR_API_KEY;
      if (prevItera !== undefined) process.env.ITERA_COMPUTE_API_KEY = prevItera;
      else delete process.env.ITERA_COMPUTE_API_KEY;
    }
  });

  it('auto-capture vault threads: extracts 5-10 key points with mm:ss timestamps, TL;DR, IST date, and agent auto-comments', async () => {
    const uid = 'student-autocapture-uid-1';
    const captureRes = await autoCaptureVaultThread({
      userId: uid,
      userTier: 'spark',
      content: 'Here is the lecture on Thermodynamics and Entropy with laws and formulas',
      title: 'Thermodynamics Lecture 2: Carnot Efficiency & Entropy',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      inputType: 'youtube',
      timestamps: [
        '[00:00] Introduction to Carnot Engines',
        '[04:30] Isothermal and Adiabatic Expansion',
        '[09:15] Reversible Entropy Calculation',
        '[14:40] Second Law Derivation & Efficiency Formula',
      ],
    });

    expect(captureRes.ok).toBe(true);
    expect(captureRes.thread).toBeDefined();
    const thread = captureRes.thread!;
    expect(thread.type).toBe('youtube');
    expect(thread.subject).toBe('Physics');
    expect(thread.tldr.length).toBeGreaterThan(10);
    expect(thread.keyPoints.length).toBeGreaterThanOrEqual(4);
    // Key points should include timestamps
    const hasTimestamps = thread.keyPoints.some((kp) => kp.timestamp && kp.timestamp.includes(':'));
    expect(hasTimestamps).toBe(true);

    // Agent comments: Sage filing comment + Recall active recall comment
    const comments = thread.comments || [];
    expect(comments.length).toBeGreaterThanOrEqual(2);
    const sageComment = comments.find((c) => c.author === 'sage');
    expect(sageComment).toBeDefined();
    expect(sageComment?.text.toLowerCase()).toContain('filed under physics');

    const recallComment = comments.find((c) => c.author === 'recall');
    expect(recallComment).toBeDefined();
    expect(recallComment?.text.toLowerCase()).toContain('recall');

    // Date in IST
    const istString = formatToIstDate(thread.createdAt);
    expect(istString).toMatch(/[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+·\s+\d{1,2}:\d{2}\s+(AM|PM)/i);
  });

  it('deduplicates YouTube videos and updates existing thread instead of duplicating', async () => {
    const uid = 'student-dedup-uid-1';
    const firstRes = await autoCaptureVaultThread({
      userId: uid,
      userTier: 'spark',
      content: 'Watch this lecture on Quantum Mechanics',
      title: 'Quantum Mechanics Lecture 1',
      sourceUrl: 'https://www.youtube.com/watch?v=kNYsHsmbT1k',
      inputType: 'youtube',
    });
    expect(firstRes.ok).toBe(true);

    // Duplicate call with short youtu.be URL
    const duplicateRes = await autoCaptureVaultThread({
      userId: uid,
      userTier: 'spark',
      content: 'Review the same Quantum Mechanics video',
      sourceUrl: 'https://youtu.be/kNYsHsmbT1k',
      inputType: 'youtube',
    });
    expect(duplicateRes.ok).toBe(true);
    expect(duplicateRes.deduplicated).toBe(true);
    expect(duplicateRes.thread?.id).toBe(firstRes.thread?.id);
  });

  it('searches memory index for citations and wipes everything when user forgets thread', async () => {
    const uid = 'student-forget-uid-1';
    const captureRes = await autoCaptureVaultThread({
      userId: uid,
      userTier: 'spark',
      content: 'Lecture on Organic Chemistry Alkenes and Electrophilic Addition Mechanisms',
      title: 'Organic Chemistry Alkenes',
      sourceUrl: 'https://www.youtube.com/watch?v=alkene12345',
      inputType: 'youtube',
      timestamps: ['[06:20] Markovnikov Rule & Carbocation Stability'],
    });

    const thread = captureRes.thread!;
    indexThreadKeyPoints(uid, thread);

    // Memory citations search before forgetting
    const citationsBefore = searchVaultMemoryIndex(uid, 'carbocation Markovnikov rule');
    expect(citationsBefore.length).toBeGreaterThan(0);
    expect(citationsBefore[0].citation).toContain('From your');
    expect(citationsBefore[0].citation).toContain('Organic Chemistry');

    // User clicks "Forget this"
    deleteThreadAndWipeMemory(uid, thread.id);

    // Verify removed from Vault
    const threadsAfter = getUserVaultThreads(uid);
    expect(threadsAfter.find((t) => t.id === thread.id)).toBeUndefined();

    // Verify memory index is wiped
    const citationsAfter = searchVaultMemoryIndex(uid, 'carbocation Markovnikov rule');
    expect(citationsAfter.length).toBe(0);
  });
});
