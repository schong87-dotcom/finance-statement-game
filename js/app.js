// 라우팅 및 화면 렌더링: 로그인 / 모드 선택 / 게임 선택 / 개별 게임
(function(){
  const root = document.getElementById('root');
  let activeView = null; // 'drag' | 'write' | null

  function cleanupActive() {
    if (activeView === 'drag' && window.GameView) window.GameView.cleanup();
    if (activeView === 'write' && window.WritingView) window.WritingView.cleanup();
    activeView = null;
  }

  // --- 로그인 화면 ---
  function renderLogin() {
    root.innerHTML = `
      <div class="min-h-screen flex items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <div class="flex flex-col items-center mb-6">
            <div class="w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center text-white mb-3">
              ${UI.icon('chartApp','w-9 h-9')}
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-gray-900">재무제표 학습 게임</h1>
            <p class="text-sm text-gray-500 mt-1">이름과 비밀번호 또는 구글 계정으로 시작하세요</p>
          </div>

          <div class="bg-white rounded-2xl shadow-xl ring-1 ring-gray-100 overflow-hidden">
            <div class="border-b border-gray-100">
              <div class="px-6 pt-5 pb-3">
                <div class="inline-block text-sm font-bold text-blue-600 pb-2 border-b-2 border-blue-600">로그인</div>
              </div>
            </div>

            <form id="login-form" class="p-6 space-y-4" novalidate>
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1.5">이름</label>
                <input id="inp-name" type="text" autocomplete="username" placeholder="한글 이름 입력"
                  class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호</label>
                <div class="relative">
                  <input id="inp-pwd" type="password" autocomplete="current-password" placeholder="6자리 이상"
                    class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all" />
                  <button type="button" id="btn-pwd-toggle" tabindex="-1"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700 rounded-md">
                    ${UI.icon('eye','w-4 h-4')}
                  </button>
                </div>
              </div>

              <button type="submit"
                class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2.5 rounded-lg shadow-sm shadow-blue-200 transition-all">
                로그인
              </button>
            </form>

            <div class="px-6 pb-6">
              <div class="flex items-center gap-3">
                <div class="flex-1 h-px bg-gray-200"></div>
                <span class="text-[11px] text-gray-400">또는</span>
                <div class="flex-1 h-px bg-gray-200"></div>
              </div>
              <div id="google-btn" class="mt-4 flex justify-center"></div>
              <p id="google-hint" class="hidden text-center text-[11px] text-gray-400 mt-2"></p>
            </div>
          </div>

          <p class="text-center text-[11px] text-gray-400 mt-5">
            ※ 최초 로그인 시 자동으로 계정이 생성됩니다
          </p>
        </div>
      </div>
    `;

    const form = document.getElementById('login-form');
    const nameInp = document.getElementById('inp-name');
    const pwdInp = document.getElementById('inp-pwd');
    const toggleBtn = document.getElementById('btn-pwd-toggle');

    toggleBtn.addEventListener('click', () => {
      const isPwd = pwdInp.type === 'password';
      pwdInp.type = isPwd ? 'text' : 'password';
      toggleBtn.innerHTML = UI.icon(isPwd ? 'eyeOff' : 'eye', 'w-4 h-4');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = Auth.signIn(nameInp.value, pwdInp.value);
      if (!res.ok) {
        UI.toast(res.reason, 'error');
        return;
      }
      UI.toast('환영합니다, ' + res.session.name + '님!', 'success', 1200);
      setTimeout(() => goto('mode'), 300);
    });

    setupGoogleLogin();
    setTimeout(() => nameInp.focus(), 50);
  }

  // ID 토큰(JWT)의 payload를 디코딩 (base64url → UTF-8 JSON)
  function decodeJwtPayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch { return null; }
  }

  // 구글 로그인 버튼 초기화 (GIS 스크립트가 늦게 로드될 수 있어 폴링)
  function setupGoogleLogin() {
    const btnHost = document.getElementById('google-btn');
    const hint = document.getElementById('google-hint');
    const showHint = (msg) => { hint.textContent = msg; hint.classList.remove('hidden'); };

    if (!window.GOOGLE_CLIENT_ID) {
      showHint('구글 로그인을 사용하려면 index.html의 GOOGLE_CLIENT_ID를 설정하세요.');
      return;
    }
    if (location.protocol === 'file:') {
      showHint('구글 로그인은 로컬 파일 모드에서 동작하지 않습니다. http 서버로 실행해주세요.');
      return;
    }

    let tries = 0;
    (function init() {
      if (!(window.google && google.accounts && google.accounts.id)) {
        if (++tries < 50) return setTimeout(init, 100);
        showHint('구글 로그인 스크립트를 불러오지 못했습니다.');
        return;
      }
      google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID,
        callback: (resp) => {
          const payload = decodeJwtPayload(resp.credential);
          const res = Auth.signInWithGoogle({ name: payload && payload.name, email: payload && payload.email });
          if (!res.ok) {
            UI.toast(res.reason, 'error');
            return;
          }
          UI.toast('환영합니다, ' + res.session.name + '님!', 'success', 1200);
          setTimeout(() => goto('mode'), 300);
        },
      });
      google.accounts.id.renderButton(btnHost, {
        theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'ko', width: 300,
      });
    })();
  }

  // 모드별 모든 게임의 총 기록 횟수와 최고 기록을 합산
  function modeAggregateStats(userName, mode) {
    let total = 0;
    let bestSec = null;
    window.GAME_ORDER.forEach(baseId => {
      const id = mode === 'write' ? window.writeGameId(baseId) : baseId;
      const list = Records.listFor(userName, id);
      total += list.length;
      const best = Records.best(userName, id);
      if (best && (bestSec === null || best.timeSec < bestSec)) bestSec = best.timeSec;
    });
    return { total, bestSec };
  }

  // --- 모드 선택 화면 ---
  function renderModes() {
    const user = Auth.getUser();
    if (!user) return goto('login');

    root.innerHTML = `
      <div class="min-h-screen bg-app flex flex-col">
        <header class="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-20">
          <div class="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">${UI.icon('chartApp','w-5 h-5')}</div>
              <div class="font-bold text-sm sm:text-base text-gray-800 truncate">재무제표 학습 게임</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs sm:text-sm text-gray-600 truncate max-w-[120px]">${user.name}</span>
              <button id="btn-logout" class="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-red-600 transition-colors">
                ${UI.icon('logout','w-4 h-4')}<span class="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </header>

        <main class="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 py-6 sm:py-10">
          <div class="text-center mb-6 sm:mb-8">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-gray-900">게임 모드를 선택하세요</h1>
            <p class="text-sm text-gray-500 mt-1">두 가지 방식으로 같은 재무제표를 익혀볼 수 있어요</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            ${window.MODE_ORDER.map(modeId => {
              const m = window.GAME_MODES[modeId];
              const stats = modeAggregateStats(user.name, modeId);
              return `
                <button data-mode="${modeId}"
                        class="mode-card text-left bg-white rounded-2xl border-2 ${m.border} ${m.hoverBorder} hover:shadow-lg transition-all p-5 sm:p-6 flex flex-col gap-3 active:scale-[0.99]">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${m.bg} ${m.text} flex items-center justify-center shrink-0">
                      ${UI.icon(m.icon,'w-6 h-6 sm:w-7 sm:h-7')}
                    </div>
                    <div class="flex-1 min-w-0">
                      <h2 class="font-extrabold text-lg sm:text-xl text-gray-900">${m.title}</h2>
                      <p class="text-xs sm:text-sm text-gray-600 mt-0.5">${m.subtitle}</p>
                    </div>
                  </div>
                  <p class="text-[12px] sm:text-sm text-gray-500 leading-relaxed">${m.description}</p>
                  <div class="flex items-center justify-between text-[11px] sm:text-xs">
                    <span class="text-gray-400">손익계산서 · 재무상태표 1 · 재무상태표 2</span>
                    ${stats.total > 0 ? `
                      <span class="inline-flex items-center gap-1 font-bold ${m.text} ${m.border} border ${modeId==='drag'?'bg-blue-50':'bg-amber-50'} px-2 py-0.5 rounded-full">
                        ${UI.icon('trophy','w-3 h-3')} ${stats.bestSec!==null?UI.formatElapsed(stats.bestSec):''} · ${stats.total}회
                      </span>
                    ` : `
                      <span class="text-gray-300">기록 없음</span>
                    `}
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </main>
      </div>
    `;

    document.getElementById('btn-logout').addEventListener('click', () => {
      UI.modal({
        title: '로그아웃',
        message: '정말 로그아웃 하시겠어요?',
        buttons: [
          { label: '취소', variant:'secondary' },
          { label: '로그아웃', variant:'primary', onClick: () => { Auth.signOut(); goto('login'); } },
        ],
      });
    });

    document.querySelectorAll('.mode-card').forEach(el => {
      el.addEventListener('click', () => {
        goto('select', { mode: el.dataset.mode });
      });
    });
  }

  // --- 게임 선택 화면 (모드별) ---
  function renderSelect(mode) {
    const user = Auth.getUser();
    if (!user) return goto('login');
    const m = window.GAME_MODES[mode] || window.GAME_MODES.drag;

    root.innerHTML = `
      <div class="min-h-screen bg-app flex flex-col">
        <header class="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-20">
          <div class="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
            <button id="btn-back-mode" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border ${m.border} bg-white ${m.text} ${m.hoverBorder} font-semibold text-xs sm:text-sm transition-colors shrink-0">
              ${UI.icon('chevronLeft','w-4 h-4')}<span>모드</span>
            </button>
            <div class="flex items-center gap-2 min-w-0 flex-1 justify-center">
              <div class="w-7 h-7 rounded-lg ${m.bg} ${m.text} flex items-center justify-center shrink-0">${UI.icon(m.icon,'w-4 h-4')}</div>
              <div class="font-bold text-sm sm:text-base text-gray-800 truncate">${m.title}</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs sm:text-sm text-gray-600 truncate max-w-[100px] hidden sm:inline">${user.name}</span>
              <button id="btn-logout" class="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-red-600 transition-colors">
                ${UI.icon('logout','w-4 h-4')}<span class="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </header>

        <main class="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-8">
          <div class="text-center mb-5 sm:mb-7">
            <h1 class="text-xl sm:text-2xl font-extrabold text-gray-900">게임을 선택하세요</h1>
            <p class="text-sm text-gray-500 mt-1">${m.description}</p>
          </div>

          <div class="flex flex-col gap-3 sm:gap-4">
            ${window.GAME_ORDER.map(baseId => {
              const g = window.GAMES[baseId];
              const fullId = mode === 'write' ? window.writeGameId(baseId) : baseId;
              const tone = window.TONE[g.tone];
              const list = Records.listFor(user.name, fullId);
              const best = Records.best(user.name, fullId);
              const recent = list.slice(0, 3);
              return `
                <button data-game="${fullId}"
                        class="game-card text-left bg-white rounded-2xl border-2 ${tone.border} ${tone.hoverBorder} hover:shadow-lg transition-all p-4 sm:p-5 flex items-center gap-3 sm:gap-4 active:scale-[0.99]">
                  <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${tone.bg} ${tone.text} flex items-center justify-center shrink-0">
                    ${UI.icon(g.icon,'w-6 h-6 sm:w-7 sm:h-7')}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <h2 class="font-extrabold text-base sm:text-lg text-gray-900">${g.title}</h2>
                      ${best ? `<span class="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold ${tone.text} ${tone.softBg} border ${tone.border} px-2 py-0.5 rounded-full">
                        ${UI.icon('trophy','w-3 h-3')} 최고 ${UI.formatElapsed(best.timeSec)} · ${list.length}회
                      </span>` : ''}
                    </div>
                    <p class="text-xs sm:text-sm text-gray-600 mt-0.5 line-clamp-2">${g.subtitle}</p>
                    <div class="flex items-center gap-1 mt-2 flex-wrap">
                      ${g.preview.map(p => `<span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border ${tone.chip}">${p}</span>`).join('')}
                      <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500">+${g.items.length - g.preview.length}개</span>
                    </div>
                    ${recent.length ? `
                      <div class="mt-2 flex items-center gap-1 text-[11px] sm:text-xs text-gray-500 flex-wrap">
                        <span class="text-gray-400">최근:</span>
                        ${recent.map((r,i) => `<span class="tabular-nums ${i===0?'font-bold text-gray-700':''}">${UI.formatElapsed(r.timeSec)}</span>${i<recent.length-1?'<span class="text-gray-300">·</span>':''}`).join('')}
                      </div>` : ''}
                  </div>
                  <span class="text-gray-300 shrink-0">${UI.icon('chevronRight','w-5 h-5')}</span>
                </button>
              `;
            }).join('')}
          </div>
        </main>
      </div>
    `;

    document.getElementById('btn-back-mode').addEventListener('click', () => goto('mode'));
    document.getElementById('btn-logout').addEventListener('click', () => {
      UI.modal({
        title: '로그아웃',
        message: '정말 로그아웃 하시겠어요?',
        buttons: [
          { label: '취소', variant:'secondary' },
          { label: '로그아웃', variant:'primary', onClick: () => { Auth.signOut(); goto('login'); } },
        ],
      });
    });

    document.querySelectorAll('.game-card').forEach(el => {
      el.addEventListener('click', () => {
        goto('game', { id: el.dataset.game });
      });
    });
  }

  // --- 게임 화면 (모드 자동 분기) ---
  function openGame(id) {
    const parsed = window.parseGameId(id);
    if (parsed.mode === 'write') {
      activeView = 'write';
      return window.WritingView.render(id);
    }
    activeView = 'drag';
    return window.GameView.render(id);
  }

  // --- 라우터 ---
  function goto(view, params) {
    cleanupActive();
    if (view === 'login') return renderLogin();
    if (view === 'mode') return renderModes();
    if (view === 'select') return renderSelect((params && params.mode) || 'drag');
    if (view === 'game') return openGame(params && params.id);
  }

  window.App = { goto };

  document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.getUser();
    goto(user ? 'mode' : 'login');
  });
})();
