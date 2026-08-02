// ==========================================
// Application State & Data Management
// ==========================================

const PLAYERS = ["渡邊", "増田", "神山", "坂田", "ゲスト"];
const STORAGE_KEY_GAMES = "sanma_game_results_v1";
const STORAGE_KEY_PAST = "sanma_past_data_v1";

// Default initial data if not preset
let pastData = {
  "渡邊": 0,
  "増田": 0,
  "神山": 0,
  "坂田": 0,
  "ゲスト": 0
};

let gameResults = [];

// Initialize LocalStorage Data
function initData() {
  const storedPast = localStorage.getItem(STORAGE_KEY_PAST);
  if (storedPast) {
    pastData = JSON.parse(storedPast);
  } else {
    localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastData));
  }

  const storedGames = localStorage.getItem(STORAGE_KEY_GAMES);
  if (storedGames) {
    gameResults = JSON.parse(storedGames);
  } else {
    gameResults = [];
    localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(gameResults));
  }
}

function saveGameResults() {
  localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(gameResults));
}

function savePastDataState() {
  localStorage.setItem(STORAGE_KEY_PAST, JSON.stringify(pastData));
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
    });

    grid.appendChild(card);
  });
}

function updateScoreInputArea() {
  const card = document.getElementById("scoreInputCard");
  const errorMsg = document.getElementById("validationError");
  errorMsg.style.display = "none";

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
      <input type="number" id="score_input_${player}" class="player-score-input" data-player="${player}" placeholder="例: -30 (正の数で自動-)" step="any">
      <span class="role-badge inputter" id="badge_${player}">入力欄</span>
    `;

    container.appendChild(row);
  });

  // 自動マイナス補正 & 入力時自動計算イベント
  selectedPlayers.forEach(player => {
    const inputEl = document.getElementById(`score_input_${player}`);
    
    inputEl.addEventListener("blur", () => {
      const valStr = inputEl.value.trim();
      if (valStr !== "" && !isNaN(valStr)) {
        const num = Number(valStr);
        // プラスの数値が入力された場合、自動でマイナスにする (例: 35 -> -35)
        if (num > 0) {
          inputEl.value = -num;
        }
      }
      autoDetectAndCalculateTop();
    });

    inputEl.addEventListener("input", () => {
      autoDetectAndCalculateTop();
    });
  });
}

// 2名の点数が入力されたら、未入力の最後の1名をトップとして自動計算
function autoDetectAndCalculateTop() {
  if (selectedPlayers.length !== 3) return false;

  const filled = [];
  const empty = [];

  selectedPlayers.forEach(player => {
    const inputEl = document.getElementById(`score_input_${player}`);
    const val = inputEl ? inputEl.value.trim() : "";
    if (val !== "" && !isNaN(val)) {
      filled.push({ player, val: Number(val) });
    } else {
      empty.push(player);
    }
  });

  // リセット表示
  selectedPlayers.forEach(player => {
    const badge = document.getElementById(`badge_${player}`);
    const inputEl = document.getElementById(`score_input_${player}`);
    if (badge) {
      badge.textContent = "入力欄";
      badge.className = "role-badge inputter";
    }
    if (inputEl && inputEl.hasAttribute("data-auto-top")) {
      inputEl.removeAttribute("data-auto-top");
      inputEl.style.color = "var(--text-main)";
    }
  });

  // ちょうど2名が入力済みで、1名が未入力の場合に自動計算
  if (filled.length === 2 && empty.length === 1) {
    const topPlayer = empty[0];
    const sumOthers = filled[0].val + filled[1].val;
    const topScore = 0 - sumOthers;

    const topInput = document.getElementById(`score_input_${topPlayer}`);
    const topBadge = document.getElementById(`badge_${topPlayer}`);

    if (topInput && topBadge) {
      topInput.value = topScore;
      topInput.setAttribute("data-auto-top", "true");
      topInput.style.color = "var(--accent-gold)";
      topBadge.textContent = "トップ(自動)";
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
    return true;
  } else if (filled.length === 3) {
    const total = filled.reduce((acc, curr) => acc + curr.val, 0);
    if (total === 0) {
      hideError();
    } else {
      showError(`現在の合計: ${total > 0 ? '+' + total : total} (合計が0になりません)`);
    }
  }

  return false;
}

function calculateTopScore() {
  const isCalculated = autoDetectAndCalculateTop();
  if (!isCalculated) {
    const filledCount = selectedPlayers.filter(p => {
      const v = document.getElementById(`score_input_${p}`).value.trim();
      return v !== "" && !isNaN(v);
    }).length;

    if (filledCount < 2) {
      showError("2名の点数を入力してください。未入力の1名がトップとして自動計算されます。");
    }
  }
}

function handleSaveGame() {
  if (selectedPlayers.length !== 3) {
    showError("プレイヤーを3名選択してください");
    return;
  }

  autoDetectAndCalculateTop();

  let totalCheck = 0;
  let missingCount = 0;

  selectedPlayers.forEach(p => {
    const valStr = document.getElementById(`score_input_${p}`).value.trim();
    if (valStr === "" || isNaN(valStr)) {
      missingCount++;
    } else {
      totalCheck += Number(valStr);
    }
  });

  if (missingCount > 0) {
    showError("点数が未入力の項目があります。2名分入力するとトップが自動計算されます。");
    return;
  }

  if (totalCheck !== 0) {
    showError(`合計点数が0になりません (現在の合計: ${totalCheck})。点数を確認してください。`);
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
    newRecord[p] = Number(document.getElementById(`score_input_${p}`).value);
  });

  gameResults.push(newRecord);
  saveGameResults();
  showToast(`第${gameId}局のデータを保存しました`);

  // リセット
  selectedPlayers.forEach(p => {
    const el = document.getElementById(`score_input_${p}`);
    if (el) {
      el.value = "";
      el.removeAttribute("data-auto-top");
      el.style.color = "var(--text-main)";
    }
  });
  renderScoreInputRows();
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
      topCount: 0,
      tobiCount: 0,
      totalScoreAllTime: pastData[p] || 0
    };
  });

  // Calculate day stats & total score all time
  gameResults.forEach(g => {
    PLAYERS.forEach(p => {
      const val = g[p];
      if (val !== null && val !== undefined && val !== "") {
        const num = Number(val);
        stats[p].totalScoreAllTime += num;

        if (g.Date === currentDate) {
          stats[p].dayScore += num;
          if (num <= -31) {
            stats[p].tobiCount += 1;
          }
        }
      }
    });

    // Determine top for this game (among participating 3 players)
    if (g.Date === currentDate) {
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
      if (topP) {
        stats[topP].topCount += 1;
      }
    }
  });

  // Render Stat Cards
  const cardsContainer = document.getElementById("playerStatCards");
  cardsContainer.innerHTML = "";

  PLAYERS.forEach(p => {
    const dayScore = stats[p].dayScore;
    const dayMoney = dayScore * 100;
    const totalMoney = stats[p].totalScoreAllTime * 100;

    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="player-name">${p}</div>
      <div class="day-score" style="color: ${dayScore > 0 ? '#60a5fa' : dayScore < 0 ? '#f472b6' : 'var(--text-main)'}">
        ${dayScore > 0 ? '+' : ''}${dayScore}
      </div>
      <div class="day-money">${dayMoney > 0 ? '+' : ''}${dayMoney.toLocaleString()}円</div>
      <div class="total-money">通算: ${totalMoney > 0 ? '+' : ''}${totalMoney.toLocaleString()}円</div>
      <div class="badge-counts">
        <span class="count-badge top-count">Top: ${stats[p].topCount}</span>
        <span class="count-badge tobi-count">飛: ${stats[p].tobiCount}</span>
      </div>
    `;
    cardsContainer.appendChild(card);
  });

  // Render Day Results Table
  const tbody = document.querySelector("#dashboardTable tbody");
  tbody.innerHTML = "";

  if (dayGames.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: var(--text-muted); padding: 20px;">本日の対局データはありません</td></tr>`;
    return;
  }

  dayGames.forEach(g => {
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
