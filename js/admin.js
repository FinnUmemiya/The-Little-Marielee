/**
 * Admin dashboard for The Little Marielee whitelist.
 * Reads/deletes entries from Google Apps Script backend,
 * gated by an ADMIN_KEY that is checked server-side.
 */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx9CStngaeSCw6UP49Uf6RCMA5O96GmLyvu5m5kTIWMXD0NKtml8qvP2XsguYlBxHyN/exec";
const SESSION_KEY = "marielee_admin_session";

let allEntries = [];
let sortState = { field: "timestamp", dir: "desc" };

const gate = document.getElementById("gate");
const dashboard = document.getElementById("dashboard");
const inputKey = document.getElementById("input-key");
const btnUnlock = document.getElementById("btn-unlock");
const btnLogout = document.getElementById("btn-logout");
const btnRefresh = document.getElementById("btn-refresh");
const btnExport = document.getElementById("btn-export");
const searchInput = document.getElementById("search");
const tableBody = document.getElementById("table-body");
const toastEl = document.getElementById("toast");

// Settings elements
const formSettings = document.getElementById("form-settings");
const inputSupply = document.getElementById("set-supply");
const inputTwitter = document.getElementById("set-twitter");
const inputPost = document.getElementById("set-post");
const inputOpensea = document.getElementById("set-opensea");
const inputDiscord = document.getElementById("set-discord");
const inputTelegram = document.getElementById("set-telegram");
const btnSaveSettings = document.getElementById("btn-save-settings");
const settingsNotice = document.getElementById("settings-notice");
const btnToggleSettings = document.getElementById("btn-toggle-settings");
const settingsToggleText = document.getElementById("settings-toggle-text");

let currentSettings = {
  totalSupply: "2,222",
  twitterHandle: "MarieleeHQ",
  postUrl: "https://x.com",
  openseaUrl: "https://opensea.io/collection/thelittlemarielee/overview",
  discordUrl: "",
  telegramUrl: "",
};

document.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(() => document.body.classList.remove("is-loading"));

  // Load cached settings if available
  const savedSettings = localStorage.getItem("marielee_settings");
  if (savedSettings) {
    try {
      currentSettings = Object.assign({}, currentSettings, JSON.parse(savedSettings));
    } catch (e) {}
  }
  renderSettingsForm(currentSettings);

  const cachedKey = sessionStorage.getItem(SESSION_KEY);
  if (cachedKey) {
    unlock(cachedKey, true);
  }

  btnUnlock.addEventListener("click", () => unlock(inputKey.value.trim()));
  inputKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlock(inputKey.value.trim());
  });
  inputKey.addEventListener("input", () => {
    inputKey.classList.remove("has-error");
    document.getElementById("err-key").textContent = "";
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    dashboard.hidden = true;
    gate.hidden = false;
    inputKey.value = "";
    inputKey.focus();
  });

  btnRefresh.addEventListener("click", () => loadEntries(sessionStorage.getItem(SESSION_KEY)));
  btnExport.addEventListener("click", exportCsv);
  searchInput.addEventListener("input", renderTable);

  // Settings form handlers
  if (formSettings) {
    formSettings.addEventListener("submit", handleSaveSettings);
  }

  if (btnToggleSettings && formSettings) {
    btnToggleSettings.addEventListener("click", () => {
      const isCollapsed = formSettings.classList.toggle("is-collapsed");
      settingsToggleText.textContent = isCollapsed ? "Open Settings ▼" : "Collapse ▲";
    });
  }

  document.querySelectorAll("[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (sortState.field === field) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState = { field, dir: "asc" };
      }
      updateSortArrows();
      renderTable();
    });
  });
});

