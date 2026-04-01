chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["raidBlockEnabled", "raidBlockCount"]);

  const updates = {};

  if (typeof data.raidBlockEnabled === "undefined") {
    updates.raidBlockEnabled = true;
  }

  if (typeof data.raidBlockCount === "undefined") {
    updates.raidBlockCount = 0;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
});

(async () => {
  try {
    const data = await chrome.storage.local.get(["raidBlockEnabled", "raidBlockCount"]);
    const updates = {};

    if (typeof data.raidBlockEnabled === "undefined") {
      updates.raidBlockEnabled = true;
    }

    if (typeof data.raidBlockCount === "undefined") {
      updates.raidBlockCount = 0;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  } catch (e) {
    console.log("[RAID BLOCK] background init failed:", e);
  }
})();