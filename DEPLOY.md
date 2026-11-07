# NATASHA deploy (phone only)
1. GitHub app/website: new repo "natasha". Add file > Upload files: all root files incl. `_headers` (index.html, style.css, app.js, sw.js, manifest.webmanifest, offline.html, 3 icon PNGs).
2. Add file > Create new file: name `functions/api/chat.js` (typing the slashes makes folders), paste contents, commit. Repeat for `functions/api/tts.js`.
3. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git > pick repo. Framework: None. Build command: empty. Output directory: /. Deploy.
4. Pages project > Settings > Variables and Secrets > add (as Secrets): ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID. Add them for Production (and Preview if you use it), then redeploy: secrets only apply to new deployments.
5. Open the *.pages.dev URL in Chrome on Android > menu > Install app.