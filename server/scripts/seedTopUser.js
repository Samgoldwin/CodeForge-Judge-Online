import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 5
});

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  const conn = await pool.getConnection();
  try {
    const [problems] = await conn.query('SELECT id, slug, difficulty FROM problems ORDER BY id');
    if (problems.length < 20) throw new Error('Not enough problems seeded');

    // Pick 26 distinct problems: most of them, include the hard one
    const easy = problems.filter(p => p.difficulty === 'Easy');
    const medium = problems.filter(p => p.difficulty === 'Medium');
    const hard = problems.filter(p => p.difficulty === 'Hard');
    const picked = [
      ...hard,
      ...medium,
      ...easy.slice(0, 26 - hard.length - medium.length)
    ];
    // ensure unique and top count (more than others will have)
    const solvedProblems = picked.slice(0, 28);

    const username = 'speedster_pro';
    const email = 'speedster_pro@codetest.dev';
    const name = 'Speedster Pro';
    const password = 'Speed@123';
    const hash = bcrypt.hashSync(password, 10);

    await conn.beginTransaction();

    // clean previous seed for this user
    const [existing] = await conn.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) {
      const uid = existing[0].id;
      await conn.execute('DELETE FROM submissions WHERE user_id = ?', [uid]);
      await conn.execute('DELETE FROM users WHERE id = ?', [uid]);
    }

    const [res] = await conn.execute(
      'INSERT INTO users (name, username, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 90 DAY))',
      [name, username, email, hash, false]
    );
    const userId = res.insertId;

    const languages = ['JavaScript', 'Python', 'C++', 'Java'];
    const codeStub = (lang, slug) => {
      if (lang === 'Python') return `# ${slug}\nimport sys\n\ndef solve():\n    data = sys.stdin.read().strip()\n    # solution\n    print(data)\n\nif __name__ == '__main__':\n    solve()\n`;
      if (lang === 'C++') return `// ${slug}\n#include <bits/stdc++.h>\nusing namespace std;\nint main(){ios::sync_with_stdio(false);cin.tie(nullptr);\n// solution\nreturn 0;}\n`;
      if (lang === 'Java') return `// ${slug}\nimport java.io.*;\nimport java.util.*;\npublic class Main{public static void main(String[] args)throws Exception{\n// solution\n}}\n`;
      return `// ${slug}\nconst fs=require('fs');\nconst input=fs.readFileSync(0,'utf8').trim();\n// solution\nconsole.log(input);\n`;
    };

    let inserted = 0;
    for (let i = 0; i < solvedProblems.length; i++) {
      const p = solvedProblems[i];
      const lang = rand(languages);
      // spread solves across different times in last 60 days, varied hours
      const daysAgo = randInt(1, 60);
      const hour = randInt(0, 23);
      const minute = randInt(0, 59);
      const second = randInt(0, 59);
      // fast runtime, different per submission
      const runtime = randInt(12, 180);
      const memory = randInt(8, 64);
      const passed = randInt(5, 20);
      const source = codeStub(lang, p.slug);

      await conn.execute(
        `INSERT INTO submissions
          (user_id, problem_id, contest_id, language, source_code, status, verdict, runtime_ms, memory_mb, passed_test_cases, total_test_cases, error_detail, created_at)
         VALUES (?, ?, NULL, ?, ?, 'completed', 'Accepted', ?, ?, ?, ?, NULL,
          DATE_SUB(DATE_SUB(NOW(), INTERVAL ? DAY), INTERVAL (?*3600 + ?*60 + ?) SECOND))`,
        [userId, p.id, lang, source, runtime, memory, passed, passed, daysAgo, hour, minute, second]
      );
      inserted++;

      // occasional earlier failed attempt on some problems to look realistic
      if (i % 4 === 0) {
        const fDays = daysAgo + randInt(0, 3);
        const fVerdict = rand(['Wrong Answer', 'Time Limit Exceeded', 'Runtime Error']);
        const fRuntime = fVerdict === 'Time Limit Exceeded' ? randInt(2000, 3000) : randInt(20, 250);
        await conn.execute(
          `INSERT INTO submissions
            (user_id, problem_id, contest_id, language, source_code, status, verdict, runtime_ms, memory_mb, passed_test_cases, total_test_cases, error_detail, created_at)
           VALUES (?, ?, NULL, ?, ?, 'completed', ?, ?, ?, ?, ?, ?,
            DATE_SUB(DATE_SUB(NOW(), INTERVAL ? DAY), INTERVAL (?*3600 + ?*60 + ?) SECOND))`,
          [userId, p.id, lang, source, fVerdict, fRuntime, randInt(10, 70), randInt(0, passed - 1), passed,
           fVerdict === 'Wrong Answer' ? 'Output mismatch on hidden test.' : fVerdict === 'Time Limit Exceeded' ? 'Exceeded time limit.' : 'Runtime exception.',
           fDays, randInt(0,23), randInt(0,59), randInt(0,59)]
        );
      }
    }

    await conn.commit();

    const [rankRows] = await conn.query(
      `SELECT u.username, COUNT(DISTINCT CASE WHEN s.verdict='Accepted' THEN s.problem_id END) solved,
              COALESCE(SUM(CASE WHEN s.verdict='Accepted' THEN 100 ELSE 0 END),0) score
       FROM users u LEFT JOIN submissions s ON u.id=s.user_id
       GROUP BY u.id ORDER BY score DESC, solved DESC LIMIT 10`
    );

    console.log(JSON.stringify({
      ok: true,
      user: { id: userId, username, email, password },
      acceptedSubmissions: inserted,
      distinctProblemsSolved: solvedProblems.length,
      leaderboardTop: rankRows
    }, null, 2));
  } catch (e) {
    await conn.rollback();
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
