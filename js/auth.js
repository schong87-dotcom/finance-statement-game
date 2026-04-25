// 인증: 이름 + 비밀번호 기반 로컬 저장
(function(){
  const USERS_KEY = 'fsg.users';
  const SESSION_KEY = 'fsg.session';

  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  window.Auth = {
    getUser() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    signIn(name, password) {
      name = (name || '').trim();
      if (!name) return { ok:false, reason:'이름을 입력해주세요.' };
      if (!password || password.length < 6) return { ok:false, reason:'비밀번호는 6자리 이상이어야 합니다.' };
      const users = loadUsers();
      const existing = users[name];
      if (existing) {
        if (existing.password !== password) {
          return { ok:false, reason:'비밀번호가 일치하지 않습니다.' };
        }
      } else {
        // 계정이 없으면 자동 생성 (회원가입 탭이 제거되었으므로 로그인이 곧 가입 역할)
        users[name] = { password, createdAt: Date.now() };
        saveUsers(users);
      }
      const session = { name, loggedInAt: Date.now() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok:true, session };
    },
    signOut() {
      localStorage.removeItem(SESSION_KEY);
    },
  };

  // 게임 기록: 각 (user, gameId)마다 배열로 전체 히스토리 저장 (최신이 앞쪽)
  const HISTORY_KEY = 'fsg.history';
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

  window.Records = {
    // 해당 (user, gameId) 의 전체 히스토리 배열 반환 (최신 → 과거)
    listFor(userName, gameId) {
      const h = loadHistory();
      const key = `${userName}:${gameId}`;
      return h[key] || [];
    },
    // 최고 기록 반환 (가장 짧은 시간)
    best(userName, gameId) {
      const list = this.listFor(userName, gameId);
      if (list.length === 0) return null;
      return list.reduce((b, r) => (!b || r.timeSec < b.timeSec) ? r : b, null);
    },
    // 새 결과를 최신으로 추가
    save(userName, gameId, timeSec) {
      const h = loadHistory();
      const key = `${userName}:${gameId}`;
      const list = h[key] || [];
      const prevBest = list.reduce((b, r) => (!b || r.timeSec < b.timeSec) ? r : b, null);
      const record = { timeSec, at: Date.now() };
      // 최신을 맨 앞에
      list.unshift(record);
      // 최대 100개까지만 보관
      h[key] = list.slice(0, 100);
      saveHistory(h);
      const isBest = !prevBest || timeSec < prevBest.timeSec;
      return { improved: isBest, record, prevBest };
    },
    clear(userName, gameId) {
      const h = loadHistory();
      delete h[`${userName}:${gameId}`];
      saveHistory(h);
    },
  };
})();
