import { registerTranslations } from './i18n';

registerTranslations({
  '关于项目与免责声明': 'About & disclaimer',
  '本项目由开发者 ': 'This project was created by developer ',
  ' 于 2026-09-04 测试当时最新的模型 ChatGPT 6 Astra 时，以一次提示（one-shot）开发。他使用这种方法对不同模型进行 benchmark 对比。': ' in a one-shot development experiment on 2026-09-04 while testing the then-latest model, ChatGPT 6 Astra. He uses this approach to benchmark different models.',
  '这是一个独立的爱好者重制项目，与 Electronic Arts（EA）、Westwood Studios 及其许可方没有隶属、赞助、授权或背书关系。Command & Conquer、Red Alert 2 及所有原版游戏商标、标志、素材和相关版权均归 EA 及其他相应权利人所有。': 'This independent fan recreation has no affiliation, sponsorship, authorization or endorsement from Electronic Arts (EA), Westwood Studios or their licensors. Command & Conquer, Red Alert 2, and all original game trademarks, logos, assets and related copyrights belong to EA and their respective rights holders.',
  '本项目也与 OpenAI 或 ChatGPT 没有关联、赞助或背书关系。OpenAI、ChatGPT 及相关商标和标志归 OpenAI 及相应权利人所有；模型名称仅用于标识本次实验所使用的工具。': 'This project is also not associated with, sponsored by or endorsed by OpenAI or ChatGPT. OpenAI, ChatGPT and related trademarks and logos belong to OpenAI and their respective owners. The model name only identifies the tool used for this experiment.',
  '无意侵犯任何人的版权或其他权利。本项目不主张拥有原版素材，也不授予使用第三方内容的许可。任何疑问、权利问题或下架请求，请联系 ': 'No infringement of anyone’s copyright or other rights is intended. This project claims no ownership of the original assets and grants no license to third-party content. For questions, rights concerns or takedown requests, contact ',
});

/** Source text stays available to the existing live language switcher. */
export function projectNotice(): string {
  return `<details class="project-notice"><summary>关于项目与免责声明</summary><div>
    <p>本项目由开发者 <a href="https://zzn.im" target="_blank" rel="noopener noreferrer">Victor Zhou (zzn.im)</a> 于 2026-09-04 测试当时最新的模型 ChatGPT 6 Astra 时，以一次提示（one-shot）开发。他使用这种方法对不同模型进行 benchmark 对比。</p>
    <p>这是一个独立的爱好者重制项目，与 Electronic Arts（EA）、Westwood Studios 及其许可方没有隶属、赞助、授权或背书关系。Command &amp; Conquer、Red Alert 2 及所有原版游戏商标、标志、素材和相关版权均归 EA 及其他相应权利人所有。</p>
    <p>本项目也与 OpenAI 或 ChatGPT 没有关联、赞助或背书关系。OpenAI、ChatGPT 及相关商标和标志归 OpenAI 及相应权利人所有；模型名称仅用于标识本次实验所使用的工具。</p>
    <p>无意侵犯任何人的版权或其他权利。本项目不主张拥有原版素材，也不授予使用第三方内容的许可。任何疑问、权利问题或下架请求，请联系 <a href="mailto:hi@zzn.im">hi[at]zzn[dot]im</a>.</p>
  </div></details>`;
}
