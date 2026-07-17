// 인증: 구글 로그인(Google Identity Services) 기반, 세션은 로컬 저장
(function(){
  const SESSION_KEY = 'fsg.session';

  // GIS가 돌려주는 credential(JWT)의 payload를 디코딩 (서명 검증은 하지 않음 — 클라이언트 전용 학습 앱)
  function decodeJwtPayload(jwt) {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  }

  window.Auth = {
    CLIENT_ID: '450177760064-blrki3gdhcb8d9bqf1q3v2oifoo55d13.apps.googleusercontent.com',
    getUser() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    // GIS 콜백에서 받은 credential로 로그인 처리
    signInWithGoogle(credential) {
      try {
        const p = decodeJwtPayload(credential);
        if (!p || !p.email) return { ok:false, reason:'구글 계정 정보를 읽지 못했습니다.' };
        const session = {
          name: p.name || p.email.split('@')[0],
          email: p.email,
          picture: p.picture || null,
          loggedInAt: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok:true, session };
      } catch {
        return { ok:false, reason:'로그인 처리 중 오류가 발생했습니다.' };
      }
    },
    signOut() {
      localStorage.removeItem(SESSION_KEY);
      // 원탭 자동 재로그인 방지
      if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch {}
      }
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
