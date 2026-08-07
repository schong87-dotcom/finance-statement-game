// 로그인 세션과 게임 기록을 Supabase로 처리 (화면 코드가 쓰는 공개 API는 동기 시그니처 유지)
(function(){
  const EMAIL_DOMAIN = 'fsg.local';
  const MAX_NAME_BYTES = 30;               // 이메일 local part 64자 제한 → hex 60자 → UTF-8 30바이트
  const LEGACY_HISTORY_KEY = 'fsg.history';

  let sb = null;         // supabase 클라이언트
  let session = null;    // 현재 세션
  let cache = {};        // { gameId: [{ timeSec, at }, ...] } — 최신이 앞

  function client() {
    if (sb) return sb;
    const cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) throw new Error('SUPABASE_CONFIG가 비어 있습니다. js/supabase-config.js를 확인하세요.');
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    return sb;
  }

  function utf8Bytes(str) { return new TextEncoder().encode(str); }

  // 이름 → 결정론적 이메일 주소.
  // 한글은 이메일 local part에 들어갈 수 없으므로 UTF-8 바이트를 hex로 펴서 [0-9a-f]만 남긴다.
  function nameToEmail(name) {
    let hex = '';
    utf8Bytes(name).forEach(b => { hex += b.toString(16).padStart(2, '0'); });
    return 'u' + hex + '@' + EMAIL_DOMAIN;
  }

  function userFromSession(s) {
    if (!s || !s.user) return null;
    const meta = s.user.user_metadata || {};
    // 이름+비밀번호 계정은 display_name, 구글 계정은 구글이 채워주는 full_name/name을 쓴다
    const name = meta.display_name || meta.full_name || meta.name || (s.user.email || '').split('@')[0];
    return { name, id: s.user.id };
  }

  // 현재 사용자의 전체 기록을 읽어 메모리 캐시에 적재. RLS가 본인 행만 돌려준다.
  async function hydrate() {
    cache = {};
    if (!session) return;
    const { data, error } = await client()
      .from('game_records')
      .select('game_id, time_sec, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[fsg] 기록 불러오기 실패', error);
      UI.toast('기록을 불러오지 못했습니다.', 'error', 2600);
      return;
    }
    (data || []).forEach(row => {
      (cache[row.game_id] = cache[row.game_id] || []).push({
        timeSec: row.time_sec,
        at: new Date(row.created_at).getTime(),
      });
    });
  }

  // 이 브라우저 localStorage에 남아 있던 기존 기록을 계정으로 1회 옮긴다.
  async function migrateLegacy(name, userId) {
    const marker = 'fsg.migrated.' + userId;
    if (localStorage.getItem(marker)) return;

    let hist;
    try { hist = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || '{}'); }
    catch { hist = {}; }

    const rows = [];
    Object.keys(hist).forEach(key => {
      // 키 형식은 "이름:게임ID". 게임ID에도 콜론이 들어갈 수 있어(write:...) 첫 콜론만 자른다.
      const sep = key.indexOf(':');
      if (sep < 0 || key.slice(0, sep) !== name) return;
      const gameId = key.slice(sep + 1);
      (hist[key] || []).forEach(r => {
        if (typeof r.timeSec !== 'number') return;
        rows.push({
          user_id: userId,
          game_id: gameId,
          time_sec: Math.max(0, Math.round(r.timeSec)),
          created_at: new Date(r.at || Date.now()).toISOString(),
        });
      });
    });

    if (rows.length === 0) { localStorage.setItem(marker, '1'); return; }

    const { error } = await client().from('game_records').insert(rows);
    if (error) {
      console.error('[fsg] 기존 기록 이관 실패', error);
      return;   // 마커를 남기지 않아 다음 로그인 때 다시 시도한다
    }
    localStorage.setItem(marker, '1');
    UI.toast(`이 브라우저에 있던 기록 ${rows.length}개를 계정으로 옮겼습니다.`, 'success', 2800);
  }

  window.Auth = {
    // 앱 부팅 시 저장된 세션을 복원하고 기록을 적재한다.
    async restore() {
      try {
        const { data } = await client().auth.getSession();
        session = data.session || null;
      } catch (e) {
        console.error('[fsg] 세션 복원 실패', e);
        session = null;
      }
      if (session) await hydrate();
      return userFromSession(session);
    },

    getUser() { return userFromSession(session); },

    async signIn(name, password) {
      name = (name || '').trim();
      if (!name) return { ok:false, reason:'이름을 입력해주세요.' };
      if (utf8Bytes(name).length > MAX_NAME_BYTES) return { ok:false, reason:'이름이 너무 깁니다. 한글 10자 이내로 입력해주세요.' };
      if (!password || password.length < 6) return { ok:false, reason:'비밀번호는 6자리 이상이어야 합니다.' };

      const email = nameToEmail(name);
      let auth;
      try { auth = client().auth; }
      catch (e) { return { ok:false, reason: e.message }; }

      // 1) 기존 계정으로 로그인 시도
      let { data, error } = await auth.signInWithPassword({ email, password });

      // 2) 계정이 없으면 자동 생성 — 기존의 "첫 로그인이 곧 가입" 동작을 유지한다
      if (error) {
        const signUp = await auth.signUp({
          email, password, options: { data: { display_name: name } },
        });
        if (signUp.error) {
          const msg = (signUp.error.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('already been registered')) {
            return { ok:false, reason:'비밀번호가 일치하지 않습니다.' };
          }
          return { ok:false, reason: signUp.error.message || '로그인에 실패했습니다.' };
        }
        if (!signUp.data.session) {
          return { ok:false, reason:'계정은 만들어졌지만 세션을 받지 못했습니다. Supabase의 이메일 확인 설정을 꺼야 합니다.' };
        }
        data = signUp.data;
      }

      session = data.session;
      await migrateLegacy(name, session.user.id);
      await hydrate();
      return { ok:true, session: { name } };
    },

    // 구글 로그인: Supabase OAuth로 구글에 다녀온다. 성공하면 이 페이지로 되돌아오고,
    // 돌아온 뒤의 세션 처리는 restore()가 맡는다.
    async signInWithGoogle() {
      try {
        const { error } = await client().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: location.origin + location.pathname },
        });
        if (error) return { ok:false, reason: error.message || '구글 로그인에 실패했습니다.' };
        return { ok:true, redirecting:true };
      } catch (e) {
        return { ok:false, reason: e.message || '구글 로그인에 실패했습니다.' };
      }
    },

    async signOut() {
      try { await client().auth.signOut(); }
      catch (e) { console.error('[fsg] 로그아웃 실패', e); }
      session = null;
      cache = {};
    },
  };

  // 게임 기록: 읽기는 메모리 캐시(동기), 쓰기는 캐시를 먼저 갱신하고 서버 반영은 백그라운드
  window.Records = {
    // 해당 게임의 전체 히스토리 배열 반환 (최신 → 과거)
    listFor(userName, gameId) {
      return cache[gameId] || [];
    },
    // 최고 기록 반환 (가장 짧은 시간)
    best(userName, gameId) {
      const list = this.listFor(userName, gameId);
      if (list.length === 0) return null;
      return list.reduce((b, r) => (!b || r.timeSec < b.timeSec) ? r : b, null);
    },
    // 새 결과를 최신으로 추가
    save(userName, gameId, timeSec) {
      const list = cache[gameId] || (cache[gameId] = []);
      const prevBest = list.reduce((b, r) => (!b || r.timeSec < b.timeSec) ? r : b, null);
      const record = { timeSec, at: Date.now() };
      list.unshift(record);

      const uid = session && session.user.id;
      if (uid) {
        client().from('game_records')
          .insert({ user_id: uid, game_id: gameId, time_sec: Math.max(0, Math.round(timeSec)) })
          .then(({ error }) => {
            if (error) {
              console.error('[fsg] 기록 저장 실패', error);
              UI.toast('기록을 서버에 저장하지 못했습니다.', 'error', 2800);
            }
          }, e => console.error('[fsg] 기록 저장 실패', e));
      }
      return { improved: !prevBest || timeSec < prevBest.timeSec, record, prevBest };
    },
    clear(userName, gameId) {
      cache[gameId] = [];
      const uid = session && session.user.id;
      if (uid) {
        client().from('game_records').delete().eq('user_id', uid).eq('game_id', gameId)
          .then(({ error }) => {
            if (error) {
              console.error('[fsg] 기록 삭제 실패', error);
              UI.toast('서버에서 기록을 지우지 못했습니다.', 'error', 2800);
            }
          }, e => console.error('[fsg] 기록 삭제 실패', e));
      }
    },
  };
})();
