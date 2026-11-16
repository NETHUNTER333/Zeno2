import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGULAR_MODEL_PROMPT,
  DEFAULT_UNCENSORED_MODEL_PROMPT,
  buildRegularModelSystemPrompt,
  buildUncensoredModelSystemPrompt,
  clampModelTemperature,
  normalizeReasoningEffort,
  sanitizeProviderIdentityLeak,
} from '../server/prompts';
import {
  buildFallbackPhysicsSimulation,
  createInitialCustomPhysicsState,
  createInitialPhysicsState,
  detectPhysicsPresetFromTopic,
  evaluateMathExpression,
  evaluateSafeFormula,
  getDefaultCustomParams,
  getDefaultPresetParams,
  sanitizeCustomPhysicsSpec,
  stepCustomPhysicsState,
  stepPhysicsState,
} from '../src/lib/physicsEngine';
import {
  SKETCH_PRESETS,
  buildFallbackSketchLesson,
  computeProjectileTrajectoryPoints,
  detectSketchPreset,
  getPresetSketchLesson,
} from '../src/lib/sketchTutorEngine';
import { formatSvgMathText } from '../src/components/StudyPhysicsVisualizeLab';
import {
  escapeCurrencyDollars,
  expressionToLatex,
  formatCanvasMathText,
  hasBareLatexSignals,
  normalizeMathDelimiters,
  renderLatexToHtml,
  renderMixedTextWithKatexHtml,
  wrapBareLatexIfNeeded,
} from '../src/lib/latexEngine';

describe('Dual Model System Prompts & Identity Lock', () => {
  it('provides distinct system prompts for regular models vs uncensored models', () => {
    expect(DEFAULT_REGULAR_MODEL_PROMPT).not.toEqual(DEFAULT_UNCENSORED_MODEL_PROMPT);

    const regularPrompt = buildRegularModelSystemPrompt({
      localDateOnly: '2026-11-16',
      localTimeOnly: '10:00 AM',
      timezone: 'Asia/Kolkata',
      utcOffset: '+05:30',
      utcFull: '2026-11-16T04:30:00Z',
      defaultFormattingRule: '2. Keep formatting clean.',
    });

    const uncensoredPrompt = buildUncensoredModelSystemPrompt({
      localDateOnly: '2026-11-16',
      localTimeOnly: '10:00 AM',
      timezone: 'Asia/Kolkata',
      utcOffset: '+05:30',
      utcFull: '2026-11-16T04:30:00Z',
    });

    expect(regularPrompt).toContain('Kinich');
    expect(regularPrompt).toContain('Context & Source Grounding');
    expect(uncensoredPrompt).toContain('Kinich');
    expect(uncensoredPrompt).toContain('Direct Unfiltered Execution (18+)');
    expect(uncensoredPrompt).not.toContain('Context & Source Grounding');
  });

  it('honors custom user system prompt overrides while keeping Kinich identity lock', () => {
    const customRegular = buildRegularModelSystemPrompt({
      localDateOnly: '2026-11-16',
      localTimeOnly: '10:00 AM',
      timezone: 'UTC',
      utcOffset: '+00:00',
      utcFull: '2026-11-16T10:00:00Z',
      defaultFormattingRule: '2. Clean.',
      modelSettings: {
        regularSystemPrompt: 'Be a concise Socratic physics tutor.',
        uncensoredSystemPrompt: 'Write noir detective prose.',
        reasoningEffort: 'high',
        responseLength: 'concise',
        responseStyle: 'technical',
        maskProviderIdentity: true,
      },
    });

    expect(customRegular).toContain('Be a concise Socratic physics tutor.');
    expect(customRegular).not.toContain('Write noir detective prose.');
    expect(customRegular).toContain('IDENTITY LOCK (MANDATORY): Your name is strictly Kinich');
    expect(customRegular).toContain('Reasoning Depth (Deep)');

    const customUncensored = buildUncensoredModelSystemPrompt({
      localDateOnly: '2026-11-16',
      localTimeOnly: '10:00 AM',
      timezone: 'UTC',
      utcOffset: '+00:00',
      utcFull: '2026-11-16T10:00:00Z',
      modelSettings: {
        regularSystemPrompt: 'Be a concise Socratic physics tutor.',
        uncensoredSystemPrompt: 'Write noir detective prose.',
        maskProviderIdentity: true,
      },
    });

    expect(customUncensored).toContain('Write noir detective prose.');
    expect(customUncensored).not.toContain('Be a concise Socratic physics tutor.');
  });

  it('sanitizes Sapiens AI and other upstream provider identity leaks cleanly', () => {
    expect(
      sanitizeProviderIdentityLeak("I'm an AI assistant developed by Sapiens AI.")
    ).toBe("I'm Kinich, an AI assistant.");

    expect(
      sanitizeProviderIdentityLeak('I am DeepSeek and was trained by DeepSeek AI.')
    ).toBe("I'm Kinich and was built for Kinich.");

    expect(
      sanitizeProviderIdentityLeak('My name is Uncensored Pro, created by Mistral AI.')
    ).toBe('My name is Kinich, built for Kinich.');

    expect(sanitizeProviderIdentityLeak('Powered via CrowLLM')).toBe('Powered via Kinich');
  });

  it('clamps temperature and normalizes reasoning effort safely', () => {
    expect(clampModelTemperature(2.8)).toBe(1.3);
    expect(clampModelTemperature(-0.4)).toBe(0);
    expect(clampModelTemperature('0.65')).toBe(0.65);
    expect(clampModelTemperature('invalid', 0.5)).toBe(0.5);

    expect(normalizeReasoningEffort('low')).toBe('low');
    expect(normalizeReasoningEffort('high')).toBe('high');
    expect(normalizeReasoningEffort('unknown')).toBe('medium');
  });
});

