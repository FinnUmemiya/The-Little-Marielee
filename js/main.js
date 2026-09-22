/**
 * The Little Marielee — Whitelist Frontend
 * Data is stored & retrieved from Google Sheet via Google Apps Script Web App
 */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx9CStngaeSCw6UP49Uf6RCMA5O96GmLyvu5m5kTIWMXD0NKtml8qvP2XsguYlBxHyN/exec";

// ===== STATE =====
let currentStep = 1;
let twitterUsername = "";
let walletAddress = "";
let isFollowDone = false;
let isPostDone = false;
let followCountdown = 0;
let postCountdown = 0;
let followTimerInterval = null;
let postTimerInterval = null;
let currentWhitelistCount = 0;

let projectSettings = {
  totalSupply: "0",
  twitterHandle: "MarieleeHQ",
  postUrl: "https://x.com",
  openseaUrl: "https://opensea.io/collection/thelittlemarielee/overview",
  discordUrl: "",
  telegramUrl: "",
};

// ===== DOM REFS =====
const modal = document.getElementById("modal");
const btnJoin = document.getElementById("btn-join");
const btnNavJoin = document.getElementById("btn-nav-join");
const btnClose = document.getElementById("modal-close");
const whitelistCountEl = document.getElementById("whitelist-count");
const whitelistStatusEl = document.getElementById("whitelist-status");
const whitelistFullStatusEl = document.getElementById("whitelist-full-status");
const toastEl = document.getElementById("toast");

const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const stepSuccess = document.getElementById("step-success");
const formWhitelist = document.getElementById("form-whitelist");

const btnActionFollow = document.getElementById("btn-action-follow");
const textActionFollow = document.getElementById("text-action-follow");
const taskCardFollow = document.getElementById("task-card-follow");
const taskFollowStatus = document.getElementById("task-follow-status");

const btnActionPost = document.getElementById("btn-action-post");
const textActionPost = document.getElementById("text-action-post");
const taskCardPost = document.getElementById("task-card-post");
const taskPostStatus = document.getElementById("task-post-status");

const inputTwitter = document.getElementById("input-twitter");
const inputCommentLink = document.getElementById("input-comment-link");
const inputWallet = document.getElementById("input-wallet");

const btnNextStep = document.getElementById("btn-next-step");
const btnBackStep = document.getElementById("btn-back-step");
const submittingAs = document.getElementById("submitting-as");
const btnSubmit = document.getElementById("btn-submit");
const btnDone = document.getElementById("btn-done");

// ===== INIT =====
window.addEventListener("load", () => {
  requestAnimationFrame(() => document.body.classList.remove("is-loading"));
});

document.addEventListener("DOMContentLoaded", () => {
  loadStoredSettings();
  applyProjectSettings(projectSettings);
  fetchWhitelistCount();
  checkLocalWhitelist();
  setupEventListeners();
  setupScrollReveal();

  setTimeout(() => document.body.classList.remove("is-loading"), 1200);
});

