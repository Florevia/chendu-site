# 晨读 · 每日英文精读（chendu-english）

Live site: **https://chendu-english.vercel.app/** (stable production alias).
Each issue is a real, recent English article, quoted verbatim as an excerpt of about 300–450 words with credit to the source. It comes with handwritten-style Chinese margin notes, review words, sentence patterns, TTS audio and a related podcast. Topics alternate daily between **US stocks (stocks)** and **AI tech (ai)**.

## Folder layout

```
index.html                     home page: latest issue + archive (generated)
issues/YYYY-MM-DD/data.json    ← the only file you write by hand each day
issues/YYYY-MM-DD/index.html   issue page (generated)
issues/YYYY-MM-DD/audio.mp3, audio-slow.mp3, zh-hand.woff2   (generated)
assets/style.css, assets/issue.js            shared styles and interaction (hand-written)
assets/fonts/caveat.woff2, zh-hand-index.woff2   (generated subsets)
tools/build.py          generator: validate / TTS / font subsets / render HTML
tools/vercel-build.sh   build script run on Vercel (pip install → download fonts → TTS → render → public/)
tools/deploy_payload.py prints the files array for the Vercel connector's create_deployment
tools/deployed-shas.json  sha1s of source files already stored on Vercel (managed by deploy_payload --mark)
tools/fonts/            source fonts (Ma Shan Zheng, Caveat; from github.com/google/fonts; not deployed)
vercel.json             build/output config, cleanUrls, trailingSlash, cache headers
```

## Reader features (shared, in `assets/issue.js` + `assets/style.css`)

These live entirely in the shared assets and the `tools/build.py` template, so every past and future issue gets them on rebuild. There is nothing to add to data.json.

- **Built-in notes:** on wide screens notes sit in the margins; hovering or clicking a highlight emphasizes its note. On narrow screens (≤1060px) notes are collapsed and **only one is open at a time**. Tapping a marker opens its note and closes any other (built-in or 我的笔记). Tapping the same marker again, or anywhere outside the notes, closes it. 「展开全部笔记」 still expands everything.
- **Reader's own notes (我的笔记):** selecting text in the issue title (the English `h1.title` or the Chinese `.zh-title`, including a selection that spans both) or in the article (mouse or touch, including across paragraphs) shows a floating 「✏️ 加笔记」 button. Saved notes get an amber highlight plus a ✎ marker. Article notes sit in the margin; title notes sit under the Chinese title (on a narrow screen they stay collapsed until the marker is tapped, same as paragraph notes). They can be edited and deleted (deleting offers 撤销). They are also listed in the 「我的笔记」 section at the bottom, with 「复制全部笔记」 and 「导出 .md 文件」.
  - Storage: `localStorage["chendu:notes:<issue date>"] = {v:1, notes:[{id, quote, prefix, suffix, start, end, text, created, updated, scope?}]}`. Paragraph notes omit `scope`; their offsets index the article's paragraph text joined by `\n`. Title notes set `scope` to `"title"` and index `h1.title` plus `.zh-title`, also joined by `\n`. Superscript numbers are excluded. On load each note is re-located by `quote` inside its own text: an occurrence whose 32-char `prefix`/`suffix` context matches wins, otherwise the one closest to the saved `start`. A note whose quote no longer exists stays in the list, marked 「原文位置未找到」.
  - The issue id comes from `<body data-issue="YYYY-MM-DD">`, which `build.py` emits.
  - On touch or narrow screens the 「✏️ 加笔记」 button is a fixed bar at the bottom of the viewport, so it stays clear of the native iOS/Android selection menu. With a mouse it floats under the selection.
- **Paragraph translations (写翻译):** under each English paragraph there is a quiet 「写翻译」 control. It opens a textarea, saves automatically, and collapses to the translation with an 「编辑」 link. 「清空」 removes it. Filled translations print; the buttons and the editor do not. Empty paragraphs stay as a single text button on screen and disappear in print.
  - Storage: `localStorage["chendu:tr:<issue date>"] = {v:1, items:[{i, key, text, updated}]}`, separate from reader notes. `key` is the first 64 characters of that paragraph (superscripts excluded, whitespace collapsed). On load a translation is attached only to the paragraph with the same `key`; `i` breaks a tie. A translation whose paragraph text no longer matches is kept in storage but not shown under a different paragraph.
- **Example sentences in margin notes:** `build.py` renders each sentence of a note's explanation (`.note .nz`) on its own line. An English example sentence — marked `例：` / `例如：` / `例句：`, or a full sentence after an introducer such as `常用：` — is an italic line of its own, so it does not run on into the Chinese gloss (`例：Wages haven’t kept pace with inflation. 同义 keep up with。` becomes two lines). Periods in `5.8%` or `U.S.`, and `。` inside `（）`, are not sentence breaks. 复习词 examples already sit in their own table column, and 句型 examples already sit in `.from` / `.model` / `.modelzh`.
- **Recall checklist (批注回顾):** at the end of every issue, one checkbox row per margin note, in reading order. Each row shows the note number (a link back to that highlight), the type tag (词汇 / 语法 / 地道表达) and the note head. The Chinese gloss stays hidden until the row is hovered (mouse) or tapped. Checked items persist per issue; 「清空勾选」 clears them and offers 撤销. Print shows every gloss and hides the hint and the reset button.
  - Storage: `localStorage["chendu:recall:<issue date>"] = {v:1, done:["<note head>", …]}`. Heads are unique within an issue, so a later renumber still matches. A head that no longer exists is ignored.