describe('DeepTutor 2D Physics Engine & Math Evaluator', () => {
  it('simulates projectile kinematics and energy exchange over time', () => {
    const params = getDefaultPresetParams('projectile');
    let state = createInitialPhysicsState('projectile', params);
    expect(state.pos).toEqual({ x: 0, y: 0 });
    expect(state.vel.x).toBeGreaterThan(0);
    expect(state.vel.y).toBeGreaterThan(0);

    for (let i = 0; i < 30; i++) {
      state = stepPhysicsState(state, 1 / 60, params);
    }

    expect(state.time).toBeGreaterThan(0.4);
    expect(state.pos.x).toBeGreaterThan(0);
    expect(state.maxHeight).toBeGreaterThan(0);
    expect(state.potentialEnergy).toBeGreaterThan(0);
    expect(state.trail.length).toBeGreaterThan(5);
  });

  it('steps pendulum, spring-mass, orbital, and wave presets without NaNs', () => {
    for (const preset of ['pendulum', 'spring', 'orbital', 'wave'] as const) {
      const params = getDefaultPresetParams(preset);
      let state = createInitialPhysicsState(preset, params);
      for (let i = 0; i < 20; i++) {
        state = stepPhysicsState(state, 1 / 60, params);
      }
      expect(Number.isFinite(state.pos.x)).toBe(true);
      expect(Number.isFinite(state.pos.y)).toBe(true);
      expect(Number.isFinite(state.totalEnergy)).toBe(true);
      expect(state.history.length).toBeGreaterThan(10);
    }
  });

  it('detects best physics preset from study topic keywords', () => {
    expect(detectPhysicsPresetFromTopic('Damped Simple Pendulum')).toBe('pendulum');
    expect(detectPhysicsPresetFromTopic("Hooke's Law Spring Oscillator")).toBe('spring');
    expect(detectPhysicsPresetFromTopic('Wave Interference and Beats')).toBe('wave');
    expect(detectPhysicsPresetFromTopic('Kepler Planetary Orbit Mechanics')).toBe('orbital');
    expect(detectPhysicsPresetFromTopic('Kinematics & Trajectory')).toBe('projectile');
  });

  it('evaluates safe math expressions for y = f(x) plotter without eval', () => {
    expect(evaluateMathExpression('x^2 + 2*x + 1', 3)).toBe(16);
    expect(evaluateMathExpression('sin(0) + cos(0)', 0)).toBeCloseTo(1, 5);
    expect(evaluateMathExpression('sqrt(16) - abs(-2)', 1)).toBe(2);
    expect(evaluateMathExpression('1 / x', 0)).toBeNull();
    expect(evaluateMathExpression('process.exit(1)', 2)).toBeNull();
  });

  it('evaluates multi-variable custom physics formulas and rejects unsafe syntax', () => {
    expect(evaluateSafeFormula('qm * B * vy + E', { qm: 2, B: 1.5, vy: 4, E: 0.5 })).toBeCloseTo(12.5, 5);
    expect(evaluateSafeFormula('max(1, hypot(x, y))', { x: 3, y: 4 })).toBeCloseTo(5, 5);
    expect(evaluateSafeFormula('window.alert(1)', { x: 1 })).toBeNull();
  });

  it('builds and steps prompt-generated custom physics simulations cleanly without NaNs', () => {
    for (const prompt of [
      'bouncing ball with air drag',
      'charged particle in a magnetic field cyclotron',
      'block sliding down an inclined plane with friction',
      'projectile launch on the moon',
      'driven resonance oscillator',
    ]) {
      const spec = buildFallbackPhysicsSimulation(prompt);
      const cleanSpec = sanitizeCustomPhysicsSpec(spec, prompt);
      expect(cleanSpec).not.toBeNull();
      const params = getDefaultCustomParams(cleanSpec!);
      let st = createInitialCustomPhysicsState(cleanSpec!, params);
      for (let i = 0; i < 40; i++) {
        st = stepCustomPhysicsState(st, 1 / 60, cleanSpec!, params);
      }
      expect(Number.isFinite(st.pos.x)).toBe(true);
      expect(Number.isFinite(st.pos.y)).toBe(true);
      expect(Number.isFinite(st.kineticEnergy)).toBe(true);
      expect(st.trail.length).toBeGreaterThan(10);
    }

    // Rejects unsafe LLM spec containing non-math code
    expect(
      sanitizeCustomPhysicsSpec({
        title: 'Bad Spec',
        axExpr: 'globalThis.process()',
        ayExpr: '-9.8',
        initial: { x: '0', y: '0', vx: '1', vy: '1' },
      })
    ).toBeNull();
  });
});

