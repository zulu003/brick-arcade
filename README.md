# Brick Arcade

Six small block games in one page. It works offline once opened, and can be installed to the home screen.

- Play: https://zulu003.github.io/brick-arcade/
- Single offline file: [brick-arcade.html](brick-arcade.html) (download it and open it in any browser)

## Editing

The pages in this folder are generated. Edit the files in `source/src/`, then run:

```
node source/build.js --bump
```

| Path | What it is |
| --- | --- |
| `source/src/page.html` | Markup for the menu, game screens and dialogs |
| `source/src/style.css` | All styles, including the light theme |
| `source/src/js/*.js` | Shared code and one file per game, joined in file-name order |
| `source/build.js` | Builds `index.html`, `brick-arcade.html` and `source/artifact.html` |
| `sw.js` | Offline cache; `--bump` raises its version so installed apps update |
