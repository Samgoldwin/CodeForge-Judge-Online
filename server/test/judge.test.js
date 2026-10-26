import assert from 'node:assert/strict';
import test from 'node:test';
import { judgeSubmission, runCustomCode } from '../src/judge.js';

const originalEnv = { ...process.env };
const base64 = (value) => Buffer.from(value, 'utf8').toString('base64');

function restoreEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

function mockJudgeFetch(responseForToken) {
  const originalFetch = global.fetch;
  let created = 0;
  global.fetch = async (url, options = {}) => {
    if (options.method === 'POST' && String(url).includes('/submissions')) {
      created += 1;
      return new Response(JSON.stringify({ token: `submission-${created}` }), { status: 201 });
    }
    if (String(url).includes('/submissions/')) {
      return new Response(JSON.stringify(responseForToken(String(url))), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };
  return () => { global.fetch = originalFetch; };
}

function configureJudge(url) {
  process.env.NODE_ENV = 'test';
  process.env.JUDGE_MODE = 'judge0';
  process.env.JUDGE0_BASE_URL = url;
  process.env.JUDGE0_LANGUAGE_JAVASCRIPT = '63';
  process.env.JUDGE0_LANGUAGE_PYTHON = '71';
  process.env.JUDGE0_LANGUAGE_CPP = '54';
  process.env.JUDGE0_LANGUAGE_JAVA = '62';
  process.env.JUDGE_POLL_INTERVAL_MS = '1';
  process.env.JUDGE_POLL_TIMEOUT_MS = '1000';
}

test('uses the remote judge for a custom run and preserves the response contract', { concurrency: false }, async (t) => {
  const restoreFetch = mockJudgeFetch(() => ({
    stdout: base64('hello\n'), stderr: null, compile_output: null, message: null,
    time: '0.012', memory: 2048, status: { id: 3, description: 'Accepted' }
  }));
  t.after(() => { restoreFetch(); restoreEnvironment(); });
  configureJudge('https://judge.example.test');

  const result = await runCustomCode('JavaScript', 'console.log("hello")', '');
  assert.deepEqual(result, {
    stdout: 'hello\n', stderr: '', code: 0, timedOut: false, outputExceeded: false,
    compileFailed: false, runtimeMs: 12, memoryMb: 2
  });
});

test('keeps whitespace-normalized judging and maps compiler failures', { concurrency: false }, async (t) => {
  const restoreFetch = mockJudgeFetch((url) => url.includes('submission-1')
    ? { stdout: base64('answer\n'), stderr: null, compile_output: null, message: null, time: '0.001', memory: 1024, status: { id: 3, description: 'Accepted' } }
    : { stdout: null, stderr: null, compile_output: base64('syntax error'), message: null, time: null, memory: null, status: { id: 6, description: 'Compilation Error' } });
  t.after(() => { restoreFetch(); restoreEnvironment(); });
  configureJudge('https://judge.example.test');

  const accepted = await judgeSubmission('Python', 'print("answer")', [{ input_data: '', expected_output: 'answer', is_sample: true }]);
  assert.equal(accepted.verdict, 'Accepted');
  const compileError = await judgeSubmission('Python', 'not python', [{ input_data: '', expected_output: 'answer' }]);
  assert.equal(compileError.verdict, 'Compilation Error');
  assert.equal(compileError.detail, 'syntax error');
});

test('refuses to execute locally in production', { concurrency: false }, async (t) => {
  t.after(restoreEnvironment);
  process.env.NODE_ENV = 'production';
  process.env.JUDGE_MODE = 'local';
  await assert.rejects(() => runCustomCode('JavaScript', 'console.log(1)', ''), { code: 'JUDGE_CONFIGURATION_ERROR' });
});

test('defaults to the remote judge instead of falling back to local execution', { concurrency: false }, async (t) => {
  t.after(restoreEnvironment);
  process.env.NODE_ENV = 'production';
  delete process.env.JUDGE_MODE;
  delete process.env.JUDGE0_BASE_URL;
  await assert.rejects(() => runCustomCode('JavaScript', 'console.log(1)', ''), { code: 'JUDGE_UNAVAILABLE' });
});
