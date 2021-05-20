# Changelog

## 0.9.0 (2021-05-20)

### Added

- Audiveris parsing warnings now reported on score view

### Fixed

- "Open In Noteflight" fixed and works without local server
- Some time signatures were accidentally cut off and failed parsing

### Updated

- Updated most application dependencies to latest (exceptions listed):
  - `electron` is `11.x.x`, instead of 12
  - `webpack` is still `4.x.x`, instead of 5
- Internal code changes to make `Log` component a bit nicer

## 0.8.0 (2021-05-14)

### Updated

- Audiveris parsing will not necessarily crash things
- Handle missing xml file in stages better

### Fixed

- Song titles/artists were not escaped in xml, this caused parsing errors
- "Save MusicXml" now properly works

## 0.7.0 (2021-05-14)

### Added

- Support for changing time signatures in the middle of a song
- `2/4` time signature

### Removed

- Cleaned up old parsing code

## 0.6.0 (2021-03-10)

### Added

- Version now shown in title bar

### Fixed

- "Open in Noteflight" now actually works
- License in `packag.json` matches repo license
- Windows portable/installer binaries with Github Actions

### Updated

- Remove `.zip` version of mac app
- README now has info about usage
- Update some dependencies

## 0.5.0 (2021-03-09)

### Added

- Navigation in the flowkey webview
- Automatic Updates

### Fixed

- Linux AppImage and icon

## 0.4.0 (2021-03-09) - First Public Release!

### Updated

- Move from `opencv4nodejs` to `opencv4js` (one is native, one is WASM)

### Fixed

- Fix cross-platform builds and tools for all 3 platforms

### Removed

- Remove `opencv4nodejs` in favor of the pure WASM version

## 0.3.0 (2021-02-05)

### Added

- Github deploy
- App Icon
- Github actions cache

### Fixed

- Fix bug in `main/index.js` on boot

### Updated

- Replace `node-static` with `serve` which is updated and no security vulnerabilities

## 0.2.0 (2021-02-05)

### Removed

- Imagemagick global dependency, now using pure opencv

## 0.1.0 (2021-02-05)

### Added

- Frist release (with tag)

### Fixed

- Clean up CI Build with slimmed down opencv
