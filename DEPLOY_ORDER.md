# GitHub + Firebase 建議部署順序

1. **備份現有 Japan EC Dashboard 與 Firestore Rules。**
2. **確認共用同一個 Firebase Project。** 不要建立第二個 Firebase，否則資料不會連動。
3. 從既有專案複製相同 Firebase Web App 設定，建立 `firebase-config.js`（格式參考 `firebase-config.example.js`）。
4. **先更新 Firestore Rules。** 將本專案 `firestore.rules` 中新增 collection 的規則合併到你目前正式 Rules；不要覆蓋/刪除既有 products、sales 等規則。
5. Firebase Authentication：確認 Email/Password 已啟用；`users/{UID}/role` 建議 admin / manager 才能寫入。
6. 建立新的 GitHub Repository，例如 `vendor-settlement-dashboard`，與現有網站分開。
7. 將 ZIP 內檔案上傳到新 repo root：`index.html`、`styles.css`、`app.js`、`firebase-config.js` 等。
8. GitHub → Settings → Pages → Deploy from a branch → `main` / root。
9. 打開新網址，先測：登入、讀取既有 sales、Viewer 唯讀、Manager/Admin 可新增物流資料。
10. 手動新增 1 筆 shipmentCosts，重新整理後確認仍存在。
11. 再用 3–5 筆測試 Excel 測物流匯入；確認後再上正式物流檔。
12. 建立廠商結算設定與月結參數。
13. 最後才開始正式月結與大量匯入。

正式順序：**Firestore Rules → Authentication/角色 → GitHub Pages → 少量測試 → 正式匯入**。