describe('Visual Whiteboard & SketchTutor Engine', () => {
  it('detects all four interactive lesson presets accurately and excludes removed piano preset', () => {
    expect(detectSketchPreset('B minor scale on piano')).toBeNull();
    expect(detectSketchPreset('Pythagorean theorem right triangle proof')).toBe('pythagorean_proof');
    expect(detectSketchPreset('History of the Ford Mustang')).toBe('ford_mustang_history');
    expect(detectSketchPreset('Projectile motion trajectory graph')).toBe('projectile_motion');
    expect(detectSketchPreset('Romanian vocabulary matching')).toBe('romanian_vocab');
  });

  it('builds complete structured visual steps and interactive modules for each preset', () => {
    expect(SKETCH_PRESETS.length).toBe(4);
    for (const preset of SKETCH_PRESETS) {
      expect(getPresetSketchLesson(preset.key).moduleType).not.toBe('piano');
    }

    const pythag = getPresetSketchLesson('pythagorean_proof');
    expect(pythag.moduleType).toBe('geometry');
    expect(pythag.geometry).toMatchObject({ a: 3, b: 4 });

    const mustang = getPresetSketchLesson('ford_mustang_history');
    expect(mustang.moduleType).toBe('gallery');
    expect(mustang.imageQuery).toContain('Ford Mustang');

    const proj = getPresetSketchLesson('projectile_motion');
    expect(proj.moduleType).toBe('graph');
    expect(proj.graph?.mode).toBe('projectile');

    const ro = getPresetSketchLesson('romanian_vocab');
    expect(ro.moduleType).toBe('vocab_match');
    expect(ro.vocabPairs?.length).toBe(6);

    const generic = buildFallbackSketchLesson('Quantum Tunneling');
    expect(generic.steps.length).toBeGreaterThanOrEqual(2);
    expect(generic.steps[0].drawCommands.length).toBeGreaterThan(2);
  });

  it('builds structured monochrome visual lessons for fractions, calculus, and generic topics', () => {
    const fractions = buildFallbackSketchLesson('Fractions and Equivalent Ratios');
    expect(fractions.steps.length).toBeGreaterThanOrEqual(2);
    for (const step of fractions.steps) {
      expect(step.drawCommands.length).toBeGreaterThan(3);
      for (const cmd of step.drawCommands) {
        if ('color' in cmd && cmd.color) {
          expect(cmd.color.toLowerCase()).not.toContain('fc4c01');
          expect(cmd.color.toLowerCase()).not.toContain('e04300');
        }
      }
    }

    const calculus = buildFallbackSketchLesson('Calculus Derivatives and Tangent Slope');
    expect(calculus.steps.length).toBeGreaterThanOrEqual(2);
    for (const step of calculus.steps) {
      expect(step.drawCommands.length).toBeGreaterThan(3);
      for (const cmd of step.drawCommands) {
        if ('color' in cmd && cmd.color) {
          expect(cmd.color.toLowerCase()).not.toContain('fc4c01');
          expect(cmd.color.toLowerCase()).not.toContain('e04300');
        }
      }
    }
  });

  it('ensures all SKETCH_PRESETS contain zero orange hexes in drawCommands', () => {
    for (const preset of SKETCH_PRESETS) {
      const lesson = getPresetSketchLesson(preset.key);
      expect(lesson.steps.length).toBeGreaterThanOrEqual(1);
      for (const step of lesson.steps) {
        for (const cmd of step.drawCommands) {
          if ('color' in cmd && cmd.color) {
            expect(cmd.color.toLowerCase()).not.toContain('fc4c01');
            expect(cmd.color.toLowerCase()).not.toContain('e04300');
          }
          if ('fill' in cmd && cmd.fill) {
            expect(cmd.fill.toLowerCase()).not.toContain('fc4c01');
            expect(cmd.fill.toLowerCase()).not.toContain('e04300');
          }
        }
      }
    }
  });

  it('computes projectile trajectory points correctly and formats SVG LaTeX labels into clean Unicode', () => {
    const pts = computeProjectileTrajectoryPoints(20, 45, 9.8);
    expect(pts.length).toBeGreaterThan(20);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1].y).toBe(0);
    expect(pts[pts.length - 1].x).toBeGreaterThan(35);

    expect(formatSvgMathText('$\\Delta E = h\\nu$')).toBe('ΔE = hν');
    expect(formatSvgMathText('$H_2O$')).toBe('H₂O');
    expect(formatSvgMathText('$\\Delta pH$ and $\\Delta\\Psi$')).toBe('ΔpH and ΔΨ');
  });
});