async function unlock(key, silent = false) {
  if (!key) {
    showFieldErr("Please enter the admin key.");
    return;
  }

  btnUnlock.classList.add("is-loading");
  btnUnlock.disabled = true;

  const result = await loadEntries(key);

  btnUnlock.classList.remove("is-loading");
  btnUnlock.disabled = false;

  if (result && result.success) {
    sessionStorage.setItem(SESSION_KEY, key.trim());
    gate.hidden = true;
    dashboard.hidden = false;
  } else if (!silent) {
    if (result && (result.message === "Unknown action" || result.error === "Unknown action")) {
      showFieldErr("Google Apps Script is missing 'list' action. Please deploy the latest google-apps-script.js!");
    } else {
      showFieldErr("Invalid admin key, or ADMIN_KEY is not configured in Apps Script.");
    }
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function showFieldErr(msg) {
  inputKey.classList.remove("has-error");
  void inputKey.offsetWidth;
  inputKey.classList.add("has-error");
  document.getElementById("err-key").textContent = msg;
}

async function loadEntries(key) {
  if (!key) return { success: false, message: "No key" };

  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PASTE_YOUR")) {
    // Demo fallback
    allEntries = [
      {
        timestamp: new Date().toISOString(),
        twitter: "softgarden",
        commentLink: "https://x.com/softgarden/status/1888000000000000001",
        wallet: "0x1234567890123456789012345678901234567890",
        status: "Whitelisted",
      },
      {
        timestamp: new Date().toISOString(),
        twitter: "marielee_fan",
        commentLink: "https://x.com/marielee_fan/status/1888000000000000002",
        wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        status: "Whitelisted",
      },
    ];
    updateSummary();
    renderTable();
    return { success: true };
  }

  try {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Loading entries...</td></tr>`;
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=list&key=${encodeURIComponent(key.trim())}`);
    const data = await res.json();

    if (!data.success) {
      return { success: false, message: data.message || data.error };
    }

    allEntries = data.data || [];
    if (data.settings) {
      currentSettings = Object.assign({}, currentSettings, data.settings);
      localStorage.setItem("marielee_settings", JSON.stringify(currentSettings));
      renderSettingsForm(currentSettings);
    }

    updateSummary();
    renderTable();
    return { success: true };
  } catch (e) {
    console.error(e);
    showToast("Failed to load data. Please check your connection.", "error");
    return { success: false, message: e.message };
  }
}

function renderSettingsForm(settings) {
  if (!settings) return;
  if (inputSupply && settings.totalSupply !== undefined) {
    inputSupply.value = settings.totalSupply;
  }
  if (inputTwitter && settings.twitterHandle !== undefined) {
    inputTwitter.value = settings.twitterHandle;
  }
  if (inputPost && settings.postUrl !== undefined) {
    inputPost.value = settings.postUrl;
  }
  if (inputOpensea && settings.openseaUrl !== undefined) {
    inputOpensea.value = settings.openseaUrl;
  }
  if (inputDiscord && settings.discordUrl !== undefined) {
    inputDiscord.value = settings.discordUrl;
  }
  if (inputTelegram && settings.telegramUrl !== undefined) {
    inputTelegram.value = settings.telegramUrl;
  }
}

async function handleSaveSettings(e) {
  if (e) e.preventDefault();
  const key = sessionStorage.getItem(SESSION_KEY);
  if (!key) {
    showToast("Session expired. Please log in again.", "error");
    return;
  }

  const newSettings = {
    totalSupply: inputSupply ? inputSupply.value.trim() : "5,000",
    twitterHandle: inputTwitter ? inputTwitter.value.trim().replace(/^@/, "") : "",
    postUrl: inputPost ? inputPost.value.trim() : "",
    openseaUrl: inputOpensea ? inputOpensea.value.trim() : "",
    discordUrl: inputDiscord ? inputDiscord.value.trim() : "",
    telegramUrl: inputTelegram ? inputTelegram.value.trim() : "",
  };

  btnSaveSettings.disabled = true;
  btnSaveSettings.classList.add("is-loading");
  if (settingsNotice) settingsNotice.textContent = "Saving to server...";

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "save_settings",
        key,
        settings: newSettings,
      }),
    });
    const data = await res.json();
    if (data.success) {
      currentSettings = data.settings || newSettings;
      localStorage.setItem("marielee_settings", JSON.stringify(currentSettings));
      renderSettingsForm(currentSettings);
      showToast("Settings saved successfully!", "success");
      if (settingsNotice) {
        settingsNotice.textContent = "✓ Settings saved";
        setTimeout(() => { if (settingsNotice) settingsNotice.textContent = ""; }, 3000);
      }
    } else {
      showToast(data.message || "Failed to save settings.", "error");
      if (settingsNotice) settingsNotice.textContent = "";
    }
  } catch (err) {
    console.error(err);
    localStorage.setItem("marielee_settings", JSON.stringify(newSettings));
    showToast("Saved to local browser cache. Make sure Apps Script is updated.", "success");
    if (settingsNotice) {
      settingsNotice.textContent = "Saved to browser";
      setTimeout(() => { if (settingsNotice) settingsNotice.textContent = ""; }, 3000);
    }
  } finally {
    btnSaveSettings.disabled = false;
    btnSaveSettings.classList.remove("is-loading");
  }
}

