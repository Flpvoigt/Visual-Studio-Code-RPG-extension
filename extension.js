const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');

const ROASTS = [
  'mais um erro desses e eu vou procurar outro dev pra morar aqui dentro',
  'essa variável "x" tá dizendo tudo sobre seu esforço hoje',
  'tenta de novo, mas com carinho dessa vez',
  'o compilador tá tão confuso quanto você agora',
  'isso não é um bug, é uma personalidade',
  'eu já vi estagiário escrever código melhor que isso (sem ofender)',
  'respira. salva. tenta nao copiar do stackoverflow dessa vez',
  'seu código e minha paciência estão no mesmo nível de quebrado',
];

const PRAISES = [
  'olha só, zero erro. tô orgulhoso (não conta pra ninguém)',
  'código limpo? quem é você e o que fez com meu humano caótico',
  'issinho aí tá bonito, pode commitar',
  'até que enfim um save decente',
];

const IDLE_QUIPS = [
  'tô aqui, parado, vendo a vida passar',
  'cadê você? o código não se escreve sozinho (ou será que sim)',
  '*ronco de gremlin*',
];

const ACHIEVEMENTS = [
  { id: 'first', icon: '🥉', threshold: 1, text: 'Primeiro Tombo — 1º erro corrigido no dia' },
  { id: 'five', icon: '🥈', threshold: 5, text: 'Reincidente — 5 erros corrigidos' },
  { id: 'ten', icon: '🥇', threshold: 10, text: 'Debugger Raiz — 10 erros corrigidos' },
  { id: 'quarter', icon: '🏆', threshold: 25, text: 'Lenda Local — 25 erros corrigidos' },
  { id: 'saves10', icon: '💾', saveThreshold: 10, text: 'Dedão do Ctrl+S — 10 saves no dia' },
  { id: 'saves50', icon: '📀', saveThreshold: 50, text: 'Compulsivo — 50 saves no dia' },
  { id: 'level5', icon: '⭐', levelThreshold: 5, text: 'Nível 5 — gremlin crescendo' },
  { id: 'level10', icon: '🌟', levelThreshold: 10, text: 'Nível 10 — gremlin evoluído' },
  { id: 'newproject', icon: '🗺️', special: 'newProject', text: 'Fundador — abriu um projeto novo' },
];

// 20 ranks, each tier = its own unique badge slot (own icon/art, own glow bucket).
// effectTier (1-8) reuses the 8-step glow/twinkle escalation so CSS doesn't need 20 copies of it.
const TITLES = [
  { level: 1, text: 'Novato de Teclado', tier: 1, effectTier: 1 },
  { level: 5, text: 'Aprendiz de Código', tier: 2, effectTier: 1 },
  { level: 10, text: 'Escriba de Bugs', tier: 3, effectTier: 2 },
  { level: 15, text: 'Caçador de Erros', tier: 4, effectTier: 2 },
  { level: 20, text: 'Cavaleiro do Commit', tier: 5, effectTier: 2 },
  { level: 25, text: 'Guardião do Build', tier: 6, effectTier: 3 },
  { level: 30, text: 'Mestre do Refactor', tier: 7, effectTier: 3 },
  { level: 35, text: 'Sentinela do Deploy', tier: 8, effectTier: 4 },
  { level: 40, text: 'Arquiteto de Sistemas', tier: 9, effectTier: 4 },
  { level: 45, text: 'Lorde do Deploy', tier: 10, effectTier: 4 },
  { level: 50, text: 'Feiticeiro de Algoritmos', tier: 11, effectTier: 5 },
  { level: 55, text: 'Arquimago do Git', tier: 12, effectTier: 5 },
  { level: 60, text: 'Campeão do CI/CD', tier: 13, effectTier: 6 },
  { level: 65, text: 'Dragão do Debug', tier: 14, effectTier: 6 },
  { level: 70, text: 'Fantasma do Stack Trace', tier: 15, effectTier: 6 },
  { level: 75, text: 'Titã da Infraestrutura', tier: 16, effectTier: 7 },
  { level: 80, text: 'Oráculo do Código', tier: 17, effectTier: 7 },
  { level: 85, text: 'Imperador dos Servidores', tier: 18, effectTier: 8 },
  { level: 90, text: 'Avatar da Máquina', tier: 19, effectTier: 8 },
  { level: 100, text: 'Lenda do Código ∞', tier: 20, effectTier: 8 },
];

