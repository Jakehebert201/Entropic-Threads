import Decimal from "break_eternity.js";
import { GEN_CFG } from '../generators.js';
export type DevToolsVisibilityOptions = {
  allow: boolean;
  button: HTMLButtonElement | null;
  view: HTMLElement | null;
  currentTab: string;
  activateTab: (tab: string) => void;
};

export function applyDevTabVisibility({ allow, button, view, currentTab, activateTab }: DevToolsVisibilityOptions) {
  if (!button || !view) return;
  button.hidden = !allow;
  view.hidden = !allow;
  if (!allow && currentTab === 'dev') {
    activateTab('game');
  }
}

export function buildDevTools(container: HTMLDivElement | null, sendMessage: (payload: any) => void) {
  if (!container) return;
  container.innerHTML = '';

  const note = document.createElement('p');
  note.className = 'settings-note';
  note.textContent = 'Developer shortcuts. Cheats apply instantly and save immediately.';
  container.appendChild(note);

  const stringsField = document.createElement('div');
  stringsField.className = 'dev-field';

  const stringsLabel = document.createElement('label');
  stringsLabel.htmlFor = 'dev-add-strings';
  stringsLabel.textContent = 'Add Strings';

  const stringsInput = document.createElement('input');
  stringsInput.type = 'text';
  stringsInput.id = 'dev-add-strings';
  stringsInput.placeholder = 'e.g. 1e30';

  const stringsBtn = document.createElement('button');
  stringsBtn.type = 'button';
  stringsBtn.textContent = 'Grant';
  stringsBtn.addEventListener('click', () => {
    const raw = stringsInput.value.trim();
    if (!raw) return;
    try {
      const amount = new Decimal(raw);
      if (amount.lessThanOrEqualTo(0)) return;
      sendMessage({ type: 'action', action: 'devAddStrings', amount: amount.toString() });
    } catch {
      console.warn('Invalid string grant amount');
    }
  });

  stringsField.append(stringsLabel, stringsInput, stringsBtn);
  container.appendChild(stringsField);

  const gensField = document.createElement('div');
  gensField.className = 'dev-field';

  const gensLabel = document.createElement('label');
  gensLabel.textContent = 'Add Generators';
  gensLabel.htmlFor = 'dev-add-gens';

  const tierSelect = document.createElement('select');
  tierSelect.id = 'dev-add-gens-tier';
  GEN_CFG.forEach(cfg => {
    const option = document.createElement('option');
    option.value = String(cfg.tier);
    option.textContent = cfg.name;
    tierSelect.appendChild(option);
  });

  const gensInput = document.createElement('input');
  gensInput.type = 'number';
  gensInput.id = 'dev-add-gens';
  gensInput.min = '1';
  gensInput.step = '1';
  gensInput.value = '1';

  const gensBtn = document.createElement('button');
  gensBtn.type = 'button';
  gensBtn.textContent = 'Grant';
  gensBtn.addEventListener('click', () => {
    const tier = Number(tierSelect.value);
    const amount = Math.floor(Number(gensInput.value));
    if (!Number.isFinite(tier) || !Number.isFinite(amount)) return;
    sendMessage({ type: 'action', action: 'devAddGenerators', tier, amount });
  });

  gensField.append(gensLabel, tierSelect, gensInput, gensBtn);
  container.appendChild(gensField);
}