describe('Robust STEM LaTeX Engine (KaTeX + mhchem)', () => {
  it('normalizes block, inline, and equation environments while preserving code blocks and currency', () => {
    const bracketMath = normalizeMathDelimiters('Compute \\[E = mc^2\\] and \\(a^2 + b^2 = c^2\\).');
    expect(bracketMath).toContain('$$');
    expect(bracketMath).toContain('$a^2 + b^2 = c^2$');

    const alignEnv = normalizeMathDelimiters('\\begin{align}x &= 1\\\\y &= 2\\end{align}');
    expect(alignEnv).toContain('$$');
    expect(alignEnv).toContain('\\begin{aligned}');

    const matrixEnv = normalizeMathDelimiters('\\begin{pmatrix}1 & 0\\\\0 & 1\\end{pmatrix}');
    expect(matrixEnv).toContain('$$');
    expect(matrixEnv).toContain('\\begin{pmatrix}');

    const codePreserved = normalizeMathDelimiters('Here is code: `\\[x + 1\\]` and \\(y = 2\\).');
    expect(codePreserved).toContain('`\\[x + 1\\]`');
    expect(codePreserved).toContain('$y = 2$');

    const currencySafe = escapeCurrencyDollars('The lab kit costs $5 to $10, while $x^2 + y^2 = r^2$.');
    expect(currencySafe).toContain('\\$5 to \\$10');
    expect(currencySafe).toContain('$x^2 + y^2 = r^2$');
  });

  it('auto-detects and wraps bare LaTeX formulas without corrupting plain English', () => {
    const bareQuadratic = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
    expect(hasBareLatexSignals(bareQuadratic)).toBe(true);
    expect(wrapBareLatexIfNeeded(bareQuadratic)).toBe(`$${bareQuadratic}$`);

    const plainSentence = 'Review chapter 3 and budget $12 for lab notebooks tomorrow.';
    expect(hasBareLatexSignals(plainSentence)).toBe(false);
    expect(wrapBareLatexIfNeeded(plainSentence)).toBe(plainSentence);
  });

  it('renders STEM calculus, quantum braket, and mhchem chemistry formulas into valid KaTeX HTML', () => {
    const derivHtml = renderLatexToHtml('\\dv{y}{x} + \\pdv{u}{t} = \\grad \\cdot \\vecbf{F}', { displayMode: true });
    expect(derivHtml).toContain('katex-display');
    expect(derivHtml).toContain('katex-mathml');
    expect(derivHtml).not.toContain('katex-error');

    const braKetHtml = renderLatexToHtml('\\braket{\\psi|\\phi} = \\int_{-\\infty}^{\\infty} \\psi^* \\phi \\dd{x}');
    expect(braKetHtml).toContain('katex');
    expect(braKetHtml).not.toContain('katex-error');

    const chemHtml = renderLatexToHtml('\\ce{2H2 + O2 -> 2H2O}');
    expect(chemHtml).toContain('katex');
    expect(chemHtml).toContain('O');
    expect(chemHtml).not.toContain('katex-error');

    const mixed = renderMixedTextWithKatexHtml('Water is $\\ce{H2O}$ and costs $5 per bottle.');
    expect(mixed).toContain('katex');
    expect(mixed).toContain('$5 per bottle');
    expect(mixed).not.toContain('\\$5');
  });

  it('converts Curve Plotter expressions cleanly into LaTeX', () => {
    expect(expressionToLatex('sin(x) * exp(-0.12 * abs(x))')).toBe('\\sin(x) \\cdot e^{-0.12 \\cdot |x|}');
    expect(expressionToLatex('1 / (1 + exp(-x))')).toBe('\\frac{1}{1 + e^{-x}}');
  });

  it('formats 2D canvas math strings with Unicode superscripts, subscripts, fractions, and Greek symbols', () => {
    expect(formatCanvasMathText('$\\frac{a}{b} + x^2 + \\alpha_1$')).toBe('(a)/(b) + x² + α₁');
  });
});


