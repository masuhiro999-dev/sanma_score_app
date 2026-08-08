// ==========================================
// Application State & Data Management (Firebase Cloud Synchronized)
// ==========================================

const PLAYERS = ["渡邊", "増田", "神山", "坂田", "ゲスト"];
const STORAGE_KEY_GAMES = "sanma_game_results_v1";
const STORAGE_KEY_PAST = "sanma_past_data_v1";

// Firebase Configuration (Google Firebaseで取得した設定情報をここに貼り付けます)
const firebaseConfig = {
  databaseURL: "https://sanma-score-app-c7e1f-default-rtdb.firebaseio.com"//

  // apiKey: "...",
  // databaseURL: "...",
};

let dbRefGames = null;
let dbRefPast = null;
let dbRefDraft = null;
let isCloudActive = false;

let pastData = {
  "渡邊": 0,
  "増田": 0,
  "神山": 0,
  "坂田": 0,
  "ゲスト": 0
};

let gameResults = [];
let currentDraft = {
  selectedPlayers: [],
  scores: {}
};

// Initialize Data & Cloud Realtime Listener
function initData() {
  // Local fallback initial
  const storedPast = localStorage.getItem(STORAGE_KEY_PAST);
  if (storedPast) pastData = JSON.parse(storedPast);

  const storedGames = localStorage.getItem(STORAGE_KEY_GAMES);
  if (storedGames) gameResults = JSON.parse(storedGames);

  // Initialize Firebase if config exists
  if (typeof firebase !== "undefined" && firebaseConfig.databaseURL) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      const db = firebase.database();
      dbRefGames = db.ref("gameResults");
      dbRefPast = db.ref("pastData");
      dbRefDraft = db.ref("currentDraft");
      isCloudActive = true;

      // リアルタイムリスナー (対局全般データ更新時)
      dbRefGames.on("value", (snapshot) => {
        const val = snapshot.val();
        gameResults = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(gameResults));
        refreshAllScreens();
      });

      // リアルタイムリスナー (過去累計点数更新時)
      dbRefPast.on("value", (snapshot) => {
        const val = snapshot.val();
        if (val) {
          pastData = val;
          localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastData));
          renderPastDataForm();
          refreshAllScreens();
        }
      });

      // リアルタイムリスナー (各自のスマホ入力・対局選択状態の同期)
      dbRefDraft.on("value", (snapshot) => {
        const val = snapshot.val();
        if (val) {
          syncDraftFromCloud(val);
        }
      });

      console.log("Firebase Realtime Database Connected!");
    } catch (e) {
      console.warn("Firebase initialization skipped or failed:", e);
    }
  }
}

