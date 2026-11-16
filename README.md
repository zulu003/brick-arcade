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
| `source/test.js`, `source/tests.js` | Automated checks (see below) |

## Testing

```
node source/test.js          # every test
node source/test.js pop      # only tests whose name contains "pop"
```

Needs Node 22 or newer and Chrome or Edge (set `CHROME` to its path if it is somewhere unusual); nothing to install.
It builds the page, opens it in headless Chrome with a hook into the game code, and plays each game:
random play with board checks, stage clears, saves and resume, daily boards, achievements, record
export/import, and a text-contrast check of every screen in both themes. Run it before every release.