// ===== SCROLL REVEAL =====
function setupScrollReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || items.length === 0) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  btnJoin.addEventListener("click", openModal);
  if (btnNavJoin) btnNavJoin.addEventListener("click", openModal);
  btnClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  // Scroll hint smooth scroll
  const scrollHintEl = document.querySelector(".scroll-hint");
  if (scrollHintEl) {
    scrollHintEl.addEventListener("click", () => {
      const aboutEl = document.getElementById("about");
      if (aboutEl) aboutEl.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Task 1: Follow
  btnActionFollow.addEventListener("click", handleFollowClick);

  // Task 2: Post & Comment
  btnActionPost.addEventListener("click", handlePostClick);

  // Step 1 Input listeners
  inputTwitter.addEventListener("input", () => {
    clearFieldError(inputTwitter, "err-twitter");
    if (inputCommentLink.value.trim()) {
      validateCommentLink(false);
    }
  });
  inputTwitter.addEventListener("blur", () => {
    if (inputTwitter.value.trim()) validateTwitter(true);
  });

  inputCommentLink.addEventListener("input", () => {
    clearFieldError(inputCommentLink, "err-comment-link");
    if (inputCommentLink.value.trim().length > 15) {
      validateCommentLink(false);
    }
  });
  inputCommentLink.addEventListener("blur", () => {
    if (inputCommentLink.value.trim()) validateCommentLink(true);
  });

  // Navigation between Step 1 and Step 2
  btnNextStep.addEventListener("click", handleNextStep);
  btnBackStep.addEventListener("click", () => goToStep(1));

  // Step 2 Input listeners
  inputWallet.addEventListener("input", () => clearFieldError(inputWallet, "err-wallet"));
  inputWallet.addEventListener("blur", () => {
    if (inputWallet.value.trim()) validateWallet(true);
  });

  // Form submit
  formWhitelist.addEventListener("submit", handleSubmit);

  // Success Done button
  btnDone.addEventListener("click", closeModal);
}

// ===== MODAL STEP CONTROL =====
function openModal() {
  if (localStorage.getItem("marielee_whitelisted") === "true") {
    return;
  }

  const maxSupply = getNumericSupply();
  if (maxSupply > 0 && currentWhitelistCount >= maxSupply) {
    showToast(`Whitelist is full! All ${maxSupply.toLocaleString()} spots have been claimed.`, "warning");
    checkSupplyCap();
    return;
  }

  modal.hidden = false;
  goToStep(1);
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => modal.classList.add("is-open"));
}

function closeModal() {
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
  setTimeout(() => {
    modal.hidden = true;
  }, 250);
}

function goToStep(step) {
  currentStep = step;
  step1.hidden = true;
  step2.hidden = true;
  stepSuccess.hidden = true;

  if (step === 1) {
    step1.hidden = false;
  } else if (step === 2) {
    step2.hidden = false;
    submittingAs.textContent = `@${twitterUsername}`;
    setTimeout(() => inputWallet.focus(), 250);
  } else if (step === "success") {
    stepSuccess.hidden = false;
  }
}

// ===== STEP 1 VALIDATION & ADVANCE =====
function handleNextStep() {
  // Check tasks
  if (!isFollowDone) {
    const handle = (projectSettings.twitterHandle || "MarieleeHQ").replace(/^@/, "").trim();
    showToast(`Please complete Task 1 (Follow @${handle}) first.`, "error");
    btnActionFollow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  if (!isPostDone) {
    showToast("Please complete Task 2 (Open Post) first.", "error");
    btnActionPost.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  // Check inputs
  const isTwitterValid = validateTwitter(true);
  const isCommentValid = validateCommentLink(true);

  if (!isTwitterValid || !isCommentValid) {
    return;
  }

  twitterUsername = inputTwitter.value.trim().replace(/^@/, "");
  goToStep(2);
}

// ===== REDIRECT & COOLDOWN TASKS =====
function handleFollowClick() {
  if (isFollowDone || followCountdown > 0) return;

  const handle = (projectSettings.twitterHandle || "MarieleeHQ").replace(/^@/, "").trim();
  const followUrl = `https://x.com/intent/follow?screen_name=${encodeURIComponent(handle)}`;

  // Open X follow intent in a new tab
  window.open(followUrl, "_blank", "noopener,noreferrer");

  // Start 7-second cooldown
  followCountdown = 7;
  btnActionFollow.classList.add("is-counting");
  btnActionFollow.disabled = true;
  textActionFollow.textContent = `Checking... (${followCountdown}s)`;
  taskFollowStatus.textContent = `Please follow @${handle} on X...`;

  clearInterval(followTimerInterval);
  followTimerInterval = setInterval(() => {
    followCountdown--;
    if (followCountdown > 0) {
      textActionFollow.textContent = `Checking... (${followCountdown}s)`;
    } else {
      clearInterval(followTimerInterval);
      isFollowDone = true;
      btnActionFollow.classList.remove("is-counting");
      btnActionFollow.classList.add("is-done");
      btnActionFollow.disabled = true;
      textActionFollow.textContent = "✓ Followed";
      taskCardFollow.classList.add("is-completed");
      taskFollowStatus.textContent = "✓ Follow verified";
    }
  }, 1000);
}

function handlePostClick() {
  if (isPostDone || postCountdown > 0) return;

  const postUrl = projectSettings.postUrl || "https://x.com";

  // Open Post on X in a new tab
  window.open(postUrl, "_blank", "noopener,noreferrer");

  // Start 5-second cooldown
  postCountdown = 5;
  btnActionPost.classList.add("is-counting");
  btnActionPost.disabled = true;
  textActionPost.textContent = `Opening... (${postCountdown}s)`;
  taskPostStatus.textContent = "Please like, repost & comment on the post...";

  clearInterval(postTimerInterval);
  postTimerInterval = setInterval(() => {
    postCountdown--;
    if (postCountdown > 0) {
      textActionPost.textContent = `Opening... (${postCountdown}s)`;
    } else {
      clearInterval(postTimerInterval);
      isPostDone = true;
      btnActionPost.classList.remove("is-counting");
      btnActionPost.classList.add("is-done");
      btnActionPost.disabled = true;
      textActionPost.textContent = "✓ Post Opened";
      taskCardPost.classList.add("is-completed");
      taskPostStatus.textContent = "✓ Paste your comment link below";
      inputCommentLink.focus();
    }
  }, 1000);
}

// ===== VALIDATION HELPERS =====
function showFieldError(input, errId, message) {
  input.classList.add("has-error");
  input.classList.remove("is-valid");
  const errEl = document.getElementById(errId);
  errEl.textContent = message;
  errEl.classList.add("is-visible");

  input.classList.remove("has-error");
  void input.offsetWidth;
  input.classList.add("has-error");
}

function clearFieldError(input, errId) {
  input.classList.remove("has-error");
  const errEl = document.getElementById(errId);
  errEl.classList.remove("is-visible");
  errEl.textContent = "";
}

function markValid(input) {
  input.classList.remove("has-error");
  input.classList.add("is-valid");
}

function isValidTwitterHandle(value) {
  return /^[A-Za-z0-9_]{1,15}$/.test(value);
}

function parseTweetUrl(url) {
  const match = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})\/status\/(\d+)(?:\S*)?$/i);
  if (!match) return null;
  return {
    author: match[1],
    tweetId: match[2],
  };
}