- **Asset versioning:** `vercel.json` serves `/assets/*` with `max-age=86400`, so `build.py` writes every asset URL with a content hash (`style.css?v=<sha1[:10]>`). Without the hash, returning visitors get the new HTML (which is `must-revalidate`) together with up-to-a-day-old cached CSS/JS. Always rebuild after editing anything in `assets/`.

## Daily routine

1. **Pick the article.** Use a real article from the last 1–2 days on today's topic (alternating stocks/ai). Copy 300–450 words verbatim and invent nothing. AP, Reuters and similar sources are fine. Verify the URL returns 200; if the original site blocks access, use a syndicated copy such as WRAL or the Inquirer.
2. **Write the data.** Create `issues/YYYY-MM-DD/data.json`, copying the fields from the previous issue:
   - `article.sections`: a list of consecutive blocks, each block a list of paragraphs.
   - `notes`: each note has `p:[block,paragraph]`. Its `anchor` must be text copied exactly from the original (curly quotes ’ included), and anchors must not overlap. `type` is vocab/grammar/idiom.
   - `review_words` (with IPA), `patterns` (2–4 sentence patterns) and `podcast` (verify the link).
   - `audio`: `{"normal":"audio.mp3","slow":"audio-slow.mp3","voice":"en-US-AriaNeural"}`.
3. **Build and check locally (optional but recommended).**
   ```bash
   /workspace/.venv-chendu/bin/python tools/build.py --tts YYYY-MM-DD   # generate both mp3s and render
   /workspace/.venv-chendu/bin/python tools/build.py --check            # anchors / overlaps / audio
   ffprobe -v error -show_entries format=duration -of csv=p=0 issues/YYYY-MM-DD/audio.mp3
   ```
   (Generated HTML, mp3s and woff2 files are **not** uploaded; Vercel regenerates them itself.)
4. **Deploy** (see below).

## Deployment (Vercel MCP connector `user-Vercel`; no CLI or token needed)

- Account: `scoheart` (Hobby). The connector's `list_teams` returns an empty list, so **omit teamId/slug** from every call. The account's default scope is `team_kRkJlY851VQXBAedTn8weYf7` (scohearts-projects).
- Project: **`chendu-english`**, id **`prj_nQMT5Sb9P8sVtVdnRcAUGM3vDa7U`**.
  - Settings: framework `null`; buildCommand `bash tools/vercel-build.sh`; outputDirectory `public`.
  - Vercel Authentication (ssoProtection) was turned **off** at creation (`ssoProtection: null`) and password protection is off, so the site is public.
- Production aliases: `chendu-english.vercel.app` (stable) and `chendu-english-scohearts-projects.vercel.app`.

**Why it is done this way:** the connector can only receive file contents as tool arguments. The mp3s (~2 MB) and fonts can't realistically go through that route. So we deploy **only the text sources** (vercel.json, build.py, vercel-build.sh, css, js and every data.json). Vercel's build machine then installs edge-tts/fonttools, downloads the source fonts from google/fonts, generates the mp3s, renders the HTML and outputs to `public/`. The first deployment showed that the HTML Vercel generates is byte-identical to the local build.

Steps:

1. `python3 tools/deploy_payload.py` prints the `files` array:
   - Files already on Vercel (their sha1 is in `tools/deployed-shas.json`) appear as `{file, sha, size}` references and need no content.
   - New or changed files (usually just today's data.json) are inlined as `{file, encoding:"utf-8", data}`.
   - data.json is sent in compact form automatically.
2. Call `create_deployment`. Leave the content of `files` exactly as the script printed it:
   ```json
   {"skipAutoDetectionConfirmation":"1",
    "requestBody":{"name":"chendu-english","project":"chendu-english","target":"production",
                   "files":[ …the array from step 1… ]}}
   ```
   (`projectSettings` was only needed for the first deployment and is saved on the project. If a reference returns a "missing file" error, rerun the script with `--all` to inline everything.)
3. Poll `get_deployment` (`idOrUrl` = the returned dpl_… id) until `readyState` is `READY` (about 30–60 s). If it goes to `ERROR`, read the build log with `list_deployment_events`.
4. Run `python3 tools/deploy_payload.py --mark` to record the uploaded shas.
5. Check the live site: run `curl -sI` against `https://chendu-english.vercel.app/`, `/issues/YYYY-MM-DD/` and `/issues/YYYY-MM-DD/audio.mp3`. Expect 200 for each, and `audio/mpeg` for the mp3.

Note: every build re-synthesizes **all** issues' audio with edge-tts, at roughly 5–10 s per issue. Once the archive reaches hundreds of issues, consider switching mp3s to external storage or adding a build cache.

## Copyright

The English text is an excerpt from the original media outlet (credited with a link on each page) for personal study only. The Chinese notes are original.

## Source repository

Source lives at https://github.com/Scoheart/chendu-site (private). After each daily issue is generated and deployed, commit and push this repo (`git add -A && git commit -m "issue YYYY-MM-DD" && git push`).
