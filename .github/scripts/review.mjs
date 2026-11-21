#!/usr/bin/env node
// AI 代码审查：读取 PR 的 git diff，调用 OpenAI 兼容的 Chat Completions 接口，
// 把结果写成（或更新）PR 下的一条评论。无第三方依赖，Node 20+。
//
// 本地调试：DRY_RUN=1 BASE_SHA=main HEAD_SHA=dev node .github/scripts/review.mjs

import { execFileSync } from 'node:child_process';

const MARKER = '<!-- ai-review -->';
const MAX_DIFF_CHARS = 60_000;
const MAX_COMMENT_CHARS = 60_000;

// 不值得让模型看的文件（二进制、资源、生成物）
const SKIP_EXT = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.bmp', '.tga', '.exr',
  '.ogg', '.wav', '.mp3', '.flac', '.ttf', '.otf', '.woff', '.woff2',
  '.glb', '.gltf', '.fbx', '.blend', '.obj', '.dae',
  '.import', '.uid', '.lock', '.exe', '.pck', '.apk', '.aab', '.zip', '.7z',
];
const SKIP_DIRS = ['.godot/', 'build/', 'dist/', 'export/', 'node_modules/'];

// 空字符串也回落到默认值（GitHub Actions 里未设置的 vars 会传成空串）
const env = (key, fallback = '') => {
  const value = (process.env[key] ?? '').toString().trim();
  return value === '' ? fallback : value;
};

