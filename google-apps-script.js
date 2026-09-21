/**
 * ============================================
 * Google Apps Script for The Little Marielee
 * ============================================
 *
 * HOW TO SETUP / UPDATE:
 * 1. Open your Google Spreadsheet
 * 2. Sheet name: "Whitelist"
 * 3. Header row (Row 1):
 *    A1: Timestamp | B1: Twitter | C1: Comment Link | D1: Wallet | E1: Status
 * 4. Extensions → Apps Script
 * 5. Replace code with this file
 * 6. Project Settings (gear icon) → Script Properties:
 *    - ADMIN_KEY: (your secret admin key)
 * 7. Deploy → Manage deployments → Edit → New version → Deploy
 * 8. Copy the Web App URL into js/main.js & js/admin.js
 */

const SHEET_NAME = "Whitelist";

function doGet(e) {
  const action = e.parameter.action || "count";

  if (action === "count") {
    return jsonResponse({
      count: getWhitelistCount(),
      settings: getProjectSettings(),
    });
  }

  if (action === "settings") {
    return jsonResponse({
      success: true,
      settings: getProjectSettings(),
    });
  }

  if (action === "list") {
    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, message: "Unauthorized" });
    }
    return jsonResponse({
      success: true,
      data: getAllEntries(),
      settings: getProjectSettings(),
    });
  }

  if (action === "update_status") {
    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, message: "Unauthorized" });
    }
    const wallet = (e.parameter.wallet || "").trim();
    const twitter = (e.parameter.twitter || "").trim();
    const newStatus = (e.parameter.status || "Whitelisted").trim();
    const updated = updateStatusByWallet(wallet, newStatus, twitter);
    return jsonResponse({ success: updated, status: newStatus });
  }

  if (action === "delete") {
    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, message: "Unauthorized" });
    }
    const wallet = (e.parameter.wallet || "").trim();
    const removed = deleteByWallet(wallet);
    return jsonResponse({ success: removed });
  }

  return jsonResponse({ error: "Unknown action" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "submit";

    if (action === "submit") {
      const twitter = (data.twitter || "").trim().replace(/^@/, "");
      const commentLink = (data.commentLink || "").trim();
      const wallet = (data.wallet || "").trim();

      if (!twitter || !wallet) {
        return jsonResponse({ success: false, message: "Twitter username and wallet are required." });
      }

      const existingStatus = getEntryStatus(wallet, twitter);
      if (existingStatus) {
        if (existingStatus.toLowerCase() === "banned") {
          return jsonResponse({ success: false, message: "This wallet or X account has been banned." });
        }
        return jsonResponse({ success: false, message: "This wallet or X account is already whitelisted." });
      }

      // Check supply limit
      const currentSettings = getProjectSettings();
      const rawSupply = String(currentSettings.totalSupply || "5000").replace(/[^0-9]/g, "");
      const maxSupply = parseInt(rawSupply, 10);
      if (!isNaN(maxSupply) && maxSupply > 0) {
        const currentCount = getWhitelistCount();
        if (currentCount >= maxSupply) {
          return jsonResponse({
            success: false,
            message: "Whitelist is full! Maximum supply of " + maxSupply.toLocaleString() + " spots reached.",
          });
        }
      }

      const sheet = getSheet();
      sheet.appendRow([
        new Date().toISOString(),
        twitter,
        commentLink,
        wallet,
        "Whitelisted",
      ]);

      return jsonResponse({
        success: true,
        count: getWhitelistCount(),
      });
    }

    // Admin delete entry
    if (action === "delete") {
      if (!isAuthorized(e, data.key)) {
        return jsonResponse({ success: false, message: "Unauthorized" });
      }
      const wallet = (data.wallet || "").trim();
      const removed = deleteByWallet(wallet);
      return jsonResponse({ success: removed });
    }

    // Admin update status (Whitelisted / Banned)
    if (action === "update_status") {
      if (!isAuthorized(e, data.key)) {
        return jsonResponse({ success: false, message: "Unauthorized" });
      }
      const wallet = (data.wallet || "").trim();
      const twitter = (data.twitter || "").trim();
      const newStatus = (data.status || "Whitelisted").trim();
      const updated = updateStatusByWallet(wallet, newStatus, twitter);
      return jsonResponse({ success: updated, status: newStatus });
    }

    // Save project social links & settings from admin dashboard
    if (action === "save_settings") {
      if (!isAuthorized(e, data.key)) {
        return jsonResponse({ success: false, message: "Unauthorized" });
      }
      const saved = saveProjectSettings(data.settings || {});
      return jsonResponse({ success: true, settings: saved });
    }

    return jsonResponse({ success: false, message: "Unknown action" });
  } catch (err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}

// ===== SETTINGS =====
function getProjectSettings() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("PROJECT_SETTINGS");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {}
  }
  return {
    totalSupply: "2,222",
    twitterHandle: "MarieleeHQ",
    postUrl: "https://x.com",
    openseaUrl: "https://opensea.io/collection/thelittlemarielee/overview",
    discordUrl: "",
    telegramUrl: "",
  };
}

