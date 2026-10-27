import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PROBLEMS from './problems.seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });


export const pool = mysql.createPool(
  process.env.MYSQL_URL || process.env.DATABASE_URL || {
    host: process.env.MYSQLHOST || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD ?? process.env.DB_PASSWORD ?? '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'CodeTest',
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 15000,
    enableKeepAlive: true
  }
);



export async function initDatabase() {
  try {
    // 1. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(40) NOT NULL UNIQUE,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create problems table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(180) NOT NULL,
        difficulty ENUM('Easy','Medium','Hard') NOT NULL,
        tags VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        input_format TEXT,
        output_format TEXT,
        example_input TEXT,
        example_output TEXT,
        solved_count INT UNSIGNED DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default problems if empty
    const [probCount] = await pool.query('SELECT COUNT(*) as count FROM problems');
    if (probCount[0].count === 0) {
      console.log('[Database] Seeding default problems...');
      for (const p of PROBLEMS) {
        await pool.execute(
          'INSERT INTO problems (slug, title, difficulty, tags, description, input_format, output_format, example_input, example_output, solved_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [p.slug, p.title, p.difficulty, p.tags, p.description, p.input_format || '', p.output_format || '', p.example_input || '', p.example_output || '', Number(p.solved_count || 0)]
        );
      }
    }

    // 3. Create test_cases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        problem_id INT UNSIGNED NOT NULL,
        input_data TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        is_sample BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      )
    `);

    // Ensure is_sample column exists in test_cases
    const [tcCols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_cases' AND COLUMN_NAME = 'is_sample'"
    );
    if (tcCols.length === 0) {
      await pool.query('ALTER TABLE test_cases ADD COLUMN is_sample BOOLEAN DEFAULT FALSE');
    }

    // Seed test cases if empty
    const [existingTests] = await pool.query('SELECT COUNT(*) as count FROM test_cases');
    if (existingTests[0].count === 0) {
      console.log('[Database] Auto-seeding test cases for default problems...');
      const [problems] = await pool.query('SELECT id, slug FROM problems');
      const problemBySlug = new Map(problems.map((p) => [p.slug, p.id]));
      for (const p of PROBLEMS) {
        const problemId = problemBySlug.get(p.slug);
        if (!problemId) continue;
        for (const tc of (p.test_cases || [])) {
          await pool.execute(
            'INSERT INTO test_cases (problem_id, input_data, expected_output, is_sample) VALUES (?, ?, ?, ?)',
            [problemId, tc.input_data, tc.expected_output, Boolean(tc.is_sample)]
          );
        }
      }
    }

    // 4. Create contests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contests (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        starts_at DATETIME NOT NULL,
        duration_minutes INT UNSIGNED NOT NULL,
        status ENUM('Upcoming','Live','Finished') DEFAULT 'Upcoming'
      )
    `);

    // Keep existing databases compatible with the is_admin column.
    const [adminColumn] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'"
    );
    if (adminColumn.length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
    }

    // Seed default contests if empty
    const [contestCount] = await pool.query('SELECT COUNT(*) as count FROM contests');
    if (contestCount[0].count === 0) {
      await pool.query(`
        INSERT INTO contests (id, title, starts_at, duration_minutes, status) VALUES
        (1, 'Weekly Challenge #1', DATE_ADD(NOW(), INTERVAL 2 DAY), 120, 'Upcoming'),
        (2, 'Algorithms Sprint 2026', DATE_SUB(NOW(), INTERVAL 1 HOUR), 90, 'Live'),
        (3, 'Beginner Byte Battle', DATE_SUB(NOW(), INTERVAL 5 DAY), 60, 'Finished');
      `);
    }

    // 5. Create submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        problem_id INT UNSIGNED NOT NULL,
        contest_id INT UNSIGNED NULL,
        language VARCHAR(30) NOT NULL,
        source_code MEDIUMTEXT NOT NULL,
        status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
        verdict VARCHAR(30) NOT NULL DEFAULT 'Queued',
        runtime_ms INT UNSIGNED NULL,
        memory_mb INT UNSIGNED NULL,
        passed_test_cases INT UNSIGNED DEFAULT 0,
        total_test_cases INT UNSIGNED DEFAULT 0,
        error_detail TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      )
    `);

    // Keep older databases compatible with the submission metrics shown by the UI.
    const [submissionMemoryColumn] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'memory_mb'"
    );
    if (submissionMemoryColumn.length === 0) {
      await pool.query('ALTER TABLE submissions ADD COLUMN memory_mb INT UNSIGNED NULL AFTER runtime_ms');
    }

    // 6. Create contest_problems table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contest_problems (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        contest_id INT UNSIGNED NOT NULL,
        problem_id INT UNSIGNED NOT NULL,
        letter_order VARCHAR(4) NOT NULL DEFAULT 'A',
        points INT UNSIGNED NOT NULL DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_contest_problem (contest_id, problem_id),
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      )
    `);

    // Seed contest problems if empty
    const [existingCP] = await pool.query('SELECT COUNT(*) as count FROM contest_problems');
    if (existingCP[0].count === 0) {
      await pool.query(`
        INSERT INTO contest_problems (contest_id, problem_id, letter_order, points) VALUES
        (1, 1, 'A', 100),
        (1, 2, 'B', 200),
        (1, 3, 'C', 300),
        (2, 2, 'A', 100),
        (2, 4, 'B', 300)
      `).catch(() => {});
    }

    // 7. Create contest_registrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contest_registrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        contest_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_contest_registration (contest_id, user_id),
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 8. Create discussions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS discussions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'Solutions',
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        likes INT UNSIGNED DEFAULT 0,
        replies_count INT UNSIGNED DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Ensure demo user exists for seeding discussions
    const [existingUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count === 0) {
      await pool.query(`
        INSERT INTO users (name, username, email, password_hash, is_admin) VALUES
        ('CodeTest Admin', 'admin', 'admin@CodeTest.dev', '$2a$10$wO082w1v2gUf7UomJk582OB2B1B6F64gK.aP9mR5O3C/e0fFfJgXW', TRUE);
      `).catch(() => {});
    }

    // Seed default discussions if empty
    const [existingDiscussions] = await pool.query('SELECT COUNT(*) as count FROM discussions');
    if (existingDiscussions[0].count === 0) {
      const [users] = await pool.query('SELECT id FROM users LIMIT 1');
      if (users.length > 0) {
        const authorId = users[0].id;
        await pool.query(`
          INSERT INTO discussions (user_id, category, title, content, likes, replies_count) VALUES
          (?, 'Solutions', 'Optimal O(n) Hash Map approach for Two Sum in Python & C++', 'Instead of using two nested loops which takes O(n^2), we can use a hash map to store complements in a single pass.', 87, 12),
          (?, 'Help', 'Why did my sliding window solution exceed the 3-second time limit on test case 4?', 'Make sure you are incrementing the left pointer and deleting characters from the set properly to avoid infinite while loops.', 24, 5),
          (?, 'Contests', 'Weekly Challenge #1 Discussion & Editorial thread', 'Great contest everyone! For problem C (Merge Intervals), remember to sort intervals by start time first.', 115, 28),
          (?, 'Algorithms', 'Interval scheduling and greedy sorting patterns cheatsheet', 'Key greedy patterns: 1. Earliest finish time first. 2. Min-heap for active concurrent events. 3. Sweep line algorithm.', 64, 8)
        `, [authorId, authorId, authorId, authorId]).catch(() => {});
      }
    }

    console.log('[Database] Auto-migration & seed completed successfully.');
  } catch (error) {
    console.warn('[Database] Auto-migration notice:', error.message);
  }
}