function note(message) {
  console.log(`::notice::${message}`);
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function gitDiff(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function isSkipped(file) {
  const lower = file.toLowerCase();
  return (
    SKIP_EXT.some((ext) => lower.endsWith(ext)) ||
    SKIP_DIRS.some((dir) => lower.includes(dir))
  );
}

// 用 --name-only -z 拿到精确路径（避免中文/空格被 git 转义），先筛掉资源文件再取 diff
function collectChanges(range) {
  const nameOnly = gitDiff([
    '-c', 'core.quotepath=false',
    'diff', '--name-only', '-z', range,
  ]);
  const changed = nameOnly.split('\0').filter(Boolean);
  const kept = changed.filter((file) => !isSkipped(file));

  if (kept.length === 0) {
    return { kept, skipped: changed.length, stat: '', diff: '' };
  }

  const stat = gitDiff([
    '-c', 'core.quotepath=false',
    'diff', '--stat', '--no-color', range, '--', ...kept,
  ]).trim();

  const diff = gitDiff([
    '-c', 'core.quotepath=false',
    'diff', '--no-color', '--unified=3', range, '--', ...kept,
  ]);

  return { kept, skipped: changed.length - kept.length, stat, diff };
}

function truncate(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf('\n', limit);
  return `${text.slice(0, cut > 0 ? cut : limit)}\n\n…（diff 过长，已截断）`;
}

function buildPrompt(diff, stat) {
  return `请审查下面这个 Pull Request 的改动。

仓库项目：Godot 4.7 游戏（GDScript）。
PR 标题：${env('PR_TITLE', '(未提供)')}
PR 描述：
${(env('PR_BODY', '') || '(未填写)').slice(0, 2000)}

改动统计：
${stat || '(无)'}

diff：
\`\`\`diff
${diff}
\`\`\`
`;
}

const SYSTEM_PROMPT = `你是一名资深 Godot 4 / GDScript 代码审查者，熟悉游戏客户端开发与工程实践。

请只针对 diff 中真实存在的问题给出意见，重点检查：
- 逻辑错误、边界条件、空引用（null / 节点未找到）、类型标注与实际类型不符
- 信号连接泄漏（connect 后没有 disconnect，节点释放后仍被引用）、内存与资源泄漏
- 性能问题（每帧 new、get_node 热路径、不必要的 _process）
- 存档/状态一致性问题（SaveSystem 版本、GameManager 状态迁移）
- 并发/时序问题（await 后节点可能已 freed）
- 明显的安全或工程问题（硬编码密钥、提交了缓存或导出产物）

输出要求：
- 只用中文，直接给结论，不要寒暄、不要复述 diff
- 按严重程度分组：**必须修改** / **建议修改** / **可选优化**
- 每条格式：\`文件路径:行号\` — 问题是什么 — 建议怎么改（必要时给一小段代码）
- 行号请使用 diff 中 + 侧的新行号；不确定行号时只写文件路径
- 最多 8 条，按重要性排序；纯风格/命名偏好不要提
- 如果完全没有实质问题，写一句「未发现必须修改的问题」，再列最多 2 条可选建议
- 整体控制在 800 字以内`;

async function callModel(messages) {
  const base = env('LLM_BASE_URL', 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = env('LLM_MODEL', 'deepseek-chat');
  const url = `${base}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env('DEEPSEEK_API_KEY')}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2000,
      stream: false,
    }),
  });

  const text = await res.text();
  if (!res.ok) fail(`模型接口返回 ${res.status}：${text.slice(0, 800)}`);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`模型接口返回了非 JSON 内容：${text.slice(0, 800)}`);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) fail(`模型返回为空：${text.slice(0, 800)}`);
  return { content, model, usage: data?.usage };
}

async function githubApi(path, init = {}) {
  const apiBase = env('GITHUB_API_URL', 'https://api.github.com');
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-review-bot',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) fail(`GitHub API ${path} 返回 ${res.status}：${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function upsertComment(body) {
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMBER');
  const comments = await githubApi(`/repos/${repo}/issues/${pr}/comments?per_page=100`);
  const previous = (comments || []).find(
    (c) => c?.user?.type === 'Bot' && typeof c.body === 'string' && c.body.includes(MARKER),
  );

  if (previous) {
    await githubApi(`/repos/${repo}/issues/comments/${previous.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    return 'updated';
  }

  await githubApi(`/repos/${repo}/issues/${pr}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return 'created';
}

async function main() {
  const dryRun = env('DRY_RUN') === '1';
  const base = env('BASE_SHA');
  const head = env('HEAD_SHA');

  if (!dryRun && !env('DEEPSEEK_API_KEY')) {
    note('未配置 DEEPSEEK_API_KEY，跳过 AI 审查（Settings → Secrets and variables → Actions 添加后生效）');
    return;
  }

  if (!base || !head) fail('缺少 BASE_SHA / HEAD_SHA 环境变量');

  const range = `${base}...${head}`;
  const { kept, skipped, stat, diff: rawDiff } = collectChanges(range);

  if (!rawDiff.trim()) {
    note('本次改动为二进制/资源文件或空改动，跳过 AI 审查');
    if (dryRun) return;
    await upsertComment(`${MARKER}\n## AI 代码审查\n\n本次改动没有可审阅的代码（仅资源或空改动）。`);
    return;
  }

  const diff = truncate(rawDiff, MAX_DIFF_CHARS);
  const prompt = buildPrompt(diff, stat);

  console.log(
    `审阅 ${kept.length} 个文件（跳过 ${skipped} 个资源/生成文件），diff ${rawDiff.length} 字符（截断后 ${diff.length}）`,
  );

  if (dryRun) {
    console.log('--- DRY RUN，prompt 预览 ---');
    console.log(prompt.slice(0, 2000));
    return;
  }

  const { content, model, usage } = await callModel([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);

  const shortBase = base.slice(0, 7);
  const shortHead = head.slice(0, 7);
  const tokenInfo = usage
    ? ` · tokens ${usage.prompt_tokens ?? '?'}/${usage.completion_tokens ?? '?'}`
    : '';

  const body = [
    MARKER,
    '## AI 代码审查',
    '',
    `> 范围 \`${shortBase}…${shortHead}\` · 模型 \`${model}\`${tokenInfo}`,
    '',
    content.slice(0, MAX_COMMENT_CHARS),
    '',
    '---',
    '<sub>由 `.github/workflows/ai-review.yml` 自动生成，新的 push 会更新本条评论。仅供参考，合并前请人工确认。</sub>',
  ].join('\n');

  const result = await upsertComment(body);

  if (env('GITHUB_STEP_SUMMARY')) {
    const fs = await import('node:fs');
    fs.appendFileSync(env('GITHUB_STEP_SUMMARY'), `## AI 代码审查\n\n${content}\n`);
  }

  console.log(`PR 评论已${result === 'created' ? '创建' : '更新'}`);
}

main().catch((error) => fail(error?.stack ? String(error.stack) : String(error)));
