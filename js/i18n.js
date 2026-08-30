/* ============================================================
 * 《林间拾忆》界面国际化（默认中文，可切换英文）
 * 用法：I18N.t('key') / I18N.t('key', { n: 5 })
 *      静态元素加 data-i18n / data-i18n-placeholder / data-i18n-title
 *      动态字符串在代码里用 I18N.t(...)
 * 说明：默认内置故事的中文回忆文本已配 textEn/titleEn；
 *      用户自己/AI 生成的故事内容是用户内容，不做翻译。
 * ============================================================ */
window.I18N = (() => {
  'use strict';

  const zh = {
    /* ---- 通用 ---- */
    'hint': '点击小路任意位置走到那里 · 按住 <b>空格</b> 一直走 · <b>Esc</b> 暂停',
    'start.volume': '音量',
    'start.gender': '角色',
    'start.lang': '语言',
    'start.myStories': '我的游戏',
    'gender.male': '👦 男',
    'gender.female': '👧 女',

    /* ---- 结尾 / 暂停 / 回忆 ---- */
    'end.title': '未完待续',
    'end.note': '林间深处，还有更多回忆在等你。',
    'end.walkAgain': '再走一遍',
    'end.stats': '这一程，你拾起了 {n} / {total} 段回忆。',
    'pause.title': '已暂停',
    'pause.esc': '按 Esc 继续前行',
    'pause.resume': '继续',
    'memory.next': '继续前行 ▸',    'memory.index': '回忆 {idx} / {total}',
    'hud.count': '🍃 回忆 {n}/{total}',

    /* ---- 开场提示 ---- */
    'toast.defaultStart': '点击小路任意位置，就会走到那里；按住空格一直向前。路边有些东西，等你拾起。',
    'toast.customStart': '这是属于你的故事，慢慢走。路边每件物品，都是一段你的人生。',

    /* ---- 创作器 ---- */
    'creator.desc': '把人生讲成一个可以走进去的故事。先选一种创作方式，随时可以切换。',
    'creator.modeTip.ai': '按时间顺序写下人生经历，AI 会自己整理成一段按年龄排列的故事。',
    'creator.modeTip.manual': '不需要任何配置，直接写。写多少、写什么，都由你决定。',
    'creator.name': '怎么称呼你？',
    'creator.namePh': '昵称（可选，会用在故事标题里）',
    'creator.aiStatus.ok': '✅ 已配置 AI（{model}），可以直接生成故事',
    'creator.aiStatus.warn': '⚠️ 还没配置 AI——不会弄也没关系，切到「✍️ 手动创作」就能直接写。想用 AI 的话，在下面填一个免费的 GLM API Key。',
    'creator.aiSettings': '🤖 AI 设置（不填也能用：切到「✍️ 手动创作」即可）',
    'creator.aiSettingsHint': 'API Key 是 AI 服务的「钥匙」。在 <a href="https://open.bigmodel.cn" target="_blank" rel="noopener">open.bigmodel.cn</a> 注册（免费、实名认证）后在控制台领取，glm-4-flash 模型调用是免费的。Key 只保存在你自己的浏览器里，不会上传。',
    'creator.model': '模型',
    'creator.base': '接口地址（一般不用改）',
    'creator.keyPh': '粘贴你的 GLM API Key',
    'creator.saveSettings': '保存设置',
    'creator.testConn': '测试连接',
    'creator.materialDesc': '按成长顺序讲一讲你的人生：小时候、上学、工作、重要的人、遗憾……想到哪说到哪，AI 会自己帮你整理成一段按年龄排列的故事。',
    'creator.life': '✍️ 你的人生经历（按时间顺序）',
    'creator.lifePh': '从小时候开始，按时间顺序慢慢讲，例如：\n· 童年：在哪长大、和谁一起、最难忘的事\n· 求学：学校、老师、朋友、梦想\n· 工作/城市：第一份工作、打拼的日子\n· 重要的人：爱情、友情、相遇与告别\n· 遗憾、没来得及说的话……',
    'creator.count': '回忆数量',
    'creator.countHint': '（3~8 段）',
    'creator.aiGenerate': '✨ AI 生成我的故事',
    'creator.manualStart': '✍️ 开始写我的故事',
    'creator.manualDesc': '不需要任何配置，完全自己写：每段回忆可以写文字、选图标和颜色，之后还能给每段配上照片或小视频（≤15MB）。',
    'creator.editDesc': '检查一下回忆，可以改文字、图标、颜色，还能上传照片 / 小视频（≤15MB）。',
    'creator.worldTitle': '故事标题',
    'creator.worldTitlePh': '我的故事的名字',
    'creator.editNote.existing': '（正在编辑已保存的世界，保存会覆盖原版）',
    'creator.editNote.new': '（保存后生成一个新的世界）',
    'creator.addMemory': '＋ 添加一段回忆',
    'creator.regenerate': '🔄 重新生成',
    'creator.backMaterial': '← 修改素材',
    'creator.back': '← 返回',
    'creator.saveDraft': '保存草稿',
    'creator.play': '▶ 一键生成并游玩',
    'creator.emptyTitle': '一段回忆',
    'creator.emptyText': '在这里写下你的故事……',
    'creator.color': '光晕颜色',
    'creator.titlePh': '回忆标题',
    'creator.textPh': '回忆文字…',
    'creator.addPara': '＋ 加一段',
    'creator.up': '上移',
    'creator.down': '下移',
    'creator.del': '删除这段回忆',
    'creator.delPara': '删除这一段',
    'creator.img': '📷 上传照片',
    'creator.vid': '🎬 上传视频 ≤15MB',
    'creator.aiImg': '🎨 AI 配图（即将上线）',
    'creator.removeImg': '✕ 移除照片',
    'creator.removeVid': '✕ 移除视频',
    'creator.busyGen': 'AI 正在把你的经历写成故事…（首次约 20~60 秒）',
    'creator.busySaving': '正在保存…',
    'creator.busyPlay': '正在生成你的游戏…',
    'creator.errNoMem': '还没有任何回忆，先「AI 生成」或「手动写」',
    'creator.errNoValid': '没有有效的回忆内容',
    'creator.errNoKey': '还没配置 AI：点开下面的「🤖 AI 设置」填一个免费的 GLM API Key；不想弄的话，切到「✍️ 手动创作」就能直接写。',
    'creator.errGen': '生成失败：{msg}',
    'creator.errSave': '保存失败：{msg}',
    'creator.savedOk': '已保存到「我的游戏」',
    'creator.savedToast': '已保存 ✓ 可从开始页「我的游戏」再次游玩/编辑',
    'creator.fileTooBig': '文件太大（{size}MB），请选 ≤{max}MB 的小体积视频',
    'creator.fileErr': '文件处理失败：{msg}',
    'creator.settingsSaved': 'AI 设置已保存',
    'creator.testing': '正在测试连接…',
    'creator.testOk': '连接成功 ✓（模型回复：{r}）',
    'creator.testFail': '连接失败：{msg}',
    'title.mine': '我的人生',
    'creator.gender': '角色（仅这个故事使用）',
    'creator.bgm': '🎵 背景音乐（可选，仅这个故事使用）',
    'creator.bgmUpload': '上传（≤20MB）',
    'creator.bgmRemove': '移除',
    'creator.bgmSet': '🎵 已设置：{name}',
    'creator.bgmSetToast': '已设置这个故事的音乐，保存后生效',
    'creator.bgmRemovedToast': '已移除，保存后恢复内置旋律',
    'creator.bgmTooBig': '音频文件太大（{size}MB），请选 ≤20MB 的音频',
    'creator.bgmErr': '音频处理失败：{msg}',
    'title.of': '{name} 的人生',

    /* ---- AI 错误提示 ---- */
    'ai.noKey': '还没有填写 AI API Key（设置 → AI 设置）',
    'ai.httpErr': 'AI 接口返回 {status}：{detail}',
    'ai.emptyResp': 'AI 返回内容为空',
    'ai.badJson': '不是有效的 JSON 对象',
    'ai.noArr': '缺少 memories 数组',
    'ai.badCount': '回忆数量应为 {n} 段，实际得到 {m} 段，请严格按数量输出',
    'ai.noText': '第 {n} 段回忆没有文字内容',
    'ai.multiFail': 'AI 生成多次不符合要求：{msg}',

    /* ---- 我的游戏 / 故事菜单 ---- */
    'worlds.title': '我的游戏',
    'worlds.new': '＋ 新建我的故事',
    'worlds.import': '📥 导入',
    'worlds.empty': '还没有自己的故事，点「＋ 新建我的故事」开始。',
    'worlds.builtin': '🌲 林间拾忆 · 内置旅程',
    'worlds.builtinMeta': '{n} 段回忆 · 默认',
    'worlds.meta': '{n} 段回忆 · {origin} · {date}',
    'worlds.originAi': 'AI 生成',
    'worlds.originManual': '手写',
    'worlds.current': '● 当前',
    'worlds.play': '▶ 游玩',
    'worlds.edit': '✏️ 编辑',
    'worlds.delete': '🗑 删除',
    'worlds.confirmDel': '删除「{title}」？照片/视频也会一并删除。',
    'menu.headName': '👤 {name} 的故事',
    'menu.head': '👤 切换故事',
    'menu.manage': '✏️ 管理我的游戏',
    'menu.make': '✨ make your life story…',
    'menu.empty': '还没有自己的故事，点下面创建',
    'menu.current': '✓ 当前',
    'menu.meta': '{n} 段回忆',

    /* ---- 存档/导入错误 ---- */
    'import.errJson': '不是有效的 JSON 文件',
    'import.errData': '文件里没有回忆数据',
    'import.err': '导入失败：{msg}',
    'import.ok': '已导入「{title}」',
    'voice.unsupported': '当前浏览器不支持语音输入，请用打字',
    'export.ok': '已导出（照片已内嵌，视频不包含）',
    'export.err': '导出失败：{msg}',
    /* ---- 背景音乐 ---- */
                                /* ---- 分享 / 只读体验 ---- */
    'toast.sharedStart': '这是「{title}」的故事，分享给你。慢慢走。',
    'viewer.note': '来自「{title}」的分享 · 仅供体验观看',
    'worlds.share': '🔗 分享',
    'worlds.export': '📤 导出',
    'share.title': '分享这个故事',
    'share.desc': '对方打开链接后只会看到「开始」和音量，仅可体验观看，无法编辑。照片/视频不会包含在链接里。',
    'share.copy': '复制链接',
    'share.copied': '已复制 ✓',
    'share.system': '系统分享',
    'share.fail': '生成分享链接失败：{msg}',
  };

  const en = {
    'hint': 'Click anywhere on the path to walk there · Hold <b>SPACE</b> to keep walking · <b>Esc</b> to pause',
    'start.volume': 'Volume',
    'start.gender': 'Character',
    'start.lang': 'Language',
    'start.myStories': 'My Stories',
    'gender.male': '👦 Male',
    'gender.female': '👧 Female',

    'end.title': 'TO BE CONTINUED',
    'end.note': 'Deeper in the woods, more memories are waiting for you.',
    'end.walkAgain': 'Walk Again',
    'end.stats': 'On this journey, you picked up {n} / {total} memories.',
    'pause.title': 'Paused',
    'pause.esc': 'Press Esc to continue',
    'pause.resume': 'Resume',
    'memory.next': 'Continue ▸',
    'memory.index': 'Memory {idx} / {total}',
    'hud.count': '🍃 Memories {n}/{total}',

    'toast.defaultStart': 'Click anywhere on the path to walk there; hold SPACE to keep going. Something is waiting by the road.',
    'toast.customStart': 'This is your story — take your time. Every item by the road is a piece of your life.',

    'creator.desc': 'Turn your life into a journey you can walk through. Choose how to create — you can switch anytime.',
    'creator.modeTip.ai': 'Write your experiences in order and the AI will shape them into a story arranged by age.',
    'creator.modeTip.manual': 'No setup needed — just write. It is all up to you.',
    'creator.name': 'What should we call you?',
    'creator.namePh': 'Nickname (optional, used in the story title)',
    'creator.aiStatus.ok': '✅ AI configured ({model}) — ready to generate',
    'creator.aiStatus.warn': '⚠️ AI is not configured yet — no problem: switch to ✍️ Manual and start writing. To use AI, paste a free GLM API key below.',
    'creator.aiSettings': '🤖 AI Settings (optional — switch to ✍️ Manual to skip)',
    'creator.aiSettingsHint': 'An API key is the "key" to the AI service. Register (free) at <a href="https://open.bigmodel.cn" target="_blank" rel="noopener">open.bigmodel.cn</a> and get a key in the console — the glm-4-flash model is free to use. The key is stored only in your browser.',
    'creator.model': 'Model',
    'creator.base': 'API Base URL (usually unchanged)',
    'creator.keyPh': 'Paste your GLM API key',
    'creator.saveSettings': 'Save Settings',
    'creator.testConn': 'Test Connection',
    'creator.materialDesc': 'Tell your life story in order — childhood, school, work, the people you love, regrets… just talk, and the AI will shape it into a story arranged by age.',
    'creator.life': '✍️ Your life story (in time order)',
    'creator.lifePh': 'Start from childhood and go forward, for example:\n· Childhood: where you grew up, who was there, the most memorable moments\n· School: teachers, friends, dreams\n· Work / city: first job, days of hustling\n· People who matter: love, friendship, hellos and goodbyes\n· Regrets, words left unsaid…',
    'creator.count': 'Number of memories',
    'creator.countHint': '(3~8)',
    'creator.aiGenerate': '✨ Generate My Story with AI',
    'creator.manualStart': '✍️ Start Writing My Story',
    'creator.manualDesc': 'No setup needed — write it yourself: each memory can have text, an icon and a color, plus a photo or small video (≤15MB).',
    'creator.editDesc': 'Review the memories — edit text, icon and color, and add a photo / small video (≤15MB).',
    'creator.worldTitle': 'Story title',
    'creator.worldTitlePh': 'Name of your story',
    'creator.editNote.existing': '(Editing a saved story — saving will overwrite the original)',
    'creator.editNote.new': '(Saving will create a new story)',
    'creator.addMemory': '＋ Add a memory',
    'creator.regenerate': '🔄 Regenerate',
    'creator.backMaterial': '← Edit Material',
    'creator.back': '← Back',
    'creator.saveDraft': 'Save Draft',
    'creator.play': '▶ Generate & Play',
    'creator.emptyTitle': 'A Memory',
    'creator.emptyText': 'Write your story here…',
    'creator.color': 'Glow color',
    'creator.titlePh': 'Memory title',
    'creator.textPh': 'Memory text…',
    'creator.addPara': '＋ Add paragraph',
    'creator.up': 'Move up',
    'creator.down': 'Move down',
    'creator.del': 'Delete this memory',
    'creator.delPara': 'Delete this paragraph',
    'creator.img': '📷 Upload photo',
    'creator.vid': '🎬 Upload video ≤15MB',
    'creator.aiImg': '🎨 AI image (coming soon)',
    'creator.removeImg': '✕ Remove photo',
    'creator.removeVid': '✕ Remove video',
    'creator.busyGen': 'The AI is turning your experiences into a story… (first time ~20-60s)',
    'creator.busySaving': 'Saving…',
    'creator.busyPlay': 'Building your game…',
    'creator.errNoMem': 'No memories yet — generate with AI or write manually first',
    'creator.errNoValid': 'No valid memory content',
    'creator.errNoKey': 'AI is not configured: open 🤖 AI Settings below and paste a free GLM API key; or switch to ✍️ Manual to just write.',
    'creator.errGen': 'Generation failed: {msg}',
    'creator.errSave': 'Save failed: {msg}',
    'creator.savedOk': 'Saved to My Stories',
    'creator.savedToast': 'Saved ✓ — find it under "My Stories" on the start screen',
    'creator.fileTooBig': 'File too large ({size}MB), please pick a small video ≤{max}MB',
    'creator.fileErr': 'File error: {msg}',
    'creator.settingsSaved': 'AI settings saved',
    'creator.testing': 'Testing connection…',
    'creator.testOk': 'Connected ✓ (model replied: {r})',
    'creator.testFail': 'Connection failed: {msg}',
    'title.mine': 'My Life',
    'creator.gender': 'Character (this story only)',
    'creator.bgm': '🎵 Background music (optional, this story only)',
    'creator.bgmUpload': 'Upload (≤20MB)',
    'creator.bgmRemove': 'Remove',
    'creator.bgmSet': '🎵 Set: {name}',
    'creator.bgmSetToast': 'Music set for this story — saved on Save',
    'creator.bgmRemovedToast': 'Removed — default music returns on Save',
    'creator.bgmTooBig': 'Audio file too large ({size}MB), please pick audio ≤20MB',
    'creator.bgmErr': 'Audio error: {msg}',
    'title.of': '{name}’s Life',

    /* ---- AI error messages ---- */
    'ai.noKey': 'No AI API key set (Settings → AI Settings)',
    'ai.httpErr': 'AI API returned {status}: {detail}',
    'ai.emptyResp': 'Empty AI response',
    'ai.badJson': 'Not a valid JSON object',
    'ai.noArr': 'Missing memories array',
    'ai.badCount': 'Expected exactly {n} memories, got {m} — output the exact count',
    'ai.noText': 'Memory #{n} has no text',
    'ai.multiFail': 'AI failed repeatedly: {msg}',
    'worlds.title': 'My Stories',
    'worlds.new': '＋ New Story',
    'worlds.import': '📥 Import',
    'worlds.empty': 'No stories yet — tap "＋ New Story" to begin.',
    'worlds.builtin': '🌲 The Forest Journey · Built-in',
    'worlds.builtinMeta': '{n} memories · Default',
    'worlds.meta': '{n} memories · {origin} · {date}',
    'worlds.originAi': 'AI',
    'worlds.originManual': 'Handwritten',
    'worlds.current': '● Current',
    'worlds.play': '▶ Play',
    'worlds.edit': '✏️ Edit',
    'worlds.delete': '🗑 Delete',
    'worlds.confirmDel': 'Delete "{title}"? Photos/videos will also be removed.',
    'menu.headName': '👤 Stories of {name}',
    'menu.head': '👤 Switch Story',
    'menu.manage': '✏️ Manage My Stories',
    'menu.make': '✨ make your life story…',
    'menu.empty': 'No stories yet — create one below',
    'menu.current': '✓ Current',
    'menu.meta': '{n} memories',

    'import.errJson': 'Not a valid JSON file',
    'import.errData': 'No memory data in the file',
    'import.err': 'Import failed: {msg}',
    'import.ok': 'Imported "{title}"',
    'voice.unsupported': 'Voice input is not supported in this browser — please type instead',
    'export.ok': 'Exported (photos embedded, videos not included)',
    'export.err': 'Export failed: {msg}',
    /* ---- Music ---- */
                                /* ---- Share / view-only ---- */
    'toast.sharedStart': 'This is the story of "{title}", shared with you. Take your time.',
    'viewer.note': 'Shared by "{title}" · View-only',
    'worlds.share': '🔗 Share',
    'worlds.export': '📤 Export',
    'share.title': 'Share This Story',
    'share.desc': 'Whoever opens the link will only see Start and volume — they can experience the story but not edit it. Photos/videos are not included in the link.',
    'share.copy': 'Copy Link',
    'share.copied': 'Copied ✓',
    'share.system': 'Share…',
    'share.fail': 'Failed to create share link: {msg}',
  };

  function lang() {
    return window.GAME_SETTINGS.getLang();
  }
  function t(key, params) {
    const d = lang() === 'en' ? en : zh;
    let s = d[key] !== undefined ? d[key] : zh[key];
    if (s === undefined) s = key;
    if (params) {
      for (const k of Object.keys(params)) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
      }
    }
    return s;
  }
  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const k = el.getAttribute('data-i18n-html');
      if (k) el.innerHTML = t(k);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (k) el.placeholder = t(k);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const k = el.getAttribute('data-i18n-title');
      if (k) el.title = t(k);
    });
  }
  function setLang(l) {
    window.GAME_SETTINGS.setLang(l);
    applyStatic();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: l } }));
  }
  function isEn() {
    return lang() === 'en';
  }

  return { t, lang, isEn, setLang, applyStatic };
})();
