(() => {
const DEBUG = true;

function log(...args) {
if (DEBUG) console.log("[RAID BLOCK]", ...args);
}

function warn(...args) {
}

let blockingEnabled = true;
let raidBlockCount = 0;
let lastBlockTs = 0;
let observer = null;
let scanInterval = null;

const processedContainers = new Set();
const CACHE_TTL = 15000; // 15 секунд

const RAID_TEXTS = [
"проводит рейд", "начинает рейд", "вы присоединяетесь к рейду",
"присоединяетесь к рейду", "вас перенаправляют", "скоро начнется рейд",
"raiding", "starting raid", "you are joining a raid", "joining raid"
];

const CANCEL_TEXTS = [
"отменить", "остаться", "покинуть", "не переходить",
"cancel", "stay here", "stay on channel", "don't join", "dismiss"
];

function normalize(text) {
return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function textIncludesAny(text, patterns) {
const t = normalize(text);
return patterns.some(p => t.includes(normalize(p)));
}

function isVisible(el) {
if (!el) return false;
try {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") 
    return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
} catch (e) {
  return false;
}
}

function isLikelyRaidModal(el) {
  const buttons = el.querySelectorAll("button, [role='button']");
  if (buttons.length === 0) return false;
  
  for (const btn of buttons) {
    const btnText = normalize(btn.innerText || btn.textContent || btn.getAttribute("aria-label") || "");
    if (textIncludesAny(btnText, CANCEL_TEXTS)) {
      return true;
    }
  }
  
  return false;
}

function isLargeEnough(el) {
try {
  const rect = el.getBoundingClientRect();
  return rect.width >= 150 && rect.height >= 50;
} catch (e) {
  return false;
}
}

function notifyPopup() {
chrome.runtime.sendMessage({
type: "raidBlockedCount",
count: raidBlockCount
}, () => void chrome.runtime.lastError);
}

function saveCount() {
chrome.storage.local.set({ raidBlockCount }, () => {
notifyPopup();
});
}

function incrementCount() {
raidBlockCount += 1;
log("✅ Raid blocked! Count =", raidBlockCount);
saveCount();
}

function canBlockNow() {
const now = Date.now();
if (now - lastBlockTs < 3000) return false;
lastBlockTs = now;
return true;
}

function clickElement(el, reason = "") {
if (!el || !isVisible(el)) return false;
try {
el.click();
log("✅ Clicked:", reason);
return true;
} catch (e) {
return false;
}
}

function getAllButtons() {
const selectors = ["button", "[role='button']"];
const set = new Set();
selectors.forEach(sel => {
try {
  document.querySelectorAll(sel).forEach(el => set.add(el));
} catch (e) {}
});
return [...set];
}

function findCancelButtonAnywhere() {
const buttons = getAllButtons();
for (const btn of buttons) {
const txt = normalize(btn.innerText || btn.textContent || btn.getAttribute("aria-label") || "");
if (!txt || !isVisible(btn)) continue;
if (textIncludesAny(txt, CANCEL_TEXTS)) {
  return btn;
}
}
return null;
}

function findRaidContainers() {
const all = [...document.querySelectorAll("div, section")];
const result = [];

for (const el of all) {
  if (processedContainers.has(el)) continue;
  
  if (!isVisible(el)) continue;
  
  const txt = normalize(el.innerText || el.textContent || "");
  if (textIncludesAny(txt, RAID_TEXTS) && 
      txt.length >= 15 && 
      isLargeEnough(el) &&
      isLikelyRaidModal(el)) { 
    
    result.push(el);
    processedContainers.add(el);
    setTimeout(() => processedContainers.delete(el), CACHE_TTL);
    
    log("🎯 Found raid modal with cancel button");
  }
}

return result;
}

function findCancelInside(container) {
if (!container) return null;
const buttons = container.querySelectorAll("button, [role='button']");

for (const btn of buttons) {
  const txt = normalize(btn.innerText || btn.textContent || btn.getAttribute("aria-label") || "");
  if (!txt) continue;
  if (textIncludesAny(txt, CANCEL_TEXTS)) {
    return btn;
  }
}
return null;
}

function tryBlockRaid() {
if (!blockingEnabled) return false;

const raidContainers = findRaidContainers();

if (raidContainers.length > 0) {
  log("🚨 Raid elements found:", raidContainers.length);

  for (const container of raidContainers) {
    const cancelBtn = findCancelInside(container);
    if (cancelBtn && canBlockNow()) {
      if (clickElement(cancelBtn, "cancel inside raid element")) {
        incrementCount();
        return true;
      }
    }
  }

  const globalCancel = findCancelButtonAnywhere();
  if (globalCancel && canBlockNow()) {
    if (clickElement(globalCancel, "global cancel button")) {
      incrementCount();
      return true;
    }
  }

  return false;
}

return false;
}

function startObserver() {
if (observer) observer.disconnect();
if (scanInterval) clearInterval(scanInterval);

try {
  observer = new MutationObserver(() => tryBlockRaid());
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false
  });
  
  scanInterval = setInterval(() => tryBlockRaid(), 2000); // 2 секунды
  console.log("[RAID BLOCK] ✅ Observer started");
} catch (e) {
  console.error("[RAID BLOCK] ❌ Observer failed:", e);
}
}

function stopObserver() {
if (observer) {
  observer.disconnect();
  observer = null;
}
if (scanInterval) {
  clearInterval(scanInterval);
  scanInterval = null;
}
console.log("[RAID BLOCK] ⏸️ Observer stopped");
}

function applyState(enabled) {
blockingEnabled = enabled !== false;
console.log("[RAID BLOCK] Blocking", blockingEnabled ? "ENABLED ✅" : "DISABLED ❌");

if (blockingEnabled) {
  startObserver();
} else {
  stopObserver();
}
}

chrome.storage.local.get(["raidBlockEnabled", "raidBlockCount"], (data) => {
blockingEnabled = data.raidBlockEnabled !== false;
raidBlockCount = Number(data.raidBlockCount || 0);

console.log("[RAID BLOCK] 📊 State:", blockingEnabled ? "ON" : "OFF");
console.log("[RAID BLOCK] 📊 Count:", raidBlockCount);

notifyPopup();
applyState(blockingEnabled);

setTimeout(() => tryBlockRaid(), 1500);
});

chrome.storage.onChanged.addListener((changes, area) => {
if (area !== "local") return;

if (changes.raidBlockEnabled) {
  const newValue = changes.raidBlockEnabled.newValue !== false;
  console.log("[RAID BLOCK] 🔄 State changed:", newValue ? "ON" : "OFF");
  applyState(newValue);
}

if (changes.raidBlockCount) {
  raidBlockCount = Number(changes.raidBlockCount.newValue || 0);
}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (!msg || typeof msg !== "object") return;

if (msg.type === "getRaidBlockCount") {
  sendResponse({ count: raidBlockCount });
  return true;
}

if (msg.type === "clearRaidBlockCount") {
  raidBlockCount = 0;
  chrome.storage.local.set({ raidBlockCount: 0 }, () => {
    console.log("[RAID BLOCK] 🗑️ Counter cleared");
    notifyPopup();
    sendResponse({ ok: true, count: 0 });
  });
  return true;
}

if (msg.type === "forceCheckRaid") {
  sendResponse({ ok: true, blocked: tryBlockRaid() });
  return true;
}
});
})();