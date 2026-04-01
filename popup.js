const toggle = document.getElementById("toggleSwitch");
const statusText = document.getElementById("statusText");
const counterValue = document.getElementById("counterValue");
const clearBtn = document.getElementById("clearBtn");

function render(enabled, count) {
  toggle.checked = enabled;
  statusText.textContent = "Статус: " + (enabled ? "ON" : "OFF");
  counterValue.textContent = String(count);
}

async function ensureDefaultsAndLoad() {
  try {
    const data = await chrome.storage.local.get(["raidBlockEnabled", "raidBlockCount"]);

    let enabled = data.raidBlockEnabled;
    let count = data.raidBlockCount;

    const updates = {};

    if (typeof enabled === "undefined") {
      enabled = true;
      updates.raidBlockEnabled = true;
    }

    if (typeof count === "undefined") {
      count = 0;
      updates.raidBlockCount = 0;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    render(enabled !== false, Number(count || 0));
  } catch (e) {
    console.log("[RAID BLOCK] popup load failed:", e);
    render(true, 0);
  }
}

toggle.addEventListener("change", async () => {
  const enabled = toggle.checked;

  try {
    await chrome.storage.local.set({ raidBlockEnabled: enabled });
    statusText.textContent = "Статус: " + (enabled ? "ON" : "OFF");
  } catch (e) {
    console.log("[RAID BLOCK] failed to save toggle:", e);
  }
});

clearBtn.addEventListener("click", async () => {
  try {
    await chrome.storage.local.set({ raidBlockCount: 0 });
    counterValue.textContent = "0";
  } catch (e) {
    console.log("[RAID BLOCK] failed to clear counter:", e);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.raidBlockCount) {
    counterValue.textContent = String(changes.raidBlockCount.newValue || 0);
  }

  if (changes.raidBlockEnabled) {
    const enabled = changes.raidBlockEnabled.newValue !== false;
    toggle.checked = enabled;
    statusText.textContent = "Статус: " + (enabled ? "ON" : "OFF");
  }
});

render(true, 0);

ensureDefaultsAndLoad();