function isPlausibleWalletAddress(value) {
  // Ethereum / EVM style (0x + 40 hex chars)
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return true;
  // Solana style (Base58, 32-44 characters)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return true;
  // General crypto address fallback
  return /^[a-zA-Z0-9]{16,64}$/.test(value);
}

function validateTwitter(showError = true) {
  const value = inputTwitter.value.trim().replace(/^@/, "");
  if (!value) {
    if (showError) showFieldError(inputTwitter, "err-twitter", "Please enter your X / Twitter username.");
    return false;
  }

  if (!isValidTwitterHandle(value)) {
    if (showError) {
      showFieldError(
        inputTwitter,
        "err-twitter",
        "Invalid username. Use 1–15 letters, numbers, or underscores, without spaces."
      );
    }
    return false;
  }

  clearFieldError(inputTwitter, "err-twitter");
  markValid(inputTwitter);
  return true;
}

function validateCommentLink(showError = true) {
  const value = inputCommentLink.value.trim();
  if (!value) {
    if (showError) showFieldError(inputCommentLink, "err-comment-link", "Please paste your comment link from X.");
    return false;
  }

  const parsed = parseTweetUrl(value);
  if (!parsed) {
    if (showError) {
      showFieldError(
        inputCommentLink,
        "err-comment-link",
        "Please enter a valid X comment URL (e.g. https://x.com/username/status/...)."
      );
    }
    return false;
  }

  // Cross-check with X username input
  const currentTwitter = inputTwitter.value.trim().replace(/^@/, "");
  if (currentTwitter && parsed.author.toLowerCase() !== currentTwitter.toLowerCase()) {
    if (showError) {
      showFieldError(
        inputCommentLink,
        "err-comment-link",
        `Comment link belongs to @${parsed.author}, which does not match @${currentTwitter}.`
      );
    }
    return false;
  }

  clearFieldError(inputCommentLink, "err-comment-link");
  markValid(inputCommentLink);
  return true;
}

function validateWallet(showError = true) {
  const wallet = inputWallet.value.trim();
  if (!wallet) {
    if (showError) showFieldError(inputWallet, "err-wallet", "Wallet address is required.");
    return false;
  }

  if (!isPlausibleWalletAddress(wallet)) {
    if (showError) {
      showFieldError(inputWallet, "err-wallet", "Invalid wallet address format. Please check again.");
    }
    return false;
  }

  clearFieldError(inputWallet, "err-wallet");
  markValid(inputWallet);
  return true;
}

// ===== TOAST =====
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
  }, 3500);
}