// クラウドからのドラフト（対局中データ）同期
function syncDraftFromCloud(draftData) {
  if (!draftData) return;

  // 1. 保存完了などでドラフトが空（クリア）になった場合 ➔ 全員のスマホの入力欄を完全リセット！
  if (!draftData.scores || Object.keys(draftData.scores).length === 0) {
    selectedPlayers.forEach(p => {
      const inputEl = document.getElementById(`score_input_${p}`);
      const badge = document.getElementById(`badge_${p}`);
      const toggleBtn = document.querySelector(`.btn-sign-toggle[data-player="${p}"]`);

      if (inputEl) {
        inputEl.value = "";
        inputEl.style.color = "var(--text-main)";
      }
      if (badge) {
        badge.textContent = "入力欄";
        badge.className = "role-badge inputter";
      }
      if (toggleBtn) {
        toggleBtn.textContent = "-";
        toggleBtn.classList.remove("plus");
      }
    });
    hideError();
    return;
  }

  // 2. 参加プレイヤーの同期
  if (Array.isArray(draftData.selectedPlayers)) {
    const isSame = selectedPlayers.length === draftData.selectedPlayers.length &&
      selectedPlayers.every((val, index) => val === draftData.selectedPlayers[index]);
    
    if (!isSame) {
      selectedPlayers = draftData.selectedPlayers;
      renderPlayerSelection();
      updateScoreInputArea();
    }
  }

  // 3. 入力点数の同期 (受信側で勝手なマイナス化・符号反転は一切行わない)
  if (draftData.scores && selectedPlayers.length === 3) {
    selectedPlayers.forEach(p => {
      const inputEl = document.getElementById(`score_input_${p}`);
      const toggleBtn = document.querySelector(`.btn-sign-toggle[data-player="${p}"]`);
      const val = draftData.scores[p];

      if (inputEl && val !== undefined && val !== null && val !== "") {
        // 他の人のスマホ画面に正確な値をセット (入力中の本人以外)
        if (document.activeElement !== inputEl) {
          inputEl.value = val;
          inputEl.style.color = (draftData.topPlayer === p) ? "var(--accent-gold)" : "var(--text-main)";
          
          if (toggleBtn) {
            if (String(val).startsWith("+") || Number(val) > 0) {
              toggleBtn.textContent = "+";
              toggleBtn.classList.add("plus");
            } else {
              toggleBtn.textContent = "-";
              toggleBtn.classList.remove("plus");
            }
          }
        }
      } else if (inputEl && (val === "" || val === null)) {
        if (document.activeElement !== inputEl) {
          inputEl.value = "";
          inputEl.style.color = "var(--text-main)";
        }
      }

      // バッジ状態の更新
      const badge = document.getElementById(`badge_${p}`);
      if (badge) {
        if (draftData.topPlayer === p) {
          badge.innerHTML = "👑 トップ";
          badge.className = "role-badge top";
        } else {
          badge.textContent = "入力者";
          badge.className = "role-badge inputter";
        }
      }
    });
  }
}

// 自分の入力・計算結果をクラウドへリアルタイム送信
function broadcastDraftChange(topPlayerName = null) {
  if (!isCloudActive || !dbRefDraft) return;

  const scores = {};
  selectedPlayers.forEach(p => {
    const inputEl = document.getElementById(`score_input_${p}`);
    if (inputEl) {
      scores[p] = inputEl.value;
    }
  });

  dbRefDraft.set({
    selectedPlayers: selectedPlayers,
    scores: scores,
    topPlayer: topPlayerName,
    timestamp: Date.now()
  });
}

function refreshAllScreens() {
  const activeTab = document.querySelector(".tab-content.active");
  if (activeTab) {
    if (activeTab.id === "tab-dashboard") renderDashboard();
    if (activeTab.id === "tab-database") {
      renderDatabase();
      renderPastDataForm();
    }
  }
}

function saveGameResults() {
  localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(gameResults));
  if (isCloudActive && dbRefGames) {
    dbRefGames.set(gameResults);
  }
  // 保存成功時にドラフトをクリア
  if (isCloudActive && dbRefDraft) {
    dbRefDraft.set({
      selectedPlayers: selectedPlayers,
      scores: {},
      timestamp: Date.now()
    });
  }
}

function savePastDataState() {
  localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastData));
  if (isCloudActive && dbRefPast) {
    dbRefPast.set(pastData);
  }
}

// Helper: Toast notification
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// Format date YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// Tab Switching System
// ==========================================
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.getAttribute("data-tab");
      
      navItems.forEach(n => n.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      item.classList.add("active");
      document.getElementById(targetTab).classList.add("active");

      // Refresh screens when switching
      if (targetTab === "tab-dashboard") {
        renderDashboard();
      } else if (targetTab === "tab-database") {
        renderDatabase();
      }
    });
  });
}

// ==========================================
// 1. Input Screen Logic
// ==========================================
let selectedPlayers = [];

