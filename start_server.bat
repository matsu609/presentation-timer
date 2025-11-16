@echo off
echo ローカルウェブサーバーを起動します...
echo.
echo ブラウザで http://localhost:8000 にアクセスしてください。
echo.
py -m http.server 8000
echo.
echo サーバーを停止するには、このウィンドウを閉じるか、Ctrl+Cを押してください。
echo このウィンドウは閉じないでください。
pause
