import { pool } from './db.js';

const UNOROUTER_URL = `${(process.env.UNOROUTER_BASE_URL || 'https://api.unorouter.com/v1').replace(/\/$/, '')}/chat/completions`;
const UNOROUTER_MODEL = process.env.UNOROUTER_MODEL || 'claude-sonnet-5-5';

function normalizeVerdict(verdict) {
  const v = String(verdict || '').toLowerCase();
  if (v === 'accepted' || v === 'success' || v === 'finished') return 'Accepted';
  if (v.includes('wrong')) return 'Wrong Answer';
  if (v.includes('time')) return 'Time Limit Exceeded';
  if (v.includes('runtime')) return 'Runtime Error';
  if (v.includes('compile')) return 'Compilation Error';
  return verdict || 'Unknown';
}

async function fetchProblemContext(problemSlug) {
  if (!problemSlug) return null;
  try {
    const [rows] = await pool.execute(
      'SELECT title, difficulty, tags, description, input_format, output_format, example_input, example_output FROM problems WHERE slug = ? LIMIT 1',
      [problemSlug]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

function buildReviewPrompt({ language, sourceCode, verdict, testResults, problem }) {
  const failed = (testResults || []).filter(t => t.status && t.status !== 'Passed').slice(0, 5);
  const failedSummary = failed.map(t => `#${t.testIndex}: ${t.status}${t.isSample ? ' (sample)' : ''}`).join(', ') || 'None';

  return `You are an expert competitive programming code reviewer. Analyze the submission and return ONLY valid JSON (no markdown, no code fences).

Problem: ${problem?.title || 'Unknown'} (${problem?.difficulty || 'Unknown'})
Tags: ${problem?.tags || 'N/A'}
Description: ${problem?.description || 'N/A'}
Input: ${problem?.input_format || 'N/A'}
Output: ${problem?.output_format || 'N/A'}
Example Input: ${problem?.example_input || 'N/A'}
Example Output: ${problem?.example_output || 'N/A'}

Submission:
- Language: ${language}
- Verdict: ${verdict}
- Failed tests: ${failedSummary}

Code:
\`\`\`${language}
${sourceCode}
\`\`\`

Return JSON with this exact shape:
{
  "overallScore": <0-100 integer>,
  "categories": {
    "correctness": { "score": <0-100>, "feedback": "<short string>" },
    "complexity": { "score": <0-100>, "feedback": "<short string>" },
    "logic": { "score": <0-100>, "feedback": "<short string>" },
    "efficiency": { "score": <0-100>, "feedback": "<short string>" },
    "quality": { "score": <0-100>, "feedback": "<short string>" }
  },
  "complexity": { "time": "<Big-O>", "space": "<Big-O>" },
  "suggestion": "<ONE most accurate, actionable one-line suggestion for this specific code>"
}

Rules:
- Base feedback on the actual code, verdict, and problem.
- Provide exactly one suggestion: the single most impactful fix or improvement for this submission.
- If verdict is Accepted, suggest the best optimization or edge-case hardening; if not, suggest the most likely fix for the failure.
- Keep each feedback and the suggestion to one concise sentence.
- Scores must be integers 0-100.`;
}

function clampScore(v, fallback = 50) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function coerceReview(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  const cats = data.categories || {};
  const pickCat = (key) => ({
    score: clampScore(cats[key]?.score, fallback.categories[key].score),
    feedback: String(cats[key]?.feedback || fallback.categories[key].feedback).slice(0, 300)
  });

  const suggestionRaw = data.suggestion
    ?? (Array.isArray(data.suggestions) ? data.suggestions.find(Boolean) : null)
    ?? fallback.suggestion
    ?? (Array.isArray(fallback.suggestions) ? fallback.suggestions[0] : null)
    ?? 'Review the failing cases and handle edge inputs carefully.';
  const suggestion = String(suggestionRaw).slice(0, 220);

  return {
    overallScore: clampScore(data.overallScore, fallback.overallScore),
    categories: {
      correctness: pickCat('correctness'),
      complexity: pickCat('complexity'),
      logic: pickCat('logic'),
      efficiency: pickCat('efficiency'),
      quality: pickCat('quality')
    },
    complexity: {
      time: String(data.complexity?.time || fallback.complexity.time).slice(0, 60),
      space: String(data.complexity?.space || fallback.complexity.space).slice(0, 60)
    },
    suggestion,
    suggestions: [suggestion],
    metadata: fallback.metadata
  };
}

function extractJson(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

async function generateAIReviewWithLLM({ language, sourceCode, verdict, testResults, problem, fallback }) {
  const apiKey = process.env.UNOROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = buildReviewPrompt({ language, sourceCode, verdict, testResults, problem });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(UNOROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: UNOROUTER_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a precise code review engine. Respond with JSON only.' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Unorouter ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJson(content);
    if (!parsed) throw new Error('LLM response was not valid JSON');
    return coerceReview(parsed, fallback);
  } finally {
    clearTimeout(timer);
  }
}

function analyzeCodeComplexity(code, language) {
  const lines = code.split('\n').filter(l => l.trim().length > 0);
  const totalLines = lines.length;

  let loops = 0;
  let nestedLoops = 0;
  let recursion = false;
  let hasSorting = false;
  let hasHashMap = false;
  let hasBinarySearch = false;
  let hasTwoPointers = false;
  let hasSlidingWindow = false;
  let hasDP = false;
  let hasBFS = false;
  let hasDFS = false;

  const loopPatterns = [
    /for\s*\(/g,
    /while\s*\(/g,
    /do\s*{/g,
    /for\s+.*\s+in\s+/g,
    /forEach/g,
    /map\(/g,
    /filter\(/g,
    /reduce\(/g
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    let lineLoops = 0;
    for (const pattern of loopPatterns) {
      const matches = trimmed.match(pattern);
      if (matches) lineLoops += matches.length;
    }
    loops += lineLoops;
    if (lineLoops > 1) nestedLoops++;

    if (trimmed.includes('.sort(') || trimmed.includes('Arrays.sort') || trimmed.includes('Collections.sort')) {
      hasSorting = true;
    }
    if (trimmed.includes('HashMap') || trimmed.includes('HashSet') || trimmed.includes('unordered_map') ||
        trimmed.includes('unordered_set') || trimmed.includes('{}') || trimmed.includes('new Map()') ||
        trimmed.includes('new Set()') || trimmed.includes('dict') || trimmed.includes('defaultdict')) {
      hasHashMap = true;
    }
    if (trimmed.includes('binarySearch') || trimmed.includes('bisect') ||
        (trimmed.includes('left') && trimmed.includes('right') && trimmed.includes('mid'))) {
      hasBinarySearch = true;
    }
    if (trimmed.includes('left') && trimmed.includes('right') &&
        (trimmed.includes('left++') || trimmed.includes('right--') || trimmed.includes('l++') || trimmed.includes('r--'))) {
      hasTwoPointers = true;
    }
    if (trimmed.includes('window') || (trimmed.includes('start') && trimmed.includes('end') && trimmed.includes('sum'))) {
      hasSlidingWindow = true;
    }
    if (trimmed.includes('dp[') || trimmed.includes('memo') || trimmed.includes('cache') ||
        trimmed.includes('@lru_cache') || trimmed.includes('memorize')) {
      hasDP = true;
    }
    if (trimmed.includes('queue') || trimmed.includes('deque') || trimmed.includes('Queue') ||
        (trimmed.includes('while') && trimmed.includes('queue'))) {
      hasBFS = true;
    }
    if (trimmed.includes('stack') || trimmed.includes('Stack') ||
        (trimmed.match(/function\s+\w+\s*\(/g) && trimmed.includes('return'))) {
      hasDFS = true;
    }
    if (trimmed.includes('return ') && trimmed.includes(trimmed.split('(')[0])) {
      recursion = true;
    }
  }

  let timeComplexity = 'O(n)';
  let spaceComplexity = 'O(1)';
  let reasoning = [];

  if (hasDP) {
    timeComplexity = 'O(n²) or O(n*m)';
    spaceComplexity = 'O(n²) or O(n*m)';
    reasoning.push('Dynamic programming detected');
  } else if (nestedLoops >= 2) {
    timeComplexity = 'O(n²) or higher';
    reasoning.push('Nested loops detected');
  } else if (loops >= 2 && hasSorting) {
    timeComplexity = 'O(n log n)';
    reasoning.push('Sorting + linear passes');
  } else if (hasSorting) {
    timeComplexity = 'O(n log n)';
    reasoning.push('Sorting detected');
  } else if (hasBinarySearch) {
    timeComplexity = 'O(log n)';
    reasoning.push('Binary search pattern');
  } else if (hasTwoPointers || hasSlidingWindow) {
    timeComplexity = 'O(n)';
    reasoning.push('Two-pointer/sliding window');
  } else if (hasHashMap) {
    timeComplexity = 'O(n) average';
    spaceComplexity = 'O(n)';
    reasoning.push('Hash map usage');
  } else if (hasBFS || hasDFS) {
    timeComplexity = 'O(V + E)';
    spaceComplexity = 'O(V)';
    reasoning.push('Graph traversal');
  } else if (recursion) {
    timeComplexity = 'O(2^n) or O(n) with memoization';
    spaceComplexity = 'O(n) call stack';
    reasoning.push('Recursion detected');
  } else if (loops === 1) {
    timeComplexity = 'O(n)';
    reasoning.push('Single loop');
  } else {
    timeComplexity = 'O(1) or O(n)';
    reasoning.push('No clear loops detected');
  }

  if (hasHashMap || hasDP || hasBFS || hasDFS || recursion) {
    if (spaceComplexity === 'O(1)') spaceComplexity = 'O(n)';
  }

  return {
    time: timeComplexity,
    space: spaceComplexity,
    reasoning: reasoning.join(', ') || 'Standard iterative approach',
    loops,
    nestedLoops
  };
}

function analyzeCodeQuality(code, language) {
  const lines = code.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const totalLines = nonEmptyLines.length;

  let score = 100;
  const issues = [];
  const suggestions = [];

  const hasComments = lines.some(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('/*'));
  if (!hasComments && totalLines > 10) {
    score -= 10;
    issues.push('No comments found');
    suggestions.push('Add comments to explain complex logic');
  }

  const hasDescriptiveNames = nonEmptyLines.some(l =>
    /\b(a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z)\s*[=:]/.test(l) &&
    !/\b(for|if|while|in|of)\b/.test(l)
  );
  if (hasDescriptiveNames) {
    score -= 5;
    issues.push('Single-letter variable names detected');
    suggestions.push('Use descriptive variable names');
  }

  const maxLineLength = Math.max(...nonEmptyLines.map(l => l.length));
  if (maxLineLength > 120) {
    score -= 5;
    issues.push(`Long lines detected (max ${maxLineLength} chars)`);
    suggestions.push('Break long lines for readability');
  }

  const indentConsistency = nonEmptyLines.every(l => {
    const leading = l.match(/^\s*/)[0];
    return leading.length % 2 === 0 || leading.length % 4 === 0;
  });
  if (!indentConsistency) {
    score -= 5;
    issues.push('Inconsistent indentation');
    suggestions.push('Use consistent indentation (2 or 4 spaces)');
  }

  const hasFunctions = nonEmptyLines.some(l =>
    l.includes('function ') || l.includes('def ') ||
    l.includes('void ') || l.includes('int ') && l.includes('(') && l.includes(')')
  );
  if (!hasFunctions && totalLines > 30) {
    score -= 10;
    issues.push('No function decomposition');
    suggestions.push('Break code into smaller functions');
  }

  const magicNumbers = nonEmptyLines.filter(l =>
    /\b\d{2,}\b/.test(l) && !l.includes('//') && !l.includes('#')
  ).length;
  if (magicNumbers > 3) {
    score -= 5;
    issues.push('Magic numbers detected');
    suggestions.push('Replace magic numbers with named constants');
  }

  return {
    score: Math.max(0, score),
    issues,
    suggestions
  };
}

function analyzeLogicErrors(code, language, verdict, testResults) {
  const issues = [];
  const suggestions = [];

  if (verdict === 'Wrong Answer') {
    issues.push('Output does not match expected for some test cases');
    suggestions.push('Check edge cases: empty input, single element, large values');
    suggestions.push('Verify off-by-one errors in loop boundaries');
    suggestions.push('Ensure correct handling of negative numbers if applicable');
  }

  if (verdict === 'Time Limit Exceeded') {
    issues.push('Solution exceeds time limit');
    suggestions.push('Optimize algorithm: reduce nested loops, use hash maps');
    suggestions.push('Consider O(n log n) or O(n) approach instead of O(n²)');
    suggestions.push('Avoid unnecessary computations inside loops');
  }

  if (verdict === 'Runtime Error' || verdict === 'Compilation Error') {
    issues.push('Code crashes or fails to compile');
    suggestions.push('Check for null/undefined references');
    suggestions.push('Validate array bounds before access');
    suggestions.push('Ensure all code paths return a value');
  }

  if (testResults && testResults.length > 0) {
    const failedTests = testResults.filter(t => t.status !== 'Passed');
    if (failedTests.length > 0) {
      const firstFail = failedTests[0];
      if (firstFail.isSample) {
        issues.push('Failed on provided example test case');
        suggestions.push('Verify logic matches problem statement exactly');
      }
    }
  }

  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('==') && !line.includes('===') && language === 'JavaScript') {
      issues.push('Loose equality (==) used in JavaScript');
      suggestions.push('Use strict equality (===) to avoid type coercion bugs');
      break;
    }
    if (line.includes('=') && !line.includes('==') && !line.includes('===') &&
        !line.includes('+=') && !line.includes('-=') && !line.includes('*=') &&
        line.match(/if\s*\([^)]*=/)) {
      issues.push('Possible assignment in condition');
      suggestions.push('Check if condition uses assignment (=) instead of comparison (==)');
      break;
    }
  }

  return { issues, suggestions };
}

function calculateOverallScore(verdict, complexity, quality, logic) {
  let baseScore = 0;

  switch (verdict) {
    case 'Accepted':
    case 'Success':
      baseScore = 85;
      break;
    case 'Wrong Answer':
      baseScore = 45;
      break;
    case 'Time Limit Exceeded':
      baseScore = 35;
      break;
    case 'Runtime Error':
    case 'Compilation Error':
      baseScore = 25;
      break;
    default:
      baseScore = 50;
  }

  const complexityBonus = quality.score * 0.15;
  const qualityBonus = quality.score * 0.15;
  const logicPenalty = logic.issues.length * 5;

  return Math.min(100, Math.max(0, Math.round(baseScore + complexityBonus + qualityBonus - logicPenalty)));
}

export async function generateAIReview({ language, sourceCode, problemSlug, verdict, testResults, userId }) {
  const normalizedVerdict = normalizeVerdict(verdict);
  const complexity = analyzeCodeComplexity(sourceCode, language);
  const quality = analyzeCodeQuality(sourceCode, language);
  const logic = analyzeLogicErrors(sourceCode, language, normalizedVerdict, testResults);
  const overallScore = calculateOverallScore(normalizedVerdict, complexity, quality, logic);

  const categories = {
    correctness: {
      score: normalizedVerdict === 'Accepted' ? 95 :
             normalizedVerdict === 'Wrong Answer' ? 40 :
             normalizedVerdict === 'Time Limit Exceeded' ? 60 : 30,
      feedback: normalizedVerdict === 'Accepted'
        ? 'All test cases passed successfully'
        : normalizedVerdict === 'Wrong Answer'
          ? 'Output mismatches detected on hidden test cases'
          : normalizedVerdict === 'Time Limit Exceeded'
            ? 'Correct logic but too slow for constraints'
            : 'Code crashes or fails to compile'
    },
    complexity: {
      score: complexity.time.includes('O(1)') || complexity.time.includes('O(log n)') ? 90 :
             complexity.time.includes('O(n)') && !complexity.time.includes('²') ? 80 :
             complexity.time.includes('O(n log n)') ? 75 :
             complexity.time.includes('O(n²)') ? 50 : 40,
      feedback: `Time: ${complexity.time}, Space: ${complexity.space}. ${complexity.reasoning}`
    },
    logic: {
      score: logic.issues.length === 0 ? 90 : Math.max(30, 70 - logic.issues.length * 10),
      feedback: logic.issues.length > 0 ? logic.issues.join('; ') : 'No obvious logical errors detected'
    },
    efficiency: {
      score: normalizedVerdict === 'Time Limit Exceeded' ? 30 :
             normalizedVerdict === 'Accepted' && complexity.time.includes('O(n²)') ? 60 :
             normalizedVerdict === 'Accepted' ? 85 : 50,
      feedback: normalizedVerdict === 'Time Limit Exceeded'
        ? 'Algorithm needs optimization for given constraints'
        : normalizedVerdict === 'Accepted' && complexity.time.includes('O(n²)')
          ? 'Works but could be optimized for larger inputs'
          : 'Efficient approach for problem constraints'
    },
    quality: {
      score: quality.score,
      feedback: quality.issues.length > 0 ? quality.issues.join('; ') : 'Clean, well-structured code'
    }
  };

  const verdictHints = normalizedVerdict === 'Time Limit Exceeded'
    ? ['Reduce time complexity by replacing nested scans with a hash map or a two-pointer approach.']
    : normalizedVerdict === 'Wrong Answer'
      ? ['Check edge cases and input/output formatting for cases where your logic diverges from the expected result.']
      : normalizedVerdict === 'Runtime Error' || normalizedVerdict === 'Compilation Error'
        ? ['Fix the first runtime/compile error and validate bounds or null values before access.']
        : [];

  const prioritized = [
    ...logic.suggestions,
    ...verdictHints,
    ...quality.suggestions,
    normalizedVerdict === 'Accepted'
      ? 'Harden edge cases (empty input, boundaries, large values) to keep this solution robust.'
      : 'Trace a failing input step-by-step to pinpoint where the output diverges.'
  ].filter(Boolean);

  const topSuggestion = [...new Set(prioritized)][0];

  const fallback = {
    overallScore,
    categories,
    complexity: {
      time: complexity.time,
      space: complexity.space
    },
    suggestion: topSuggestion,
    suggestions: [topSuggestion],
    metadata: {
      language,
      linesOfCode: sourceCode.split('\n').filter(l => l.trim()).length,
      analyzedAt: new Date().toISOString(),
      provider: 'heuristic'
    }
  };

  try {
    const problem = await fetchProblemContext(problemSlug);
    const llmReview = await generateAIReviewWithLLM({
      language,
      sourceCode,
      verdict: normalizedVerdict,
      testResults,
      problem,
      fallback
    });
    if (llmReview) {
      return {
        ...llmReview,
        metadata: {
          ...fallback.metadata,
          provider: 'unorouter',
          model: UNOROUTER_MODEL
        }
      };
    }
  } catch (err) {
    console.error('[AI Review] Unorouter failed, falling back to heuristic:', err.message);
  }

  return fallback;
}