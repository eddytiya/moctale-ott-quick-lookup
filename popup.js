const form = document.querySelector("form");
const keyInput = document.querySelector("#key");
const saveButton = document.querySelector("#save");
const removeButton = document.querySelector("#remove");
const status = document.querySelector("#key-status");
let hasKey = false;

function setBusy(busy) {
  keyInput.disabled = busy;
  saveButton.disabled = busy;
  removeButton.disabled = busy || !hasKey;
}

// Show the saved state without putting the stored credential back in the DOM.
async function loadSettings() {
  try {
    const { tmdbKey } = await chrome.storage.local.get("tmdbKey");
    hasKey = Boolean(tmdbKey);
    status.textContent = hasKey ? "A key is saved on this device." : "No key saved yet.";
  } catch {
    status.textContent = "Could not read settings. Reopen the popup to try again.";
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    status.textContent = "Enter the 32-character TMDB v3 API key.";
    keyInput.focus();
    return;
  }
  setBusy(true);
  try {
    await chrome.storage.local.set({ tmdbKey: key });
    hasKey = true;
    keyInput.value = "";
    status.textContent = "Key saved. Try a title lookup to verify it.";
  } catch {
    status.textContent = "Could not save the key. Try again.";
  } finally {
    setBusy(false);
  }
});

removeButton.addEventListener("click", async () => {
  setBusy(true);
  try {
    await chrome.storage.local.remove("tmdbKey");
    hasKey = false;
    keyInput.value = "";
    status.textContent = "Key removed.";
  } catch {
    status.textContent = "Could not remove the key. Try again.";
  } finally {
    setBusy(false);
  }
});

loadSettings();
