import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit3, Save, X, Upload, Code2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.is_admin) navigate('/');
  }, [user, navigate]);

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    slug: '', title: '', difficulty: 'Easy', tags: '', description: '',
    input_format: '', output_format: '', example_input: '', example_output: '', solved_count: 0,
    test_cases: [],
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/problems');
      setProblems(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load problems.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const resetForm = () => {
    setForm({
      slug: '', title: '', difficulty: 'Easy', tags: '', description: '',
      input_format: '', output_format: '', example_input: '', example_output: '', solved_count: 0,
      test_cases: [],
    });
    setEditing(null);
    setMessage('');
    setError('');
  };

  const openCreate = () => { resetForm(); };

  const openEdit = (p) => {
    setForm({
      slug: p.slug, title: p.title, difficulty: p.difficulty, tags: p.tags, description: p.description,
      input_format: p.input_format || '', output_format: p.output_format || '',
      example_input: p.example_input || '', example_output: p.example_output || '',
      solved_count: p.solved_count || 0,
      test_cases: (p.test_cases || []).map((tc) => ({ input_data: tc.input_data, expected_output: tc.expected_output, is_sample: tc.is_sample, id: tc.id })),
    });
    setEditing(p.id);
  };

  const updateTestCases = (index, field, value) => {
    const next = [...form.test_cases];
    next[index][field] = value;
    setForm({ ...form, test_cases: next });
  };

  const addTestCase = () => {
    setForm({ ...form, test_cases: [...form.test_cases, { input_data: '', expected_output: '', is_sample: false }] });
  };

  const removeTestCase = (index) => {
    setForm({ ...form, test_cases: form.test_cases.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      if (editing) {
        await api.put(`/admin/problems/${editing}`, form);
        setMessage('Problem updated.');
      } else {
        await api.post('/admin/problems', form);
        setMessage('Problem created.');
      }
      fetchProblems();
      resetForm();
    } catch (e) {
      setError(e.response?.data?.message || 'Operation failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this problem?')) return;
    try {
      await api.delete(`/admin/problems/${id}`);
      fetchProblems();
      setMessage('Problem deleted.');
    } catch (e) {
      setError(e.response?.data?.message || 'Delete failed.');
    }
  };

  const handleDeleteTestCase = async (tcId) => {
    if (!window.confirm('Delete this test case?')) return;
    try {
      await api.delete(`/admin/test-cases/${tcId}`);
      fetchProblems();
      setMessage('Test case deleted.');
    } catch (e) {
      setError(e.response?.data?.message || 'Delete failed.');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      let data;
      try { data = JSON.parse(text); } catch { data = JSON.parse(text); }
      const problemsArr = Array.isArray(data) ? data : data.problems || [];
      for (const p of problemsArr) {
        try { await api.post('/admin/problems', p); } catch (err) {}
      }
      setMessage(`Imported ${problemsArr.length} problems.`);
      fetchProblems();
    } catch (err) {
      setError('Import failed. Ensure valid JSON array of problem objects.');
    }
  };

  return (
    <section className="content page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <p className="eyebrow">ADMIN PANEL</p>
          <h1>Problem Management</h1>
          <p className="muted">Add, edit, and manage problems and test cases.</p>
        </div>
        <button className="button" onClick={openCreate}><Plus size={16} /> Add Problem</button>
      </div>

      {message && <p className="muted" style={{ color: '#22c55e', marginBottom: 10 }}>{message}</p>}
      {error && <p className="error" style={{ marginBottom: 10 }}>{error}</p>}

      {loading ? (
        <p className="muted">Loading problems...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
                <th style={{ padding: 10, fontWeight: 600 }}>#</th>
                <th style={{ padding: 10, fontWeight: 600 }}>Slug</th>
                <th style={{ padding: 10, fontWeight: 600 }}>Title</th>
                <th style={{ padding: 10, fontWeight: 600 }}>Difficulty</th>
                <th style={{ padding: 10, fontWeight: 600 }}>Tags</th>
                <th style={{ padding: 10, fontWeight: 600 }}>Test Cases</th>
                <th style={{ padding: 10, fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: 10 }}>{i + 1}</td>
                  <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 13 }}>{p.slug}</td>
                  <td style={{ padding: 10 }}>{p.title}</td>
                  <td style={{ padding: 10 }}><span className={`difficulty ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span></td>
                  <td style={{ padding: 10, fontSize: 13 }}>{p.tags}</td>
                  <td style={{ padding: 10 }}>{(p.test_cases || []).length}</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>
                    <button className="linkbutton" onClick={() => openEdit(p)}><Edit3 size={14} /></button>
                    <button className="linkbutton" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 24, border: '1px solid #333', padding: 16, borderRadius: 8, background: '#1a1a1a' }}>
        <h3>{editing ? 'Edit Problem' : 'Create Problem'}</h3>
        <p className="muted" style={{ marginBottom: 12 }}>{editing ? `Editing ID: ${editing}` : 'Fill the form to add a new problem.'}</p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Slug <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Difficulty <span style={{ color: '#ef4444' }}>*</span></label>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="input">
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Tags (comma separated) <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input" />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={3} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Input Format</label>
            <input value={form.input_format} onChange={(e) => setForm({ ...form, input_format: e.target.value })} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Output Format</label>
            <input value={form.output_format} onChange={(e) => setForm({ ...form, output_format: e.target.value })} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Example Input</label>
            <input value={form.example_input} onChange={(e) => setForm({ ...form, example_input: e.target.value })} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Example Output</label>
            <input value={form.example_output} onChange={(e) => setForm({ ...form, example_output: e.target.value })} className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#aaa' }}>Solved Count</label>
            <input type="number" value={form.solved_count} onChange={(e) => setForm({ ...form, solved_count: Number(e.target.value || 0) })} className="input" />
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 8, color: '#aaa' }}>Test Cases</label>
            <div style={{ border: '1px solid #333', padding: 10, borderRadius: 6, background: '#141414' }}>
              {form.test_cases.map((tc, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #2a2a2a' }}>
                  <input placeholder="Input data" value={tc.input_data} onChange={(e) => updateTestCases(i, 'input_data', e.target.value)} className="input" />
                  <input placeholder="Expected output" value={tc.expected_output} onChange={(e) => updateTestCases(i, 'expected_output', e.target.value)} className="input" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: 0, color: '#aaa' }}>
                    <input type="checkbox" checked={tc.is_sample} onChange={(e) => updateTestCases(i, 'is_sample', e.target.checked)} /> Sample
                  </label>
                  <button type="button" onClick={() => removeTestCase(i)} style={{ color: '#ef4444', background: 'none', border: 0, cursor: 'pointer' }}><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={addTestCase} style={{ marginTop: 6, color: '#22c55e', background: 'none', border: '1px solid #22c55e', padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>+ Add Test Case</button>
            </div>
          </div>

          <div style={{ gridColumn: 'span 3', display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="button"><Save size={16} /> {editing ? 'Save' : 'Create'}</button>
            <button type="button" onClick={resetForm} className="ghost"><X size={16} /> Cancel</button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: 24, border: '1px solid #333', padding: 16, borderRadius: 8, background: '#1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Upload size={18} /> <h3 style={{ margin: 0 }}>Bulk Import (JSON)</h3>
        </div>
        <p className="muted" style={{ marginBottom: 10 }}>Import a JSON array of problem objects (from a public LeetCode dataset). Each object needs slug, title, difficulty, tags, description, and optionally test_cases.</p>
         <input type="file" accept=".json" onChange={handleImport} className="input" style={{ display: 'block', padding: 8, width: '100%' }} />
      </div>
    </section>
  );
}