function updateSummary() {
  document.getElementById("summary-total").textContent = allEntries.length.toLocaleString();
  const latest = allEntries[0];
  document.getElementById("summary-latest").textContent = latest
    ? `@${latest.twitter} · ${formatDate(latest.timestamp)}`
    : "—";
}

function updateSortArrows() {
  document.querySelectorAll("[data-sort]").forEach((th) => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.sort === sortState.field) {
      arrow.textContent = sortState.dir === "asc" ? "▲" : "▼";
    } else {
      arrow.textContent = "";
    }
  });
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();

  let rows = allEntries.filter((row) => {
    if (!query) return true;
    return (
      String(row.twitter || "").toLowerCase().includes(query) ||
      String(row.wallet || "").toLowerCase().includes(query) ||
      String(row.commentLink || "").toLowerCase().includes(query) ||
      String(row.status || "").toLowerCase().includes(query)
    );
  });

  rows.sort((a, b) => {
    const { field, dir } = sortState;
    let va = a[field] ?? "";
    let vb = b[field] ?? "";
    if (field === "timestamp") {
      va = new Date(va).getTime() || 0;
      vb = new Date(vb).getTime() || 0;
    } else {
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });

  document.getElementById("visible-count").textContent = rows.length.toLocaleString();
  document.getElementById("total-count").textContent = allEntries.length.toLocaleString();

  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">No matching entries found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows
    .map((row, i) => {
      const isBanned = String(row.status || "").toLowerCase() === "banned";
      const statusClass = isBanned ? "banned" : "whitelisted";
      const statusText = isBanned ? "Banned" : "Whitelisted";
      const toggleText = isBanned ? "Unban" : "Ban";
      const toggleClass = isBanned ? "is-unban" : "is-ban";
      const nextStatus = isBanned ? "Whitelisted" : "Banned";

      return `
      <tr style="animation-delay:${Math.min(i * 0.02, 0.3)}s">
        <td>${formatDate(row.timestamp)}</td>
        <td class="cell-twitter"><a href="https://x.com/${escapeHtml(row.twitter)}" target="_blank" rel="noopener">@${escapeHtml(row.twitter)}</a></td>
        <td>
          ${row.commentLink ? `<a href="${escapeHtml(row.commentLink)}" target="_blank" rel="noopener" class="comment-link-badge">View Proof ↗</a>` : `<span class="cell-empty">—</span>`}
        </td>
        <td>
          <span class="cell-wallet">
            ${escapeHtml(truncateMiddle(row.wallet))}
            <button class="copy-btn" data-wallet="${escapeHtml(row.wallet)}" title="Copy full wallet address">⧉</button>
          </span>
        </td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
          <div class="cell-actions">
            <button class="btn-status-toggle ${toggleClass}" data-wallet="${escapeHtml(row.wallet)}" data-twitter="${escapeHtml(row.twitter)}" data-status="${nextStatus}">
              ${toggleText}
            </button>
            <button class="row-delete" data-wallet="${escapeHtml(row.wallet)}" title="Delete permanently">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tableBody.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.wallet).then(() => showToast("Wallet address copied.", "success"));
    });
  });

  tableBody.querySelectorAll(".btn-status-toggle").forEach((btn) => {
    btn.addEventListener("click", () => handleToggleStatus(btn.dataset.wallet, btn.dataset.twitter, btn.dataset.status));
  });

  tableBody.querySelectorAll(".row-delete").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.wallet));
  });
}

async function handleToggleStatus(wallet, twitter, nextStatus) {
  const key = sessionStorage.getItem(SESSION_KEY);
  if (!key) {
    showToast("Session expired. Please log in again.", "error");
    return;
  }

  const isBanning = nextStatus.toLowerCase() === "banned";
  const actionVerb = isBanning ? "ban" : "unban";
  if (!confirm(`Are you sure you want to ${actionVerb} this entry (${truncateMiddle(wallet) || '@' + twitter})?`)) {
    return;
  }

  // Optimistically update entry in local state immediately
  const entry = allEntries.find((r) => {
    const wMatch = wallet && String(r.wallet || "").toLowerCase().trim() === String(wallet).toLowerCase().trim();
    const tMatch = twitter && String(r.twitter || "").toLowerCase().replace(/^@/, "").trim() === String(twitter).toLowerCase().replace(/^@/, "").trim();
    return wMatch || tMatch;
  });

  if (entry) {
    entry.status = nextStatus;
    renderTable();
    updateSummary();
  }

  try {
    // Try GET request with query params first (most reliable for Google Apps Script Web Apps)
    const getUrl = `${GOOGLE_SCRIPT_URL}?action=update_status&wallet=${encodeURIComponent(wallet || "")}&twitter=${encodeURIComponent(twitter || "")}&status=${encodeURIComponent(nextStatus)}&key=${encodeURIComponent(key)}`;
    const res = await fetch(getUrl, { method: "GET" });
    const data = await res.json();

    if (data.success) {
      showToast(`Entry successfully ${isBanning ? "banned" : "unbanned"}.`, "success");
      return;
    }

    if (data.message === "Unknown action" || data.error === "Unknown action") {
      showToast(`Updated locally! To sync to Google Sheet: Deploy a "New version" in Apps Script.`, "warning");
      return;
    }

    showToast(data.message || `Status updated.`, "success");
  } catch (e) {
    // Fallback to text/plain POST
    try {
      const resPost = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "update_status", wallet, twitter, status: nextStatus, key }),
      });
      const dataPost = await resPost.json();
      if (dataPost.success) {
        showToast(`Entry successfully ${isBanning ? "banned" : "unbanned"}.`, "success");
        return;
      }
      if (dataPost.message === "Unknown action") {
        showToast(`Updated locally! To sync to Google Sheet: Deploy a "New version" in Apps Script.`, "warning");
        return;
      }
    } catch (errPost) {}

    showToast(`Updated locally! To sync to Google Sheet: Deploy a "New version" in Apps Script.`, "warning");
  }
}

async function handleDelete(wallet) {
  if (!confirm(`Delete entry with wallet ${truncateMiddle(wallet)} from whitelist?`)) return;

  const key = sessionStorage.getItem(SESSION_KEY);
  allEntries = allEntries.filter((r) => String(r.wallet || "").toLowerCase().trim() !== String(wallet || "").toLowerCase().trim());
  updateSummary();
  renderTable();

  try {
    const getUrl = `${GOOGLE_SCRIPT_URL}?action=delete&wallet=${encodeURIComponent(wallet)}&key=${encodeURIComponent(key)}`;
    const res = await fetch(getUrl, { method: "GET" });
    const data = await res.json();
    if (data.success) {
      showToast("Entry deleted successfully.", "success");
      return;
    }
  } catch (e) {}

  showToast("Entry removed.", "success");
}

function exportCsv() {
  if (allEntries.length === 0) {
    showToast("No data to export.", "error");
    return;
  }
  const header = "Timestamp,Twitter,Comment Link,Wallet,Status";
  const lines = allEntries.map(
    (r) => `"${r.timestamp}","${r.twitter}","${r.commentLink || ""}","${r.wallet}","${r.status || "Whitelisted"}"`
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marielee-whitelist-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== HELPERS =====
function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || "—");
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateMiddle(str) {
  if (!str || str.length <= 14) return str || "";
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

let toastTimer = null;
function showToast(message, type = "") {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.hidden = false;
  toastEl.className = "toast";
  if (type) toastEl.classList.add(`is-${type}`);
  requestAnimationFrame(() => toastEl.classList.add("is-visible"));
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("is-visible");
    setTimeout(() => (toastEl.hidden = true), 300);
  }, 2600);
}
