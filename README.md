A Chrome Extension developed with [Plasmo extension](https://docs.plasmo.com/).

[Google Webstore](https://chromewebstore.google.com/detail/fulltext-bookmark/nemjnpfmngeipdjjjecgjgeognbcmkbl)
## Update
⌨️ Add backup feature for exporting your data into a csv file. And you can also import it back to the extension to restore.


## Features
- 🔍 a better bookmark/broswing history search tool.
- 💾 store and index bookmarked page or any page you visit, so you can later fulltext search them.
- 🦉 bookmark interesting weibo and search them!
- 🥇 best matched search result will be dispalyed in the search engine page as you search (google/bing/baidu).
- 📎 search in the chrome searchbar by typing 'kw' first(short for 'keyword').
- 📜 or search in the extension popup page for more results.
- 😺 everything stored in local storage, no accounts, no cloud, no privacy issues, totally free.
- ✉️ send your bookmark/browsing history to custom remote api as you like.

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension.
## Getting Started

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

You can start editing the popup by modifying `popup.tsx`. It should auto-update as you make changes. To add an options page, simply add a `options.tsx` file to the root of the project, with a react component default exported. Likewise to add a content page, add a `content.ts` file to the root of the project, importing some module and do some logic, then reload the extension on your browser.

For further plasmo guidance, [visit plasmo Documentation](https://docs.plasmo.com/)


