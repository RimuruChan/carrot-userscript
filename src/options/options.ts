import { GM_addStyle, GM_deleteValue, GM_listValues, GM_registerMenuCommand } from "$";
import optionsHtml from "./options.html?raw";
import optionsCss from "./options.css?raw";
import * as settings from '../util/settings';

async function setup() {
  const predict = document.querySelector<HTMLInputElement>('#enable-predict-deltas')!;
  const final = document.querySelector<HTMLInputElement>('#enable-final-deltas')!;
  const prefetch = document.querySelector<HTMLInputElement>('#enable-prefetch-ratings')!;

  async function update() {
    predict.checked = await settings.enablePredictDeltas();
    final.checked = await settings.enableFinalDeltas();
    prefetch.checked = await settings.enablePrefetchRatings();
    prefetch.disabled = !predict.checked;
  }

  predict.addEventListener('input', async () => {
    await settings.enablePredictDeltas(predict.checked);
    await update();
  });

  final.addEventListener('input', async () => {
    await settings.enableFinalDeltas(final.checked);
    await update();
  });

  prefetch.addEventListener('input', async () => {
    await settings.enablePrefetchRatings(prefetch.checked);
    await update();
  });

  await update();
}

export function initOptions() {
  // Inject options HTML
  $('body').append(optionsHtml);
  GM_addStyle(optionsCss);
  GM_registerMenuCommand("Open options", () => {
    // Open options page
    const dialog = document.querySelector('#options-dialog') as HTMLDialogElement;
    dialog.showModal();
  });
  GM_registerMenuCommand("Clear cache", () => {
    // Clear cache
    const list = GM_listValues();
    for (const key of list) {
      if (key.startsWith('LOCAL.')) {
        GM_deleteValue(key);
      }
    }
  });

  $('#close-options').on('click', () => {
    const dialog = document.querySelector('#options-dialog') as HTMLDialogElement;
    dialog.close();
  });

  setup();
}