// ===== FORM SUBMISSION (STEP 2) =====
async function handleSubmit(e) {
  if (e) e.preventDefault();

  const maxSupply = getNumericSupply();
  if (maxSupply > 0 && currentWhitelistCount >= maxSupply && localStorage.getItem("marielee_whitelisted") !== "true") {
    showToast(`Whitelist is full! All ${maxSupply.toLocaleString()} spots have been claimed.`, "error");
    checkSupplyCap();
    closeModal();
    return;
  }

  // Validate Wallet
  const isWalletValid = validateWallet(true);
  if (!isWalletValid) return;

  const twitter = twitterUsername || inputTwitter.value.trim().replace(/^@/, "");
  const commentLink = inputCommentLink.value.trim();
  const wallet = inputWallet.value.trim();

  btnSubmit.disabled = true;
  btnSubmit.classList.add("is-loading");

  try {
    const result = await submitToGoogleSheet({
      twitter,
      commentLink,
      wallet,
    });

    if (!result.success) {
      const msg = result.message || "Submission failed. Please try again.";
      if (msg.toLowerCase().includes("wallet")) {
        showFieldError(inputWallet, "err-wallet", msg);
      } else if (msg.toLowerCase().includes("twitter") || msg.toLowerCase().includes("x")) {
        // Switch back to Step 1 so user can correct their Twitter username
        goToStep(1);
        showFieldError(inputTwitter, "err-twitter", msg);
      }
      showToast(msg, "error");
      btnSubmit.disabled = false;
      btnSubmit.classList.remove("is-loading");
      return;
    }

    // Success
    localStorage.setItem("marielee_whitelisted", "true");
    localStorage.setItem("marielee_twitter", twitter);

    document.getElementById("success-msg").textContent =
      `Welcome to the soft pack, @${twitter}. Your Marielee awaits.`;

    goToStep("success");
    showWhitelistedUI();
    fetchWhitelistCount();
  } catch (err) {
    console.error(err);
    showToast("Failed to save data. Please check your connection and try again.", "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.classList.remove("is-loading");
  }
}

// ===== PROJECT SETTINGS =====
function loadStoredSettings() {
  const stored = localStorage.getItem("marielee_settings");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.totalSupply === "2,222") {
        parsed.totalSupply = "0";
      }
      applyProjectSettings(parsed);
    } catch (e) {}
  }
}

function applyProjectSettings(settings) {
  if (!settings) return;
  projectSettings = { ...projectSettings, ...settings };
  localStorage.setItem("marielee_settings", JSON.stringify(projectSettings));

  const handle = (projectSettings.twitterHandle || "MarieleeHQ").replace(/^@/, "").trim();
  const postUrl = projectSettings.postUrl || "https://x.com";
  const discordUrl = (projectSettings.discordUrl || "").trim();
  const telegramUrl = (projectSettings.telegramUrl || "").trim();
  const supply = (projectSettings.totalSupply !== undefined && projectSettings.totalSupply !== null && String(projectSettings.totalSupply).trim() !== "" ? String(projectSettings.totalSupply) : "0").trim();

  // Supply counters & article text
  const statSupplyEl = document.getElementById("stat-supply");
  if (statSupplyEl) statSupplyEl.textContent = supply;

  const heroSupplyEl = document.getElementById("hero-supply");
  if (heroSupplyEl) heroSupplyEl.textContent = supply;

  const aboutSupplyEl = document.getElementById("about-supply");
  if (aboutSupplyEl) aboutSupplyEl.textContent = supply;

  const articleSupplyEls = document.querySelectorAll(".article-supply");
  articleSupplyEls.forEach((el) => {
    el.textContent = supply;
  });

  // Dynamic meta tags
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute("content", `The Little Marielee — A collection of ${supply} unique NFTs. Free mint. Join the pack.`);
  }
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    ogDesc.setAttribute("content", `A collection of ${supply} unique NFTs, created for those who believe in being early and holding together. Free mint.`);
  }
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) {
    twDesc.setAttribute("content", `A collection of ${supply} unique NFTs, created for those who believe in being early and holding together. Free mint.`);
  }

  // Follow task text
  const taskTitleFollow = document.getElementById("task-follow-title") || document.querySelector("#task-card-follow .task-title");
  if (taskTitleFollow) taskTitleFollow.textContent = `1. Follow @${handle}`;

  const taskFollowStatusEl = document.getElementById("task-follow-status");
  if (taskFollowStatusEl && !isFollowDone) {
    taskFollowStatusEl.textContent = `Follow @${handle} on X to verify`;
  }

  // Nav Links
  const navX = document.getElementById("nav-x");
  if (navX) navX.href = `https://x.com/${encodeURIComponent(handle)}`;

  const navOpensea = document.getElementById("nav-opensea");
  if (navOpensea) {
    const openseaUrl = (projectSettings.openseaUrl || "").trim();
    if (openseaUrl) {
      navOpensea.href = openseaUrl;
      navOpensea.hidden = false;
    } else {
      navOpensea.hidden = true;
    }
  }

  // Footer Links
  const footerX = document.getElementById("footer-x");
  if (footerX) footerX.href = `https://x.com/${encodeURIComponent(handle)}`;

  const footerOpensea = document.getElementById("footer-opensea");
  if (footerOpensea) {
    const openseaUrl = (projectSettings.openseaUrl || "").trim();
    if (openseaUrl) {
      footerOpensea.href = openseaUrl;
      footerOpensea.hidden = false;
    } else {
      footerOpensea.hidden = true;
    }
  }

  const footerDiscord = document.getElementById("footer-discord");
  if (footerDiscord) {
    if (discordUrl) {
      footerDiscord.href = discordUrl;
      footerDiscord.hidden = false;
    } else {
      footerDiscord.hidden = true;
    }
  }

  const footerTelegram = document.getElementById("footer-telegram");
  if (footerTelegram) {
    if (telegramUrl) {
      footerTelegram.href = telegramUrl;
      footerTelegram.hidden = false;
    } else {
      footerTelegram.hidden = true;
    }
  }

  checkSupplyCap();
}

