import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, Zap, AlertCircle, Brain, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const REVIEW_CATEGORIES = [
  { key: 'correctness', label: 'Correctness', icon: CheckCircle2 },
  { key: 'complexity', label: 'Complexity', icon: Zap },
  { key: 'logic', label: 'Logic & Edge Cases', icon: AlertCircle },
  { key: 'efficiency', label: 'Efficiency', icon: Brain },
  { key: 'quality', label: 'Quality', icon: Sparkles }
];

function getScoreColor(score) {
  if (score >= 80) return '#7cdb9e';
  if (score >= 60) return '#ffd073';
  if (score >= 40) return '#ffa51d';
  return '#f08e85';
}

function AIReviewField({ review, isAnalyzing, onAnalyze, verdict }) {
  const [expanded, setExpanded] = useState(false);
  const suggestion = review?.suggestion || review?.suggestions?.[0] || '';

  const overallScore = review?.overallScore ?? null;
  const scoreColor = overallScore != null ? getScoreColor(overallScore) : 'var(--muted)';

  const statusText = isAnalyzing
    ? 'Analyzing…'
    : review
      ? (suggestion || 'Analysis complete')
      : 'Get AI feedback on your solution';

  return (
    <div className="ai-review-field">
      <div
        className={`ai-review-main ${expanded ? 'expanded' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
        onClick={() => { if (!isAnalyzing && review) setExpanded(e => !e); if (!isAnalyzing && !review) onAnalyze?.(); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          if (isAnalyzing) return;
          if (review) setExpanded(x => !x);
          else onAnalyze?.();
        }}
      >
        <div className="ai-review-bar">
          <span className="ai-review-icon-wrap" aria-hidden="true">
            {isAnalyzing ? <Loader2 size={15} className="spinning" /> : <Sparkles size={15} />}
          </span>
          <span className="ai-review-label">AI Review</span>
          <span className="ai-review-text" title={statusText}>{statusText}</span>
          <span className="ai-review-meta">
            {overallScore != null && (
              <span className="ai-score" style={{ color: scoreColor }}>{overallScore}</span>
            )}
            {!review && !isAnalyzing && (
              <span className="ai-action">Analyze</span>
            )}
            {review && (expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </span>
        </div>

        <div className="ai-review-progress" aria-hidden="true">
          <div
            className={`ai-review-progress-fill ${isAnalyzing ? 'indeterminate' : ''}`}
            style={!isAnalyzing && overallScore != null ? { width: `${overallScore}%`, background: scoreColor } : undefined}
          />
        </div>

        {expanded && review && (
          <div className="ai-review-expanded" onClick={(e) => e.stopPropagation()}>
            <div className="ai-review-categories">
              {REVIEW_CATEGORIES.map(cat => {
                const catData = review.categories?.[cat.key] || { score: 0, feedback: '—' };
                const color = getScoreColor(catData.score);
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className="ai-review-category">
                    <div className="category-row">
                      <Icon size={13} className="category-icon" />
                      <span className="category-name">{cat.label}</span>
                      <span className="category-score" style={{ color }}>{catData.score}</span>
                    </div>
                    <div className="category-bar"><div className="category-fill" style={{ width: `${catData.score}%`, background: color }} /></div>
                    <p className="category-feedback">{catData.feedback}</p>
                  </div>
                );
              })}
            </div>

            {suggestion && (
              <div className="ai-review-suggestions">
                <div className="ai-section-title">Suggestion</div>
                <p className="ai-single-suggestion">{suggestion}</p>
              </div>
            )}

            {review.complexity && (
              <div className="ai-review-complexity">
                <div className="ai-section-title">Complexity</div>
                <div className="complexity-grid">
                  <div className="complexity-item"><span>Time</span><strong>{review.complexity.time}</strong></div>
                  <div className="complexity-item"><span>Space</span><strong>{review.complexity.space}</strong></div>
                </div>
              </div>
            )}

            <button
              className="ai-review-reanalyze"
              onClick={(e) => { e.stopPropagation(); onAnalyze?.(); }}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 size={13} className="spinning" /> : <Sparkles size={13} />}
              {isAnalyzing ? 'Analyzing…' : 'Re-analyze'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIReviewPanel({
  language,
  code,
  problemSlug,
  verdict,
  testResults,
  onAnalyze,
  isAnalyzing,
  review
}) {
  return (
    <AIReviewField
      review={review}
      isAnalyzing={isAnalyzing}
      onAnalyze={onAnalyze}
      verdict={verdict}
    />
  );
}