function saveProjectSettings(newSettings) {
  const props = PropertiesService.getScriptProperties();
  const current = getProjectSettings();
  const updated = {
    totalSupply: (newSettings.totalSupply !== undefined ? newSettings.totalSupply : current.totalSupply || "5,000").toString().trim(),
    twitterHandle: (newSettings.twitterHandle !== undefined ? newSettings.twitterHandle : current.twitterHandle).replace(/^@/, "").trim(),
    postUrl: (newSettings.postUrl !== undefined ? newSettings.postUrl : current.postUrl).trim(),
    openseaUrl: (newSettings.openseaUrl !== undefined ? newSettings.openseaUrl : current.openseaUrl || "").trim(),
    discordUrl: (newSettings.discordUrl !== undefined ? newSettings.discordUrl : current.discordUrl).trim(),
    telegramUrl: (newSettings.telegramUrl !== undefined ? newSettings.telegramUrl : current.telegramUrl).trim(),
  };
  props.setProperty("PROJECT_SETTINGS", JSON.stringify(updated));
  return updated;
}

// ===== AUTH =====
function isAuthorized(e, bodyKey) {
  const adminKey = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!adminKey) return false;
  const suppliedKey = bodyKey || (e && e.parameter && e.parameter.key) || "";
  return String(suppliedKey).trim() === String(adminKey).trim();
}

// ===== HELPERS =====
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Timestamp", "Twitter", "Comment Link", "Wallet", "Status"]);
  }
  return sheet;
}

function getColumnIndices(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0] || [];
  const lower = headers.map(function(h) { return String(h).toLowerCase().trim(); });

  var twitterIdx = lower.indexOf("twitter");
  var commentIdx = lower.indexOf("comment link");
  if (commentIdx === -1) commentIdx = lower.indexOf("comment");
  var walletIdx = lower.indexOf("wallet");
  var statusIdx = lower.indexOf("status");

  return {
    twitter: twitterIdx !== -1 ? twitterIdx : 1,
    commentLink: commentIdx !== -1 ? commentIdx : (lower.length > 4 ? 2 : -1),
    wallet: walletIdx !== -1 ? walletIdx : (lower.length > 4 ? 3 : 2),
    status: statusIdx !== -1 ? statusIdx : (lower.length > 4 ? 4 : 3),
  };
}

function getWhitelistCount() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  return Math.max(0, lastRow - 1);
}

function isWalletExists(wallet) {
  if (!wallet) return false;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;
  const cols = getColumnIndices(sheet);
  const target = wallet.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cols.wallet] || "").toLowerCase().trim() === target) {
      return true;
    }
  }
  return false;
}

function isTwitterExists(twitter) {
  if (!twitter) return false;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;
  const cols = getColumnIndices(sheet);
  const cleanTwitter = twitter.toLowerCase().replace(/^@/, "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowTwitter = String(data[i][cols.twitter] || "").toLowerCase().replace(/^@/, "").trim();
    if (rowTwitter === cleanTwitter) {
      return true;
    }
  }
  return false;
}

function getAllEntries() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const cols = getColumnIndices(sheet);
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][cols.twitter] && !data[i][cols.wallet]) continue;
    rows.push({
      timestamp: data[i][0],
      twitter: data[i][cols.twitter],
      commentLink: (cols.commentLink !== -1 && data[i][cols.commentLink]) ? data[i][cols.commentLink] : "",
      wallet: data[i][cols.wallet],
      status: data[i][cols.status] || "Whitelisted",
    });
  }
  return rows.reverse();
}

function deleteByWallet(wallet) {
  if (!wallet) return false;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const cols = getColumnIndices(sheet);
  const target = wallet.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cols.wallet] || "").toLowerCase().trim() === target) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function updateStatusByWallet(wallet, newStatus, twitter) {
  if (!wallet && !twitter) return false;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const cols = getColumnIndices(sheet);
  const targetWallet = String(wallet || "").toLowerCase().trim();
  const targetTwitter = String(twitter || "").toLowerCase().replace(/^@/, "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowWallet = String(data[i][cols.wallet] || "").toLowerCase().trim();
    const rowTwitter = String(data[i][cols.twitter] || "").toLowerCase().replace(/^@/, "").trim();

    if ((targetWallet && rowWallet === targetWallet) || (targetTwitter && rowTwitter === targetTwitter)) {
      sheet.getRange(i + 1, cols.status + 1).setValue(newStatus);
      return true;
    }
  }
  return false;
}

function getEntryStatus(wallet, twitter) {
  if (!wallet && !twitter) return null;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  const cols = getColumnIndices(sheet);
  const targetWallet = String(wallet || "").toLowerCase().trim();
  const targetTwitter = String(twitter || "").toLowerCase().replace(/^@/, "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowWallet = String(data[i][cols.wallet] || "").toLowerCase().trim();
    const rowTwitter = String(data[i][cols.twitter] || "").toLowerCase().replace(/^@/, "").trim();

    if ((targetWallet && rowWallet === targetWallet) || (targetTwitter && rowTwitter === targetTwitter)) {
      return String(data[i][cols.status] || "Whitelisted").trim();
    }
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
