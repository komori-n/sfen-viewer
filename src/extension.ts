// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { Shogi } from "shogi.js";
import { Buffer } from "buffer";
import { Kind } from "shogi.js/dist/src/Kind";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.languages.registerHoverProvider("*", {
    async provideHover(document, position) {
      const selectors = vscode.workspace
        .getConfiguration()
        .get<string[]>("sfen-viewer.file-selector", [])
        .map((pattern) => ({ pattern: pattern }));
      if (
        selectors.length !== 0 &&
        !vscode.languages.match(selectors, document)
      ) {
        console.log(selectors);
        return null;
      }

      const range = document.getWordRangeAtPosition(
        position,
        new RegExp("[a-zA-Z0-9 /+-]+")
      );
      let sfen: String;
      try {
        sfen = extractSfen(document.getText(range));
      } catch (e) {
        if (e instanceof Error) {
          console.log(e.message);
          return;
        } else {
          throw e;
        }
      }

      const shogi = new Shogi();
      shogi.initializeFromSFENString(sfen.toString());

      const colorTheme = vscode.workspace
        .getConfiguration()
        .get("sfen-viewer.text-color");
      let isDark = false;
      if (colorTheme === "white") {
        isDark = true;
      } else if (colorTheme === "default") {
        const kind = vscode.window.activeColorTheme.kind;
        if (
          kind === vscode.ColorThemeKind.Dark ||
          kind === vscode.ColorThemeKind.HighContrast
        ) {
          isDark = true;
        }
      }
      const fontSize = vscode.workspace
        .getConfiguration()
        .get("sfen-viewer.font-size") as Number;

      const svg = render(shogi, { isDark: isDark, fontSize: fontSize });
      const svgString = Buffer.from(svg).toString("base64");
      return new vscode.Hover(
        new vscode.MarkdownString(`![](data:image/svg+xml;base64,${svgString})`)
      );
    },
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

const pieceMap = new Map<Kind, String>([
  ["FU", "???"],
  ["KY", "???"],
  ["KE", "???"],
  ["GI", "???"],
  ["KI", "???"],
  ["KA", "???"],
  ["HI", "???"],
  ["OU", "???"],
  ["TO", "???"],
  ["NY", "???"],
  ["NK", "???"],
  ["NG", "???"],
  ["UM", "???"],
  ["RY", "???"],
]);

type RenderConfiguration = {
  isDark: Boolean;
  fontSize: Number;
};

function render(shogi: Shogi, config: RenderConfiguration): String {
  console.log(shogi);

  const FONT_SIZE = +config.fontSize;
  const CELL_SIZE = (FONT_SIZE / 3) * 4;
  const HAND_HEIGHT = (CELL_SIZE * 3) / 4;
  const HAND_FONT_SIZE = (CELL_SIZE * 3) / 5;
  const HALF_CELL_SIZE = CELL_SIZE / 2;
  const HAND_X_ADJUST = CELL_SIZE / 8;
  const IMAGE_WIDTH = CELL_SIZE * 11 + 4;
  const DEFAULT_IMAGE_HEIGHT = CELL_SIZE * 9 + 1;
  const TEXT_COLOR = config.isDark ? "white" : "black";

  let elements: Array<String> = [];
  let height = DEFAULT_IMAGE_HEIGHT;

  // board
  for (let i = 0; i < 10; ++i) {
    elements.push(
      lineElement(
        CELL_SIZE,
        i * CELL_SIZE,
        10 * CELL_SIZE,
        i * CELL_SIZE,
        TEXT_COLOR
      )
    );
    elements.push(
      lineElement(
        (i + 1) * CELL_SIZE,
        0,
        (i + 1) * CELL_SIZE,
        9 * CELL_SIZE,
        TEXT_COLOR
      )
    );
  }

  // pieces on the board
  for (let j = 0; j < 9; ++j) {
    for (let i = 0; i < 9; ++i) {
      let p = shogi.board[8 - i][j];
      if (p === null) {
        continue;
      }

      const color = p.color;
      const pt = p.kind;

      elements.push(
        textElement(
          pieceMap.get(pt) ?? "",
          (i + 1) * CELL_SIZE + HALF_CELL_SIZE,
          (j + 1) * CELL_SIZE - CELL_SIZE / 5,
          FONT_SIZE,
          TEXT_COLOR,
          !!color
        )
      );
    }
  }

  // hand pieces
  elements.push(
    textElement(
      "???",
      HALF_CELL_SIZE - HAND_X_ADJUST,
      HAND_HEIGHT,
      HAND_HEIGHT,
      TEXT_COLOR
    )
  );
  elements.push(
    textElement(
      "???",
      CELL_SIZE * 10 + HALF_CELL_SIZE + HAND_X_ADJUST,
      HAND_HEIGHT,
      HAND_HEIGHT,
      TEXT_COLOR
    )
  );
  if (shogi.turn) {
    elements.push(
      `<rect x="0" y="0" width="${HAND_HEIGHT}" height="${
        HAND_HEIGHT + 4
      }" fill="#ffff0066"/>`
    );
  } else {
    elements.push(
      `<rect x="${
        10 * CELL_SIZE + 2 * HAND_X_ADJUST
      }" y="0" width="${HAND_HEIGHT}" height="${
        HAND_HEIGHT + 4
      }" fill="#ffff0066"/>`
    );
  }
  for (let i = 0; i < 2; ++i) {
    const hand = shogi.hands[i];

    let h = 1;
    for (let pt of pieceMap.keys()) {
      const count = hand.filter(function (x) {
        return x.kind === pt;
      }).length;
      if (count === 0) {
        continue;
      }

      elements.push(
        textElement(
          pieceMap.get(pt) ?? "",
          (1 - i) * 10 * CELL_SIZE +
            HALF_CELL_SIZE -
            (i * 2 * HAND_X_ADJUST - HAND_X_ADJUST),
          (h + 1) * HAND_HEIGHT,
          HAND_FONT_SIZE,
          TEXT_COLOR
        )
      );
      h++;
      if (count > 1) {
        elements.push(
          textElement(
            count.toString(),
            (1 - i) * 10 * CELL_SIZE +
              HALF_CELL_SIZE -
              (i * 2 * HAND_X_ADJUST - HAND_X_ADJUST),
            (h + 1) * HAND_HEIGHT,
            HAND_FONT_SIZE,
            TEXT_COLOR
          )
        );
        h++;
      }
    }
    if (height < (h + 1) * HAND_HEIGHT) {
      height = (h + 1) * HAND_HEIGHT;
    }
  }

  let svg = `<svg
		width="${IMAGE_WIDTH}"
		height="${height}"
		xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i < elements.length; ++i) {
    svg += elements[i];
  }
  svg += `</svg>`;

  return svg;
}

function lineElement(
  x1: Number,
  y1: Number,
  x2: Number,
  y2: Number,
  color: String
): String {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"/>`;
}

function textElement(
  text: String,
  x: Number,
  y: Number,
  size: Number,
  color: String,
  rev: boolean = false
): String {
  if (rev) {
    return `
			<text
				font-size="${size}"
				fill="${color}"
				text-anchor="middle"
				font-family="serif"
				transform="translate(${x},${+y - (+size * 4) / 5}) rotate(180)"
			>
				${text}
			</text>`;
  } else {
    return `
			<text
				x="${x}"
				y="${y}"
				font-size="${size}"
				fill="${color}"
				font-family="serif"
				text-anchor="middle">
				${text}
			</text>`;
  }
}

// Check if `str` contains SFEN string. If so, this function will return the found SFEN string.
// Otherwise, raise an error.
function extractSfen(str: String): String {
  const words = str.split(" ");
  for (let i = 0; i < words.length; ++i) {
    const word = words[i];
    if (word.split("/").length === 9) {
      return words.slice(i).join(" ");
    }
  }

  throw new Error("str is not a sfen");
}
