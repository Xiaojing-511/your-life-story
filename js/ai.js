/* ============================================================
 * 《林间拾忆》AI 生成层（GLM / 智谱开放平台，OpenAI 兼容接口）
 *
 * 让 AI 输出更精确的手段（设计要点）：
 *  1. 只让 AI 输出「叙事内容」（title/emoji/color/text），
 *     不输出 x 坐标、id —— 位置由 StoryStore.layoutWorld 按时间线排布；
 *  2. 固定 JSON Schema + response_format=json_object，强约束字段；
 *  3. emoji 限定候选列表、颜色限定色板（AI 只能从中挑）；
 *  4. 段落数量、字数范围、人称、情绪递进都写进系统提示；
 *  5. 客户端校验 + 归一化（非法 emoji/颜色自动修正）；
 *  6. 输出不合法时把错误喂回模型，最多重试 3 次；
 *  7. 解析时容错（剥 markdown 围栏、去尾逗号、截取首个 {…}）。
 * ============================================================ */
window.AI = (() => {
  'use strict';

  const DEFAULT = {
    key: '',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash', // 免费模型；可在设置里换成其他 glm 模型
    temperature: 0.85,
  };

  // 物品 emoji 候选（与默认故事风格一致，AI 只能从这里挑）
  const EMOJI = [
    '🕰️', '🖼️', '🪁', '🎫', '📓', '🌸', '🍂', '🍁', '☕', '🚲',
    '🎒', '🎸', '🎧', '📷', '✉️', '🔑', '🧸', '⚽', '🎨', '🌻',
    '🍊', '🧣', '🧦', '👟', '💍', '🎂', '🏮', '🎏', '🚉', '🌙',
    '⭐', '🌊', '🏔️', '🌲', '🍃', '💌', '📜', '🎼', '🎞️', '🌾',
  ];
  // 颜色色板（AI 只能从这里挑）
  const PALETTE = [
    '#d4a24e', '#e0b77a', '#6fc3df', '#e07b54',
    '#8aa6c9', '#c39bd3', '#7fbf7f', '#e8a0a0',
  ];

  /* ---------- 设置 ---------- */
  function getSettings() {
    try {
      return { ...DEFAULT, ...(JSON.parse(localStorage.getItem('mls-ai') || '{}')) };
    } catch (e) {
      return { ...DEFAULT };
    }
  }
  function saveSettings(s) {
    localStorage.setItem('mls-ai', JSON.stringify({ ...DEFAULT, ...s }));
    return getSettings();
  }

  /* ---------- 创作模式：智能生成(ai) / 手动创作(manual) ---------- */
  const MODE_KEY = 'mls-mode';
  function getMode() {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'ai' || v === 'manual' ? v : null;
  }
  function setMode(m) {
    if (m === 'ai' || m === 'manual') localStorage.setItem(MODE_KEY, m);
  }
  function hasKey() {
    return !!getSettings().key;
  }

  /* ---------- 基础请求 ---------- */
  async function chat(messages, opts = {}) {
    const s = getSettings();
    if (!s.key) throw new Error(window.I18N.t('ai.noKey'));
    const res = await fetch(`${String(s.base).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + s.key,
      },
      body: JSON.stringify({
        model: s.model || DEFAULT.model,
        messages,
        temperature: opts.temperature !== undefined ? opts.temperature : s.temperature,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json()).error?.message || '';
      } catch (e) {
        /* ignore */
      }
      throw new Error(window.I18N.t('ai.httpErr', { status: res.status, detail: detail || res.statusText }));
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(window.I18N.t('ai.emptyResp'));
    return content;
  }

  /* ---------- 解析容错 ---------- */
  function extractJSON(text) {
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '');
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    t = t.replace(/,\s*([}\]])/g, '$1'); // 去尾逗号
    return JSON.parse(t);
  }

  /* ---------- 校验 + 归一化 ---------- */
  function validate(data, count) {
    if (!data || typeof data !== 'object') throw new Error(window.I18N.t('ai.badJson'));
    const list = data.memories;
    if (!Array.isArray(list)) throw new Error(window.I18N.t('ai.noArr'));
    if (list.length !== count) {
      throw new Error(window.I18N.t('ai.badCount', { n: count, m: list.length }));
    }
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const m = list[i] || {};
      const title = String(m.title || '').trim().slice(0, 20) || '一段回忆';
      let emoji = String(m.emoji || '').trim();
      if (EMOJI.indexOf(emoji) < 0) {
        // 不在候选里：若本身是单个 emoji 字符则保留，否则取候选
        emoji = Array.from(emoji).length === 1 ? emoji : '🍃';
      }
      let color = String(m.color || '').trim().toLowerCase();
      if (PALETTE.indexOf(color) < 0) color = PALETTE[i % PALETTE.length];
      const text = Array.isArray(m.text)
        ? m.text.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
        : [];
      if (!text.length) throw new Error(window.I18N.t('ai.noText', { n: i + 1 }));
      out.push({ title, emoji, color, text });
    }
    return out;
  }

  /* ---------- 提示词 ---------- */
  function buildSystemPrompt(count) {
    return `你是「林间拾忆」这款步行叙事游戏的叙事设计师。玩家沿着林间小路行走，路边散落着象征人生经历的物品，拾起物品后会浮现一段回忆文字。

玩家会提供一段自己按成长顺序讲述的人生经历。你的任务是把这段经历**自己整理、总结、提炼**成 ${count} 段回忆，让玩家在自己的游戏里重新经历一遍自己的人生。

【输出格式 —— 必须严格遵守】
只输出一个 JSON 对象，不要输出任何解释、前后缀或 markdown 代码块：
{
  "title": "整个故事的名字（6~14 个汉字，例如：南方小城与未寄出的信）",
  "memories": [
    { "title": "回忆标题（4~10 个汉字，不加标点）", "emoji": "从候选列表选1个", "color": "从色板选1个", "text": ["第1段(25~80字)", "第2段", "第3段"] }
  ]
}

【硬性约束】
1. memories 必须恰好 ${count} 项。素材是一段连续的讲述，没有现成分段——你要自己找出最有画面感的 ${count} 个节点，并**按年龄从小到大、时间先后排列**（大致的成长顺序：童年 → 求学 → 爱情/友情 → 工作/理想 → 遗憾/告别）。
2. 每项 text 为 2~4 段话，每段 25~80 个汉字；用第二人称「你」叙述，温柔、克制、有画面感；情绪递进：场景 → 细节 → 感受 → 释然收尾。
3. emoji 只能从以下候选中选：${EMOJI.join(' ')}
4. color 只能从以下色板中选：${PALETTE.join(' ')}
5. 素材里没提到的具体人名、地名、事件不要编造，用「那个下午」「学校门口」这类模糊意象代替；可以适度艺术化，但不得虚构重大人生事件。
6. 每项只允许 title / emoji / color / text 四个字段，不要输出 id、x、image、video 等其他字段。`;
  }

  // 兼容多种素材格式：新版单段文字 life；旧版分类对象 childhood/school/...；或纯字符串
  function extractLife(material) {
    if (!material) return '';
    if (typeof material === 'string') return material.trim();
    if (Array.isArray(material)) return material.map((s) => String(s || '')).filter(Boolean).join('\n');
    if (typeof material === 'object') {
      const parts = [];
      if (typeof material.life === 'string') parts.push(material.life);
      const keys = ['childhood', 'school', 'love', 'work', 'loss', 'other'];
      for (const k of keys) {
        const v = (material[k] || '').trim();
        if (v) parts.push(v);
      }
      return parts.join('\n');
    }
    return '';
  }

  function buildUserPrompt({ name, material, count }) {
    const parts = [];
    if (name) parts.push(`玩家称呼：${name}`);
    const life = extractLife(material);
    if (life) {
      parts.push(`【玩家按成长顺序讲述的人生经历】\n${life}`);
    } else {
      parts.push('（玩家没有提供素材，请基于常见的普通人成长经历，写一段温柔、通用、有共鸣的人生故事，不要出现具体人名/地名。）');
    }
    parts.push(`请把上面的经历整理、总结成恰好 ${count} 段回忆，按年龄从小到大排列。`);
    return parts.join('\n\n');
  }

  /* ---------- 生成回忆 ---------- */
  async function generateMemories({ name, material, count, settings } = {}) {
    if (settings) saveSettings(settings);
    const n = Math.max(3, Math.min(8, Math.floor(count) || 5));
    const sys = buildSystemPrompt(n);
    const user = buildUserPrompt({ name, material, count: n });
    let lastErr = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const content = await chat([
          { role: 'system', content: sys },
          { role: 'user', content: user + (lastErr ? `\n\n【上次输出不合格】\n${lastErr}\n请修正后重新输出完整 JSON。` : '') },
        ]);
        const data = extractJSON(content);
        const memories = validate(data, n);
        const title =
          String(data.title || '').trim().slice(0, 20) ||
          (name ? `${name} 的人生` : '我的人生');
        return { title, memories };
      } catch (e) {
        lastErr = e.message;
        if (attempt === 2) throw new Error(window.I18N.t('ai.multiFail', { msg: e.message }));
      }
    }
    throw new Error('生成失败'); // 不会到达
  }

  /* ---------- 测试连接 ---------- */
  async function testConnection() {
    const s = getSettings();
    if (!s.key) throw new Error(window.I18N.t('ai.noKey'));
    const content = await chat(
      [{ role: 'user', content: '只回复两个字：成功' }],
      { temperature: 0.2 },
    );
    return content;
  }

  return { getSettings, saveSettings, generateMemories, testConnection, EMOJI, PALETTE, getMode, setMode, hasKey };
})();
