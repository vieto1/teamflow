@echo off
powershell.exe -NoProfile -Command "$link=[IO.Path]::Combine([Environment]::GetFolderPath('Startup'),'Teamflow.lnk'); if(Test-Path -LiteralPath $link){Remove-Item -LiteralPath $link}"
echo Autostart ausgeschaltet. App, Modelle und Aufnahmen bleiben erhalten.
pause
