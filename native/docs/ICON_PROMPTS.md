# 筆記工具列自訂圖示（給生圖 AI）

輸出：**單色 SVG**，24×24，`viewBox="0 0 24 24"`，描邊 `stroke="currentColor"`、`stroke-width="1.75"`、圓角端點，**無填色**，風格接近 iOS Goodnotes 扁平線性圖示。檔名如下。

| 檔名 | 提示詞 |
|------|--------|
| `nb-pen.svg` | 手寫筆圖示，斜向筆身+筆尖，簡潔線性，24px |
| `nb-fountain.svg` | 鋼筆沾墨圖示，弧形筆尖+墨跡曲線，線性描邊 |
| `nb-highlighter.svg` | 螢光筆斜放，扁筆頭，線性 |
| `nb-eraser.svg` | 橡皮擦小塊，微斜，線性 |
| `nb-shapes.svg` | 正方形與圓形重疊，幾何工具，線性 |
| `nb-lasso.svg` | 套索繩圈虛線圍成圈，線性 |
| `nb-text.svg` | 大寫字母 T，文字工具，線性 |
| `nb-undo.svg` | 向左彎曲復原箭頭，線性 |
| `nb-redo.svg` | 向右彎曲重做箭頭，線性 |
| `nb-image.svg` | 山景相片框，插入圖片，線性 |
| `nb-materials.svg` | 文件+箭頭或書本，教材匯入，線性 |

放入 Xcode：`native/AIStudy/Assets.xcassets/nb-icons/` 各設 Image Set，程式改 `NotebookIcons` 讀取 asset。