# (not maintained) sfen-viewer

<img src="image/sfen-viewer.png" width="100px">

VSCode上でSFEN文字列を画像として表示するプラグインがあると便利だと思い開発を始めたが、
プラットフォームに依存せずに画像生成するのが結構たいへんなので開発凍結。悲しい。

![image](image.png)

以下のコマンドでローカル環境にインストールできる。

```sh
npm install
vsce package
code --install-extension sfen-viewer-0.0.1.vsix
```
