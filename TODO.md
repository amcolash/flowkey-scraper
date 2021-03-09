# Todo

## First Release

- [x] Bug where 2nd time opening sheet music doesn't show - probably need to wipe the noteflight container, skip NF re-init
- [x] Adjust bpm ui
- [x] Remove named part "Piano"
- [x] Clear tmp/ cache button
- [x] Import into noteflight (via launch api)
- [x] Home button disabled when parsing
- [x] Remove imagemagick dependency (preferably replace with pure opencv)
- [x] Icon
- [x] Redo with opencv.js
- [x] Navigation for webview (add home/forward/back buttons + urlbar that is disabled)
- [x] Test on all platforms
  - [x] Linux
  - [x] Mac
  - [x] Windows
- [x] Add shadow to icon
  - [x] Make sure icon shows up w/ linux AppImage once installed
- [x] Update checking
- [ ] Docs / Screenshots
- [ ] Blog Post (Discuss v1, v2, v3 - full opencv + using song json data to try and correlate things, using opencv native, using opencvjs)

## Post Release?

- [ ] Home button to stop things running - right now it is just disabled
- [x] Cache deps for github ci
- [x] Replace `node-static` with `serve` or something without vulns
- [?] Fix updating console when opened and new lines appear, kinda works