const SHOP_ITEMS = [
  { id: 'skin_dragon', icon: '🐲', cost: 30, text: 'Pele de Dragão', desc: 'Troca o bicho por um dragão enquanto ativo.' },
  { id: 'xp_boost', icon: '⚡', cost: 25, text: 'Café Turbo', desc: '+50% XP de saves pelas próximas 2 horas.' },
  { id: 'gold_frame', icon: '🖼️', cost: 20, text: 'Moldura Dourada', desc: 'Moldura especial no retrato, permanente.' },
  { id: 'sound_pack', icon: '🎵', cost: 15, text: 'Trilha Alternativa', desc: 'Troca os beeps por um jingle diferente.' },
  { id: 'extra_quip', icon: '💬', cost: 10, text: 'Língua Afiada', desc: 'Desbloqueia roasts extras mais pesados.' },
];

const XP_PER_FIX = 10;
const XP_PER_SAVE = 1;
const COINS_PER_FIX = 2;
const COINS_PER_SAVES_BLOCK = 1; // 1 coin every 10 saves

function activate(context) {
  const petItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  petItem.command = 'codeGremlin.openPanel';
  context.subscriptions.push(petItem);

  const saved = context.globalState.get('codeGremlinState', {});
  const state = {
    saveCount: saved.saveCount || 0,
    errorsFixedToday: saved.errorsFixedToday || 0,
    lastErrorCount: 0,
    lastActivity: Date.now(),
    asleep: false,
    xp: saved.xp || 0,
    coins: saved.coins || 0,
    achievementsUnlocked: new Set(saved.achievementsUnlocked || []),
    purchased: new Set(saved.purchased || []),
    knownWorkspaces: new Set(saved.knownWorkspaces || []),
    xpBoostUntil: saved.xpBoostUntil || 0,
    cleanStreak: saved.cleanStreak || 0,
  };

  /** @type {vscode.WebviewPanel | undefined} */
  let panel;

  function persist() {
    context.globalState.update('codeGremlinState', {
      saveCount: state.saveCount,
      errorsFixedToday: state.errorsFixedToday,
      xp: state.xp,
      coins: state.coins,
      achievementsUnlocked: [...state.achievementsUnlocked],
      purchased: [...state.purchased],
      knownWorkspaces: [...state.knownWorkspaces],
      xpBoostUntil: state.xpBoostUntil,
      cleanStreak: state.cleanStreak,
    });
  }

  function config() {
    return vscode.workspace.getConfiguration('codeGremlin');
  }

  function beepSequence(pairs) {
    if (!config().get('soundEnabled')) return;
    const cmd = pairs.map(([f, d]) => `[console]::beep(${f},${d})`).join(';');
    exec(`powershell -NoProfile -Command "${cmd}"`, () => {});
  }

  function failJingle() {
    if (state.purchased.has('sound_pack')) beepSequence([[200, 90], [200, 90], [150, 260]]);
    else beepSequence([[300, 120], [250, 120], [180, 260]]);
  }
  function successJingle() {
    if (state.purchased.has('sound_pack')) beepSequence([[523, 90], [659, 90], [784, 90], [1046, 200]]);
    else beepSequence([[400, 90], [500, 90], [650, 180]]);
  }
  function levelUpJingle() { beepSequence([[500, 80], [650, 80], [800, 80], [1000, 220]]); }
  function coinJingle() { beepSequence([[900, 60], [1200, 100]]); }
  function comboJingle(n) {
    const base = 523;
    beepSequence([[base, 60], [base + n * 15, 60], [base + n * 30, 100]]);
  }

  function currentDiagnosticsCount(uri) {
    const diags = vscode.languages.getDiagnostics(uri);
    const errors = diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length;
    const warnings = diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning).length;
    return { errors, warnings };
  }

  // Sub-linear (sqrt) curve so a dedicated user can realistically reach level 100 (~14k XP,
  // roughly 3-4 months of regular active use) instead of the old linear curve, which would have
  // taken years. Keeps early levels cheap and late levels a real but reachable long-term goal.
  function xpNeededFor(level) {
    return 25 + Math.floor(Math.sqrt(level) * 18);
  }

  function levelFromXp(xp) {
    let level = 1;
    let need = xpNeededFor(1);
    let remaining = xp;
    while (remaining >= need) {
      remaining -= need;
      level += 1;
      need = xpNeededFor(level);
    }
    return { level, xpIntoLevel: remaining, xpForNextLevel: need };
  }

  function titleForLevel(level) {
    let current = TITLES[0];
    for (const t of TITLES) {
      if (level >= t.level) current = t;
    }
    return current;
  }

  function pickMood(errors, warnings) {
    if (state.asleep) return 'asleep';
    if (errors >= 4) return 'dying';
    if (errors >= 1) return 'angry';
    if (warnings >= 1) return 'worried';
    return 'happy';
  }

  function buildAchievementState() {
    return ACHIEVEMENTS.map((a) => ({
      icon: a.icon,
      text: a.text,
      unlocked: state.achievementsUnlocked.has(a.id),
    }));
  }

  function buildShopState() {
    return SHOP_ITEMS.map((s) => ({ ...s, owned: state.purchased.has(s.id) }));
  }

  function postToPanel(extra) {
    if (!panel) return;
    const editor = vscode.window.activeTextEditor;
    const { errors, warnings } = editor
      ? currentDiagnosticsCount(editor.document.uri)
      : { errors: 0, warnings: 0 };
    const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(state.xp);
    const title = titleForLevel(level);

    panel.webview.postMessage({
      mood: pickMood(errors, warnings),
      level,
      xpIntoLevel,
      xpForNextLevel,
      title: title.text,
      tier: title.tier,
      effectTier: title.effectTier,
      dragonSkin: state.purchased.has('skin_dragon'),
      goldFrame: state.purchased.has('gold_frame'),
      saveCount: state.saveCount,
      errorsFixedToday: state.errorsFixedToday,
      coffees: Math.floor(state.saveCount / 5),
      coins: state.coins,
      cleanStreak: state.cleanStreak,
      achievements: buildAchievementState(),
      shop: buildShopState(),
      titles: TITLES.map((t) => ({
        level: t.level,
        text: t.text,
        tier: t.tier,
        effectTier: t.effectTier,
        unlocked: level >= t.level,
        current: title.level === t.level,
      })),
      ...extra,
    });
  }

  function miniXpBar(xpIntoLevel, xpForNextLevel, size = 8) {
    const pct = xpIntoLevel / xpForNextLevel;
    const filled = Math.max(0, Math.min(size, Math.round(pct * size)));
    return '█'.repeat(filled) + '▁'.repeat(size - filled);
  }

  function updateStatusBar() {
    const editor = vscode.window.activeTextEditor;
    const { errors, warnings } = editor
      ? currentDiagnosticsCount(editor.document.uri)
      : { errors: 0, warnings: 0 };
    const mood = pickMood(errors, warnings);
    const emoji = { happy: '🐣', worried: '🐛', angry: '😾', dying: '💀', asleep: '💤' }[mood];
    const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(state.xp);
    const pct = Math.round((xpIntoLevel / xpForNextLevel) * 100);
    const bar = miniXpBar(xpIntoLevel, xpForNextLevel);
    const streak = state.cleanStreak >= 3 ? ` 🔥${state.cleanStreak}` : '';

    petItem.text = `${emoji} Nv.${level}  ${bar} ${pct}%${streak}`;
    petItem.tooltip = new vscode.MarkdownString(
      `**${titleForLevel(level).text}**\n\n${xpIntoLevel}/${xpForNextLevel} XP · ${state.coins} 🪙\n\nClica pra abrir o painel`
    );

    if (mood === 'dying') {
      petItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (mood === 'angry') {
      petItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      petItem.backgroundColor = undefined;
    }

    petItem.show();
  }

  function refreshAll(extra) {
    updateStatusBar();
    postToPanel(extra);
    persist();
  }

  function checkAchievements(opts) {
    const { level } = levelFromXp(state.xp);
    let unlockedNew = false;
    for (const a of ACHIEVEMENTS) {
      if (state.achievementsUnlocked.has(a.id)) continue;
      const hit =
        (a.threshold && state.errorsFixedToday >= a.threshold) ||
        (a.saveThreshold && state.saveCount >= a.saveThreshold) ||
        (a.levelThreshold && level >= a.levelThreshold) ||
        (a.special && opts && opts[a.special]);
      if (hit) {
        state.achievementsUnlocked.add(a.id);
        unlockedNew = true;
        vscode.window.showInformationMessage(`🏆 Conquista: ${a.text}`);
      }
    }
    if (unlockedNew) {
      levelUpJingle();
      refreshAll({ event: 'achievement', quip: 'mais um troféu pra coleção' });
    }
  }

  function addXp(amount) {
    const boosted = Date.now() < state.xpBoostUntil ? Math.round(amount * 1.5) : amount;
    const before = levelFromXp(state.xp);
    state.xp += boosted;
    const after = levelFromXp(state.xp);
    if (after.level > before.level) {
      levelUpJingle();
      const newTitle = titleForLevel(after.level);
      const oldTitle = titleForLevel(before.level);
      if (newTitle.text !== oldTitle.text) {
        vscode.window.showInformationMessage(`👑 Novo título desbloqueado: "${newTitle.text}" (nível ${after.level})`);
      } else {
        vscode.window.showInformationMessage(`✨ Code Gremlin subiu pro nível ${after.level}!`);
      }
    }
  }

  function addCoins(amount) {
    if (amount <= 0) return;
    state.coins += amount;
    coinJingle();
  }

  function touchActivity() {
    state.lastActivity = Date.now();
    if (state.asleep) {
      state.asleep = false;
      refreshAll({ quip: 'ihh acordei' });
    }
  }

  function checkNewWorkspace() {
    const folders = vscode.workspace.workspaceFolders || [];
    let isNew = false;
    for (const f of folders) {
      const p = f.uri.fsPath;
      if (!state.knownWorkspaces.has(p)) {
        state.knownWorkspaces.add(p);
        isNew = true;
      }
    }
    if (isNew && folders.length > 0) {
      addXp(25);
      addCoins(5);
      vscode.window.showInformationMessage('🗺️ Novo projeto detectado! +25 XP, +5 moedas.');
      checkAchievements({ newProject: true });
    }
  }

  // Combo bonus is tied to consecutive *clean saves* (not keystrokes), so it can't be farmed by
  // mashing letters — only by actually saving working code repeatedly. Kept modest and capped so
  // leveling stays gradual: +4 XP at streak 3, scaling up to a +10 cap by streak ~9.
  function comboBonusFor(streak) {
    return Math.min(4 + Math.floor(streak / 3) * 2, 10);
  }

  // Guards against the Ctrl+S-held exploit: a save only counts if the document's content actually
  // changed since the last XP-awarding save of that same file, and saves of the same file are
  // throttled to one every 2s regardless (covers autosave/format-on-save double-fires too).
  const lastSavedContent = new Map();
  const lastSaveAt = new Map();

  const saveSub = vscode.workspace.onDidSaveTextDocument((doc) => {
    touchActivity();

    const key = doc.uri.toString();
    const text = doc.getText();
    const now = Date.now();
    const unchanged = lastSavedContent.get(key) === text;
    const tooSoon = now - (lastSaveAt.get(key) || 0) < 2000;

    if (unchanged || tooSoon) {
      return;
    }
    lastSavedContent.set(key, text);
    lastSaveAt.set(key, now);

    state.saveCount += 1;
    addXp(XP_PER_SAVE);
    if (state.saveCount % 10 === 0) addCoins(COINS_PER_SAVES_BLOCK);

    const { errors } = currentDiagnosticsCount(doc.uri);

    if (errors > 0) {
      state.cleanStreak = 0;
      failJingle();
      let quip;
      if (config().get('roastEnabled') && Math.random() < 0.35) {
        quip = ROASTS[Math.floor(Math.random() * ROASTS.length)];
        vscode.window.showWarningMessage(`Code Gremlin: ${quip}`);
      }
      refreshAll({ event: 'fail', quip });
    } else {
      state.cleanStreak += 1;
      const fixedThisSave = state.lastErrorCount > 0;
      const isCombo = state.cleanStreak % 3 === 0;
      let quip;

      if (fixedThisSave) {
        state.errorsFixedToday += 1;
        addXp(XP_PER_FIX);
        addCoins(COINS_PER_FIX);
      }

      if (isCombo) {
        const bonus = comboBonusFor(state.cleanStreak);
        addXp(bonus);
        comboJingle(state.cleanStreak);
        quip = `combo x${state.cleanStreak}! +${bonus} XP`;
        refreshAll({ event: 'combo', comboCount: state.cleanStreak, comboXp: bonus, quip });
      } else if (fixedThisSave) {
        successJingle();
        if (Math.random() < 0.5) quip = PRAISES[Math.floor(Math.random() * PRAISES.length)];
        if (quip) vscode.window.showInformationMessage(`Code Gremlin: ${quip}`);
        refreshAll({ event: 'win', quip });
      } else {
        refreshAll({});
      }

      if (fixedThisSave) checkAchievements();
    }

    state.lastErrorCount = errors;
  });

  const editSub = vscode.workspace.onDidChangeTextDocument(() => touchActivity());
  const diagSub = vscode.languages.onDidChangeDiagnostics(() => refreshAll({}));
  const activeEditorSub = vscode.window.onDidChangeActiveTextEditor(() => refreshAll({}));
  const workspaceSub = vscode.workspace.onDidChangeWorkspaceFolders(() => checkNewWorkspace());

  const idleTimer = setInterval(() => {
    const idleMs = (config().get('idleMinutes') || 5) * 60 * 1000;
    if (!state.asleep && Date.now() - state.lastActivity > idleMs) {
      state.asleep = true;
      refreshAll({ quip: IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)] });
    } else {
      refreshAll({});
    }
  }, 30000);

  function nonce() {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
  }

  function buyItem(id) {
    const item = SHOP_ITEMS.find((s) => s.id === id);
    if (!item || state.purchased.has(id)) return;
    if (state.coins < item.cost) {
      vscode.window.showWarningMessage(`Code Gremlin: moedas insuficientes pra "${item.text}" (precisa ${item.cost}, tem ${state.coins}).`);
      return;
    }
    state.coins -= item.cost;
    state.purchased.add(id);
    if (id === 'xp_boost') state.xpBoostUntil = Date.now() + 2 * 60 * 60 * 1000;
    coinJingle();
    vscode.window.showInformationMessage(`🛒 Comprado: ${item.text}!`);
    refreshAll({ event: 'achievement' });
  }

  function openPanel() {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      postToPanel({});
      return;
    }
    panel = vscode.window.createWebviewPanel(
      'codeGremlinPanel',
      'Code Gremlin',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')],
        retainContextWhenHidden: true,
      }
    );

    const styleUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'webview', 'style.css')
    );

    // Real generated badge art, where available (webview/badges/tierN.png); tiers without an
    // image fall back to the drawn SVG seal in the webview script.
    const badgesDir = vscode.Uri.joinPath(context.extensionUri, 'webview', 'badges').fsPath;
    const badgeUris = {};
    for (let t = 1; t <= 20; t++) {
      const file = require('path').join(badgesDir, `tier${t}.png`);
      if (fs.existsSync(file)) {
        badgeUris[t] = panel.webview
          .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview', 'badges', `tier${t}.png`))
          .toString();
      }
    }

    const html = fs
      .readFileSync(
        vscode.Uri.joinPath(context.extensionUri, 'webview', 'index.html').fsPath,
        'utf8'
      )
      .replace(/{{cspSource}}/g, panel.webview.cspSource)
      .replace(/{{nonce}}/g, nonce())
      .replace(/{{styleUri}}/g, styleUri.toString())
      .replace(/{{badgeUris}}/g, JSON.stringify(badgeUris));

    panel.webview.html = html;

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'ready') postToPanel({});
      if (msg.type === 'buy') buyItem(msg.id);
    });

    panel.onDidDispose(() => { panel = undefined; });
  }

  const openPanelCmd = vscode.commands.registerCommand('codeGremlin.openPanel', openPanel);

  const showReportCmd = vscode.commands.registerCommand('codeGremlin.showReport', () => {
    const coffees = Math.floor(state.saveCount / 5);
    vscode.window.showInformationMessage(
      `📋 Relatório do dia — Saves: ${state.saveCount} | Erros corrigidos: ${state.errorsFixedToday} | Cafés virtuais: ${coffees} | Moedas: ${state.coins}`
    );
  });

  const feedCmd = vscode.commands.registerCommand('codeGremlin.feedGremlin', () => {
    touchActivity();
    openPanel();
  });

  context.subscriptions.push(
    saveSub,
    editSub,
    diagSub,
    activeEditorSub,
    workspaceSub,
    openPanelCmd,
    showReportCmd,
    feedCmd,
    { dispose: () => clearInterval(idleTimer) }
  );

  checkNewWorkspace();
  updateStatusBar();
}

function deactivate() {}

module.exports = { activate, deactivate };
