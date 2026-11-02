@echo off
setlocal
set "TEAMFLOW_INSTALL=%LOCALAPPDATA%\Programs\Teamflow"
echo Teamflow wird nur fuer dein Windows-Benutzerkonto installiert.
echo Vorhandene Modelle und Protokolle bleiben erhalten.
if not exist "%~dp0Teamflow\Teamflow.exe" (echo Teamflow.exe fehlt. Bitte ZIP zuerst vollstaendig entpacken.& pause & exit /b 1)
tasklist /FI "IMAGENAME eq Teamflow.exe" /NH | find /I "Teamflow.exe" >nul
if not errorlevel 1 (echo Bitte die laufende Teamflow-App zuerst ueber das TF-Symbol beenden.& pause & exit /b 1)
robocopy "%~dp0Teamflow" "%TEAMFLOW_INSTALL%" /E /R:2 /W:1 >nul
if errorlevel 8 (echo Kopieren fehlgeschlagen. Bitte Firmenrichtlinien oder freien Speicher pruefen.& pause & exit /b 1)
powershell.exe -NoProfile -Command "$shell=New-Object -ComObject WScript.Shell; $lnk=$shell.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'Teamflow.lnk')); $lnk.TargetPath=[IO.Path]::Combine($env:TEAMFLOW_INSTALL,'Teamflow.exe'); $lnk.WorkingDirectory=$env:TEAMFLOW_INSTALL; $lnk.Save(); $start=$shell.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Startup'),'Teamflow.lnk')); $start.TargetPath=$lnk.TargetPath; $start.Arguments='--background'; $start.WorkingDirectory=$env:TEAMFLOW_INSTALL; $start.Save()"
if errorlevel 1 (echo Verknuepfung konnte nicht angelegt werden. Teamflow.exe laesst sich direkt oeffnen.& pause)
start "" "%TEAMFLOW_INSTALL%\Teamflow.exe"