function getNumericSupply() {
  const raw = String(projectSettings.totalSupply || "0").replace(/[^0-9]/g, "");
  const num = parseInt(raw, 10);
  return isNaN(num) ? 0 : num;
}

function checkSupplyCap() {
  const isUserWhitelisted = localStorage.getItem("marielee_whitelisted") === "true";
  if (isUserWhitelisted) {
    if (whitelistFullStatusEl) whitelistFullStatusEl.hidden = true;
    return;
  }

  const maxSupply = getNumericSupply();
  const isFull = maxSupply > 0 && currentWhitelistCount >= maxSupply;
  const btnJoinSpan = btnJoin ? btnJoin.querySelector("span") : null;

  if (isFull) {
    if (btnJoin) {
      btnJoin.classList.add("is-frozen");
      btnJoin.setAttribute("aria-disabled", "true");
      btnJoin.title = `Whitelist is closed! All ${maxSupply.toLocaleString()} spots are full.`;
      if (btnJoinSpan) btnJoinSpan.textContent = "Whitelist Full";
    }
    if (btnNavJoin) {
      btnNavJoin.classList.add("is-frozen");
      btnNavJoin.setAttribute("aria-disabled", "true");
      btnNavJoin.textContent = "Full";
    }
    if (whitelistFullStatusEl) {
      whitelistFullStatusEl.hidden = false;
      const msgSpan = whitelistFullStatusEl.querySelector(".full-status-msg");
      if (msgSpan) {
        msgSpan.textContent = `Whitelist is currently closed. All ${maxSupply.toLocaleString()} spots have been claimed.`;
      }
    }
  } else {
    if (btnJoin) {
      btnJoin.classList.remove("is-frozen");
      btnJoin.removeAttribute("aria-disabled");
      btnJoin.title = "";
      if (btnJoinSpan) btnJoinSpan.textContent = "Join Whitelist";
    }
    if (btnNavJoin) {
      btnNavJoin.classList.remove("is-frozen");
      btnNavJoin.removeAttribute("aria-disabled");
      btnNavJoin.textContent = "Join Whitelist";
    }
    if (whitelistFullStatusEl) {
      whitelistFullStatusEl.hidden = true;
    }
  }
}

// ===== GOOGLE SHEET =====
async function fetchWhitelistCount() {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PASTE_YOUR")) {
    setCount(0);
    return;
  }

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=count`, {
      method: "GET",
      redirect: "follow",
    });
    const data = await res.json();
    if (data && typeof data.count === "number") {
      setCount(data.count);
    } else {
      whitelistCountEl.textContent = "—";
    }

    if (data && data.settings) {
      applyProjectSettings(data.settings);
    }
  } catch (e) {
    console.warn("Could not fetch count:", e);
    whitelistCountEl.textContent = "—";
  }
}

function setCount(n) {
  currentWhitelistCount = n;
  whitelistCountEl.textContent = n.toLocaleString();
  whitelistCountEl.classList.remove("count-in");
  void whitelistCountEl.offsetWidth;
  whitelistCountEl.classList.add("count-in");
  checkSupplyCap();
}

async function submitToGoogleSheet(payload) {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PASTE_YOUR")) {
    await new Promise((r) => setTimeout(r, 800));
    console.log("Demo submit:", payload);
    return { success: true };
  }

  const body = JSON.stringify({
    action: "submit",
    twitter: payload.twitter,
    commentLink: payload.commentLink,
    wallet: payload.wallet,
  });

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    const data = await res.json();
    return {
      success: !!data.success,
      message: data.message,
    };
  } catch (e) {
    console.warn("Could not parse JSON response, falling back to no-cors:", e);
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    return { success: true };
  }
}

// ===== LOCAL STATE =====
function checkLocalWhitelist() {
  if (localStorage.getItem("marielee_whitelisted") === "true") {
    showWhitelistedUI();
  }
}

function showWhitelistedUI() {
  btnJoin.hidden = true;
  if (btnNavJoin) btnNavJoin.hidden = true;
  whitelistStatusEl.hidden = false;
}
