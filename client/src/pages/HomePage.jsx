import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, Trophy, Users, CheckCircle2, ChevronRight, Terminal, BarChart2, Target, Zap, TrendingUp } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const difficultyClass = (d) => (d ? d.toLowerCase() : 'easy');

export function HomePage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    api.get('/problems').then((r) => setItems(r.data)).catch(() => {});
    api.get('/platform-stats').then((r) => setPlatformStats(r.data)).catch(() => setPlatformStats(null));
  }, []);

  useEffect(() => {
    if (!user) { setAnalytics(null); return; }
    let active = true;
    (async () => {
      try {
        const [profileRes, submissionsRes, analyticsRes] = await Promise.all([
          api.get('/users/me/profile'),
          api.get('/submissions/me'),
          api.get('/analytics/dashboard?range=30d').catch(() => ({ data: null }))
        ]);
        if (!active) return;
        const submissions = submissionsRes.data || [];
        const accepted = submissions.filter((s) => s.verdict === 'Accepted');
        const acceptanceRate = submissions.length ? Math.round((accepted.length / submissions.length) * 100) : 0;
        const avgRuntime = accepted.length ? Math.round(accepted.reduce((sum, s) => sum + (s.runtime_ms || 0), 0) / accepted.length) : 0;
        const solved = profileRes.data?.stats?.solved?.Total || 0;
        const score = profileRes.data?.stats?.score || 0;
        setAnalytics({
          acceptanceRate,
          avgRuntime,
          solved,
          score,
          submissions: submissions.length,
          streak: analyticsRes.data?.streak ?? null,
        });
      } catch (e) {
        if (active) setAnalytics(null);
      }
    })();
    return () => { active = false; };
  }, [user]);

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">PRACTICE. COMPETE. IMPROVE.</p>
          <h1>Build your problem-solving edge.</h1>
          <p className="muted">
            Solve curated algorithmic challenges, test code live in an isolated secure sandbox, and climb the leaderboard.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/problems">
              Start solving <ChevronRight size={18} />
            </Link>
            <Link className="ghost" to="/leaderboard">
              View leaderboard
            </Link>
          </div>
        </div>
        <div className="stat-panel">
          <Terminal size={29} />
          <strong>{items.length || 4}</strong>
          <span>curated challenges</span>
          <div className="bar"><i /></div>
          <small>Your next accepted solution starts here.</small>
        </div>
      </section>

      <section className="metrics">
        <div><b>{platformStats?.problems ?? items.length}</b><span>Problems</span></div>
        <div><b>{platformStats?.users ?? '—'}</b><span>Registered Coders</span></div>
        <div><b>{platformStats?.submissions ?? '—'}</b><span>Submissions Judged</span></div>
        <div><b>{platformStats?.contests ?? '—'}</b><span>Contests Hosted</span></div>
      </section>

      <section className="why">
        <h2>Why CodeTest</h2>
        <div className="why-grid">
          <article>
            <Code2 />
            <h3>Monaco IDE Experience</h3>
            <p>Write solutions with full VS Code syntax highlighting, autocomplete, and indentation.</p>
          </article>
          <article>
            <Trophy />
            <h3>Contests & Rankings</h3>
            <p>Compete in timed algorithmic contests and track real-time global ratings.</p>
          </article>
          <article>
            <Users />
            <h3>Community Discussions</h3>
            <p>Share optimal $O(n)$ approaches, hints, and learn from other engineers.</p>
          </article>
          <article>
            <CheckCircle2 />
            <h3>Async Sandbox Judge</h3>
            <p>Non-blocking worker queue with live Server-Sent Events progress tracking.</p>
          </article>
        </div>
      </section>

      <section className="content home-analytics">
        <div className="section-title">
          <div>
            <p className="eyebrow">PERFORMANCE ANALYTICS</p>
            <h2>{user ? 'Your progress at a glance' : 'Track your coding analytics'}</h2>
          </div>
          <Link className="ghost" to={user ? '/performance' : '/login'}>
            {user ? 'View full dashboard' : 'Log in to track'} <ChevronRight size={16} />
          </Link>
        </div>
        {user && analytics ? (
          <div className="home-analytics-grid">
            <article className="home-analytic-card"><BarChart2 size={18} /><div><b>{analytics.solved}</b><span>Problems solved</span></div></article>
            <article className="home-analytic-card"><Target size={18} /><div><b>{analytics.acceptanceRate}%</b><span>Acceptance rate</span></div></article>
            <article className="home-analytic-card"><Zap size={18} /><div><b>{analytics.avgRuntime ? `${analytics.avgRuntime} ms` : '—'}</b><span>Avg runtime</span></div></article>
            <article className="home-analytic-card"><TrendingUp size={18} /><div><b>{analytics.score}</b><span>Score</span></div></article>
          </div>
        ) : (
          <div className="home-analytics-cta muted">
            <p>{user ? 'Solve problems to unlock personalized insights, trends, and topic strengths.' : 'Sign in to see acceptance rate, runtime trends, topic strengths, and your progress over time.'}</p>
            <Link className="button" to={user ? '/problems' : '/register'}>{user ? 'Start solving' : 'Create account'} <ChevronRight size={16} /></Link>
          </div>
        )}
      </section>

      <section id="list" className="content">
        <div className="section-title">
          <div>
            <p className="eyebrow">PROBLEM LIBRARY</p>
            <h2>Choose a challenge</h2>
          </div>
          <span className="muted">{items.length} problems</span>
        </div>
        <div className="problem-list">
          {items.map((p) => (
            <Link to={`/problems/${p.slug}`} className="problem-card" key={p.id}>
              <div className={`difficulty ${difficultyClass(p.difficulty)}`}>{p.difficulty}</div>
              <div className="problem-main">
                <h3>{p.title}</h3>
                <p>{p.tags}</p>
              </div>
              <div className="solved">
                <CheckCircle2 size={16} />
                {p.solved_count} solved
              </div>
              <ChevronRight className="arrow" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

