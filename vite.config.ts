import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        author: 'meooow25 & RimuruChan',
        license: 'MIT',
        description: 'Predicts Codeforces rating changes, original by meooow25 (https://github.com/meooow25/carrot), ported to Tampermonkey by RimuruChan',
        homepageURL: 'https://github.com/RimuruChan/carrot-userscript',
        icon: 'https://aowuucdn.oss-accelerate.aliyuncs.com/codeforces.png',
        namespace: 'https://greasyfork.org/zh-CN/users/1182955',
        match: ['https://codeforces.com/*'],
        grant: ['GM_getValue', 'GM_setValue', 'GM.deleteValue', 'GM_addStyle', 'GM_registerMenuCommand'],
      },
    }),
  ],
});
