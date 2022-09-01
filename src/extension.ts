// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { Color, Shogi } from 'shogi.js';
import sharp = require('sharp');
import { Kind } from 'shogi.js/dist/src/Kind';

const CELL_SIZE=24;
const HAND_HEIGHT=18;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const imageBuilder = new ImageBuilder;
	await imageBuilder.init();
	let disposable = vscode.languages.registerHoverProvider("*", {
		async provideHover(document, position) {
			const range = document.getWordRangeAtPosition(position, new RegExp("[a-zA-Z0-9 /+-]+"));
			let sfen: String;
			try {
				sfen = extractSfen(document.getText(range));
			} catch(e) {
				if (e instanceof Error) {
					console.log(e.message);
					return;
				} else {
					throw e;
				}
			}

			const shogi = new Shogi;
			shogi.initializeFromSFENString(sfen.toString());

			const b = await imageBuilder.build(shogi);

			return new vscode.Hover(new vscode.MarkdownString(`![](data:image/png;base64,${b.toString("base64")})`));
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

// A class that creates a image. It holds image buffers to reduce latency at runtime.
class ImageBuilder {
	private pieceMap: Map<Kind, Buffer> = new Map<Kind, Buffer>;
	private pieceMapR: Map<Kind, Buffer> = new Map<Kind, Buffer>;
	private black: Buffer | null = null;
	private white: Buffer | null = null;
	private turn: Buffer | null = null;
	private background: Buffer | null = null;
	private largeBackground: Buffer | null = null;
	private initialized: boolean = false;

	async init() {
		this.pieceMap.set("FU", makePieceImage("歩"));
		this.pieceMap.set("KY", makePieceImage("香"));
		this.pieceMap.set("KE", makePieceImage("桂"));
		this.pieceMap.set("GI", makePieceImage("銀"));
		this.pieceMap.set("KI", makePieceImage("金"));
		this.pieceMap.set("KA", makePieceImage("角"));
		this.pieceMap.set("HI", makePieceImage("飛"));
		this.pieceMap.set("OU", makePieceImage("玉"));
		this.pieceMap.set("TO", makePieceImage("と"));
		this.pieceMap.set("NY", makePieceImage("杏"));
		this.pieceMap.set("NK", makePieceImage("杏"));
		this.pieceMap.set("NG", makePieceImage("全"));
		this.pieceMap.set("UM", makePieceImage("馬"));
		this.pieceMap.set("RY", makePieceImage("龍"));
		for (const pt of this.pieceMap.keys()) {
			const image = await sharp(this.pieceMap.get(pt)).rotate(180).toBuffer();
			this.pieceMapR.set(pt, image);
		}

		this.black = makePieceImage("☗");
		this.white = makePieceImage("☖");

		this.background = await this.buildBackground(11 * CELL_SIZE + 1, 9 * CELL_SIZE);
		this.largeBackground = await this.buildBackground(11 * CELL_SIZE + 1, 12 * CELL_SIZE);

		this.turn = await sharp({
			create: {
				width: CELL_SIZE,
				height: CELL_SIZE,
				channels: 4,
				background: "#ffff0066",
			}
		}).png().toBuffer();

		this.initialized = true;
	}

	async build(shogi: Shogi) {
		if (!this.initialized) {
			await this.init();
		}

		let {composites, isLarge} = this.buildHand(shogi);
		composites = composites.concat(this.buildBoard(shogi));

		const board = (isLarge ? this.largeBackground : this.background) as Buffer;
		return sharp(board).composite(composites).png().toBuffer();
	}

	private buildBoard(shogi: Shogi) {
		let composites = [];
		for (let j = 0; j < 9; ++j) {
			for (let i = 0; i < 9; ++i) {
				const p = shogi.board[8 - i][j];
				if (p === null) {
					continue;
				}

				const color = p.color;
				const pt = p.kind;
				const pieceImage = color ? this.pieceMapR.get(pt) : this.pieceMap.get(pt);
				composites.push({
					input: pieceImage,
					left: (i + 1) * CELL_SIZE,
					top: (j) * CELL_SIZE,
				});
			}
		}
		return composites;
	}

	private buildHand(shogi: Shogi) {
		let composites = [];
		composites.push({
			input: this.black as Buffer,
			left: 10 * CELL_SIZE,
			top: 0
		});
		composites.push({
			input: this.white as Buffer,
			left: 0,
			top: 0
		});

		let isLarge = false;
		for (let i = 0; i < 2; ++i) {
			const hand = shogi.hands[i];

			let h = 1;
			for (let pt of this.pieceMap.keys()) {
				const count = hand.filter(function(x) { return x.kind === pt; }).length;
				if (count === 0) {
					continue;
				}

				composites.push({
					input: this.pieceMap.get(pt),
					left: i === 0 ? 10 * CELL_SIZE : 0,
					top: h * HAND_HEIGHT
				});
				h++;
				if (count > 1) {
					composites.push({
						input: makePieceImage(count.toString()),
						left: i === 0 ? 10 * CELL_SIZE : 0,
						top: h * HAND_HEIGHT
					});
					h++;
				}
			}

			if (h > 11) {
				isLarge = true;
			}
		}

		composites.push({
			input: this.turn as Buffer,
			left: shogi.turn === Color.Black ? 10 * CELL_SIZE : 0,
			top: 0,
		});
		return {composites, isLarge};
	}

	private async buildBackground(width: Number, height: Number) {
		const verticalLine = await sharp({
			create: {
				width: 1,
				height: 9 * CELL_SIZE,
				channels: 3,
				background: "#000000",
			}
		}).png().toBuffer();
		const horizontalLine = await sharp({
			create: {
				width: 9 * CELL_SIZE,
				height: 1,
				channels: 3,
				background: "#000000",
			}
		}).png().toBuffer();

		let composites = [];
		for (let i = 0; i < 10; ++i) {
			composites.push({
				input: verticalLine,
				left: (i + 1) * CELL_SIZE,
				top: 0
			});
			composites.push({
				input: horizontalLine,
				left: CELL_SIZE,
				top: i * CELL_SIZE,
			});
		}

		return await sharp({
			create: {
				width: width as number,
				height: height as number,
				channels: 4,
				background: "#FFFFFFFF",
			}
		}).composite(composites).png().toBuffer();
	}
}

function makePieceImage(s: String) {
	return Buffer.from(`
		<svg width="${CELL_SIZE}" height="${CELL_SIZE}">
			<text x="50%" y="50%" text-anchor="middle" dy="0.43em" font-size="16" fill="#000" font-family="serif">${s}</text>
		</svg>
	`);
}

// Check if `str` contains SFEN string. If so, this function will return the found SFEN string.
// Otherwise, raise an error.
function extractSfen(str: String) : String {
	const words = str.split(" ");
	for (let i = 0; i < words.length; ++i) {
		const word = words[i];
		if (word.split("/").length === 9) {
			return words.slice(i).join(" ");
		}
	}

	throw new Error("str is not a sfen");
}