function renderPlayerSelection() {
  const grid = document.getElementById("playerSelectGrid");
  grid.innerHTML = "";

  PLAYERS.forEach(player => {
    const card = document.createElement("div");
    card.className = "player-checkbox-card";
    if (selectedPlayers.includes(player)) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <input type="checkbox" value="${player}" ${selectedPlayers.includes(player) ? 'checked' : ''}>
      <div>${player}</div>
    `;

    card.addEventListener("click", () => {
      if (selectedPlayers.includes(player)) {
        selectedPlayers = selectedPlayers.filter(p => p !== player);
      } else {
        if (selectedPlayers.length >= 3) {
          showToast("選択できるのは3名までです");
          return;
        }
        selectedPlayers.push(player);
      }
      renderPlayerSelection();
      updateScoreInputArea();
      broadcastDraftChange(); // プレイヤー選択状態をクラウド同期
    });

    grid.appendChild(card);
  });
}

function updateScoreInputArea() {
  const card = document.getElementById("scoreInputCard");
  const errorMsg = document.getElementById("validationError");
  if (errorMsg) errorMsg.style.display = "none";

  if (selectedPlayers.length !== 3) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  renderScoreInputRows();
}

function renderScoreInputRows() {
  const container = document.getElementById("scoreInputsContainer");
  container.innerHTML = "";

  selectedPlayers.forEach(player => {
    const row = document.createElement("div");
    row.className = "score-row";

    row.innerHTML = `
      <label>${player}</label>
      <div class="score-input-wrap">
        <button type="button" class="btn-sign-toggle" data-player="${player}" title="プラス/マイナス切り替え">-</button>
        <input type="text" id="score_input_${player}" class="player-score-input" data-player="${player}" placeholder="数字を入力" inputmode="decimal">
      </div>
      <span class="role-badge inputter" id="badge_${player}">入力欄</span>
    `;

    container.appendChild(row);
  });

  // ＋/ー 切り替えボタンのイベントリスナー
  selectedPlayers.forEach(player => {
    const toggleBtn = container.querySelector(`.btn-sign-toggle[data-player="${player}"]`);
    const inputEl = document.getElementById(`score_input_${player}`);

    if (toggleBtn && inputEl) {
      toggleBtn.addEventListener("click", () => {
        let val = inputEl.value.trim();
        if (val.startsWith("+")) {
          inputEl.value = val.substring(1);
          toggleBtn.textContent = "-";
          toggleBtn.classList.remove("plus");
        } else if (val.startsWith("-")) {
          inputEl.value = "+" + val.substring(1);
          toggleBtn.textContent = "+";
          toggleBtn.classList.add("plus");
        } else if (val !== "") {
          inputEl.value = "+" + val;
          toggleBtn.textContent = "+";
          toggleBtn.classList.add("plus");
        } else {
          if (toggleBtn.textContent === "-") {
            toggleBtn.textContent = "+";
            toggleBtn.classList.add("plus");
          } else {
            toggleBtn.textContent = "-";
            toggleBtn.classList.remove("plus");
          }
        }
        broadcastDraftChange(); // 符号トグル切替をクラウドへリアルタイム同期
      });

      // 自分の打鍵入力時にクラウドへリアルタイム同期
      inputEl.addEventListener("input", () => {
        const val = inputEl.value.trim();
        if (val.startsWith("+")) {
          toggleBtn.textContent = "+";
          toggleBtn.classList.add("plus");
        } else {
          toggleBtn.textContent = "-";
          toggleBtn.classList.remove("plus");
        }
        broadcastDraftChange(); // 打鍵をクラウドへリアルタイム同期
      });
    }
  });
}

// 点数の数値パース（確実に数値化）
// "+5"  ➔ +5 (プラス)
// "-25" ➔ -25 (マイナス)
// "25"  ➔ -25 (デフォルトマイナス)
function parseScoreValue(valStr) {
  if (valStr === null || valStr === undefined) return null;
  const str = String(valStr).trim();
  if (str === "") return null;

  // 明示的なプラス "+5" ➔ 必ず正の数
  if (str.startsWith("+")) {
    const rawNum = str.substring(1).trim();
    const num = Number(rawNum);
    return isNaN(num) ? null : Math.abs(num);
  }

  // 明示的なマイナス "-25" ➔ 必ず負の数
  if (str.startsWith("-")) {
    const rawNum = str.substring(1).trim();
    const num = Number(rawNum);
    return isNaN(num) ? null : -Math.abs(num);
  }

  // 符号なし "25" ➔ デフォルトで負の数
  const num = Number(str);
  if (isNaN(num)) return null;
  return num === 0 ? 0 : -Math.abs(num);
}

// 「計算」ボタン押下時
function calculateTopScore() {
  if (selectedPlayers.length !== 3) {
    showError("プレイヤーを3名選択してください");
    return false;
  }

  const filled = [];
  const empty = [];

  // トップの自動計算値を一度除外し、純粋な手動入力者2名を判定
  selectedPlayers.forEach(player => {
    const inputEl = document.getElementById(`score_input_${player}`);
    const badge = document.getElementById(`badge_${player}`);
    const rawVal = inputEl ? inputEl.value.trim() : "";

    // 既に「👑 トップ」バッジが付いている、または手動入力されていない項目は未入力(empty)扱いにする
    const isAlreadyTop = badge && badge.classList.contains("top");

    if (rawVal !== "" && !isAlreadyTop) {
      const parsedVal = parseScoreValue(rawVal);
      if (parsedVal !== null) {
        inputEl.value = parsedVal;
        filled.push({ player, val: parsedVal });
      } else {
        empty.push(player);
      }
    } else {
      empty.push(player);
    }
  });

  // 1. パターン1: 2名の手動入力があり、1名が未入力（または前回トップ） ➔ 正確にトップを自動計算 ( Top = 0 - (A + B) )
  if (filled.length === 2 && empty.length === 1) {
    const topPlayer = empty[0];
    const sumOthers = filled[0].val + filled[1].val;
    const topScore = 0 - sumOthers; // 例: -15 と -10 ➔ 0 - (-25) = +25

    const topInput = document.getElementById(`score_input_${topPlayer}`);
    const topBadge = document.getElementById(`badge_${topPlayer}`);

    if (topInput && topBadge) {
      topInput.value = topScore;
      topInput.style.color = "var(--accent-gold)";
      topBadge.innerHTML = "👑 トップ";
      topBadge.className = "role-badge top";
    }

    filled.forEach(f => {
      const b = document.getElementById(`badge_${f.player}`);
      if (b) {
        b.textContent = "入力者";
        b.className = "role-badge inputter";
      }
    });

    hideError();
    showToast(`トップ(${topPlayer})の点数を ${topScore > 0 ? '+' + topScore : topScore} と計算しました`);
    broadcastDraftChange(topPlayer); // トッププレイヤー情報を添えて全端末に同期！
    return true;
  } 
  // 2. パターン2: 3名とも手動入力済み ➔ 合計0の検証
  else if (filled.length === 3) {
    const total = filled.reduce((acc, curr) => acc + curr.val, 0);
    if (total === 0) {
      hideError();
      showToast("合計0点を確認しました");
      broadcastDraftChange();
      return true;
    } else {
      showError(`現在の合計が ${total > 0 ? '+' + total : total} になっています。合計が0になるよう修正してください。`);
      return false;
    }
  } else {
    showError("点数を2名分入力した状態で「計算」ボタンを押してください。");
    return false;
  }
}

// 「保存」ボタン押下時
function handleSaveGame() {
  if (selectedPlayers.length !== 3) {
    showError("プレイヤーを3名選択してください");
    return;
  }

  let totalCheck = 0;
  let missingCount = 0;
  const currentScores = {};

  selectedPlayers.forEach(p => {
    const inputEl = document.getElementById(`score_input_${p}`);
    const rawVal = inputEl ? inputEl.value.trim() : "";
    
    if (rawVal === "" || isNaN(rawVal)) {
      missingCount++;
    } else {
      const num = Number(rawVal);
      currentScores[p] = num;
      totalCheck += num;
    }
  });

  if (missingCount > 0) {
    showError("点数が未入力の項目があります。2名分入力して「計算」ボタンを押してください。");
    return;
  }

  // 純粋な数値の単純足し算で0かどうかを検証！
  if (Math.round(totalCheck * 100) !== 0) {
    showError(`合計点数が0になりません (現在の合計: ${totalCheck > 0 ? '+' + totalCheck : totalCheck})。点数を確認してください。`);
    return;
  }

  const dateVal = document.getElementById("currentDateInput").value || getTodayString();
  const sameDateGames = gameResults.filter(g => g.Date === dateVal);
  const gameId = sameDateGames.length + 1;

  const newRecord = {
    Date: dateVal,
    Game_ID: gameId,
    "渡邊": null,
    "増田": null,
    "神山": null,
    "坂田": null,
    "ゲスト": null
  };

  selectedPlayers.forEach(p => {
    newRecord[p] = currentScores[p];
  });

  gameResults.push(newRecord);
  saveGameResults();
  showToast(`第${gameId}局のデータを保存しました`);

  // 入力欄をクリア
  selectedPlayers.forEach(p => {
    const el = document.getElementById(`score_input_${p}`);
    if (el) {
      el.value = "";
      el.style.color = "var(--text-main)";
    }
  });
  renderScoreInputRows();
}

function showError(text) {
  const errorMsg = document.getElementById("validationError");
  if (errorMsg) {
    errorMsg.textContent = text;
    errorMsg.style.display = "block";
  }
}

function hideError() {
  const errorMsg = document.getElementById("validationError");
  if (errorMsg) {
    errorMsg.style.display = "none";
  }
}



function showError(text) {
  const errorMsg = document.getElementById("validationError");
  errorMsg.textContent = text;
  errorMsg.style.display = "block";
}

function hideError() {
  const errorMsg = document.getElementById("validationError");
  errorMsg.style.display = "none";
}

// ==========================================
// 2. Dashboard Screen Logic
// ==========================================
function renderDashboard() {
  const currentDate = document.getElementById("currentDateInput").value || getTodayString();
  document.getElementById("dashboardDateBadge").textContent = currentDate;

  const dayGames = gameResults.filter(g => g.Date === currentDate);
  
  // Aggregation per player
  const stats = {};
  PLAYERS.forEach(p => {
    stats[p] = {
      dayScore: 0,
      topCount: 0,       // 当日のみのトップ回数
      tobiCount: 0,      // 当日のみの飛び回数
      totalScoreAllTime: pastData[p] || 0
    };
  });

  // Calculate day stats (day-only for top/tobi) & all-time total score
  gameResults.forEach(g => {
    const isToday = (g.Date === currentDate);

    // 1. 各プレイヤーのスコア加算 ＆ 飛び回数判定
    PLAYERS.forEach(p => {
      const val = g[p];
      if (val !== null && val !== undefined && val !== "") {
        const num = Number(val);
        stats[p].totalScoreAllTime += num;

        if (isToday) {
          stats[p].dayScore += num;
          // 当日のみの飛び回数 ( -31 点以下 )
          if (num <= -31) {
            stats[p].tobiCount += 1;
          }
        }
      }
    });

    // 2. 当日の対局のみでトップ回数を集計
    if (isToday) {
      let maxScore = -Infinity;
      let topP = null;
      PLAYERS.forEach(p => {
        if (g[p] !== null && g[p] !== undefined && g[p] !== "") {
          if (Number(g[p]) > maxScore) {
            maxScore = Number(g[p]);
            topP = p;
          }
        }
      });
      if (topP && maxScore !== -Infinity) {
        stats[topP].topCount += 1;
      }
    }
  });

  // Render Stat Cards
  // 順序: プレイヤー名 -> 当日の金額(大) -> 当日の点数(標準) -> 過去累計金額 -> トップ/飛び
  const cardsContainer = document.getElementById("playerStatCards");
  cardsContainer.innerHTML = "";

  PLAYERS.forEach(p => {
    const dayScore = stats[p].dayScore;
    const dayMoney = dayScore * 100;
    const totalMoney = stats[p].totalScoreAllTime * 100;

    // カラー判定 (プラス: 青, マイナス: ローズ, 0: 見やすいライトシルバーグレー)
    const moneyColor = dayMoney > 0 ? '#60a5fa' : dayMoney < 0 ? '#f472b6' : '#cbd5e1';
    const scoreColor = dayScore > 0 ? '#60a5fa' : dayScore < 0 ? '#f472b6' : '#cbd5e1';

    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="player-name">${p}</div>
      <div class="day-money-large" style="color: ${moneyColor}">
        ${dayMoney > 0 ? '+' : ''}${dayMoney.toLocaleString()}円
      </div>
      <div class="day-score-sub" style="color: ${scoreColor}">
        ${dayScore > 0 ? '+' : ''}${dayScore}点
      </div>
      <div class="total-money">累計: ${totalMoney > 0 ? '+' : ''}${totalMoney.toLocaleString()}円</div>
      <div class="badge-counts">
        <span class="count-badge top-count">Top: ${stats[p].topCount}</span>
        <span class="count-badge tobi-count">飛: ${stats[p].tobiCount}</span>
      </div>
    `;
    cardsContainer.appendChild(card);
  });

  // Render Day Results Table (第1局から上に積み上がる降順：最新局が最上部)
  const tbody = document.querySelector("#dashboardTable tbody");
  tbody.innerHTML = "";

  if (dayGames.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: var(--text-muted); padding: 20px;">本日の対局データはありません</td></tr>`;
    return;
  }

  // Game_ID降順ソート
  const sortedDayGames = [...dayGames].sort((a, b) => b.Game_ID - a.Game_ID);

  sortedDayGames.forEach(g => {
    const tr = document.createElement("tr");

    // Find highest score in this game
    let maxVal = -Infinity;
    PLAYERS.forEach(p => {
      if (g[p] !== null && g[p] !== undefined && g[p] !== "") {
        if (Number(g[p]) > maxVal) maxVal = Number(g[p]);
      }
    });

    let cellsHtml = `<td>第${g.Game_ID}局</td>`;
    PLAYERS.forEach(p => {
      const val = g[p];
      if (val === null || val === undefined || val === "") {
        cellsHtml += `<td class="cell-empty">-</td>`;
      } else {
        const num = Number(val);
        let cellClass = "";
        if (num === maxVal) cellClass = "cell-top";
        else if (num <= -31) cellClass = "cell-tobi";

        cellsHtml += `<td class="${cellClass}">${num > 0 ? '+' + num : num}</td>`;
      }
    });

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 3. Database Screen & Past Data Logic
// ==========================================
function renderDatabase() {
  const tbody = document.querySelector("#databaseTable tbody");
  tbody.innerHTML = "";

  if (gameResults.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="color: var(--text-muted); padding: 20px;">登録データがありません</td></tr>`;
    return;
  }

  // Sort descending by Date & Game_ID
  const sorted = [...gameResults].sort((a, b) => {
    if (a.Date !== b.Date) return b.Date.localeCompare(a.Date);
    return b.Game_ID - a.Game_ID;
  });

  sorted.forEach((g) => {
    const originalIndex = gameResults.indexOf(g);
    const tr = document.createElement("tr");

    let cellsHtml = `<td>${g.Date}</td><td>第${g.Game_ID}局</td>`;

    PLAYERS.forEach(p => {
      const val = g[p];
      const displayVal = (val === null || val === undefined || val === "") ? "-" : val;
      cellsHtml += `
        <td class="editable-cell" data-index="${originalIndex}" data-player="${p}">
          ${displayVal}
        </td>
      `;
    });

    cellsHtml += `
      <td>
        <button type="button" class="btn btn-secondary" onclick="deleteGameRecord(${originalIndex})" style="padding: 2px 6px; font-size: 0.75rem; color: #ef4444;">削除</button>
      </td>
    `;

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });

  // Attach Inline Edit Events
  document.querySelectorAll(".editable-cell").forEach(cell => {
    cell.addEventListener("click", function() {
      if (this.querySelector("input")) return; // already editing

      const index = this.getAttribute("data-index");
      const player = this.getAttribute("data-player");
      const currentVal = gameResults[index][player];

      const input = document.createElement("input");
      input.type = "number";
      input.value = currentVal === null ? "" : currentVal;

      this.innerHTML = "";
      this.appendChild(input);
      input.focus();

      const saveInlineEdit = () => {
        const newVal = input.value.trim();
        if (newVal === "") {
          gameResults[index][player] = null;
        } else {
          gameResults[index][player] = Number(newVal);
        }
        saveGameResults();
        renderDatabase();
        showToast("点数を更新しました");
      };

      input.addEventListener("blur", saveInlineEdit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveInlineEdit();
      });
    });
  });
}

function deleteGameRecord(index) {
  if (confirm("この対局データを削除してもよろしいですか？")) {
    gameResults.splice(index, 1);
    saveGameResults();
    renderDatabase();
    showToast("データを削除しました");
  }
}

function exportCsv() {
  if (gameResults.length === 0) {
    showToast("エクスポートするデータがありません");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM
  csvContent += "開催日,開催局番号,渡邊,増田,神山,坂田,ゲスト\n";

  gameResults.forEach(g => {
    const row = [
      g.Date,
      g.Game_ID,
      g["渡邊"] ?? "",
      g["増田"] ?? "",
      g["神山"] ?? "",
      g["坂田"] ?? "",
      g["ゲスト"] ?? ""
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Sanma_Score_Game_Results_${getTodayString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Past Data Accordion & Form
function initPastDataSection() {
  const header = document.getElementById("pastDataAccordionHeader");
  const content = document.getElementById("pastDataAccordionContent");
  const icon = document.getElementById("accordionIcon");

  header.addEventListener("click", () => {
    const isOpen = content.classList.contains("open");
    if (isOpen) {
      content.classList.remove("open");
      icon.textContent = "▼";
    } else {
      content.classList.add("open");
      icon.textContent = "▲";
    }
  });

  renderPastDataForm();

  document.getElementById("btnSavePastData").addEventListener("click", () => {
    PLAYERS.forEach(p => {
      const val = document.getElementById(`past_input_${p}`).value;
      pastData[p] = val === "" ? 0 : Number(val);
    });
    savePastDataState();
    showToast("過去累計データを保存しました");
  });
}

function renderPastDataForm() {
  const form = document.getElementById("pastDataForm");
  form.innerHTML = "";

  PLAYERS.forEach(p => {
    const field = document.createElement("div");
    field.className = "past-data-field";
    field.innerHTML = `
      <label>${p}</label>
      <input type="number" id="past_input_${p}" value="${pastData[p] || 0}">
    `;
    form.appendChild(field);
  });
}

// ==========================================
// Initialization & Event Listeners
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initData();

  // Set default date to today
  const dateInput = document.getElementById("currentDateInput");
  dateInput.value = getTodayString();
  dateInput.addEventListener("change", () => {
    renderDashboard();
  });

  initNavigation();
  renderPlayerSelection();
  initPastDataSection();

  // Buttons on Input Screen
  document.getElementById("btnCalc").addEventListener("click", calculateTopScore);
  document.getElementById("btnSave").addEventListener("click", handleSaveGame);

  // Button on Database Screen
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
});
