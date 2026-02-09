@echo off
setlocal

REM Download Python 3.10.11 embeddable package for Windows
set PYTHON_VERSION=3.10.11
set PYTHON_ZIP=python-%PYTHON_VERSION%-embed-amd64.zip
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/%PYTHON_ZIP%
set TARGET_DIR=%~dp0python-embed

if exist "%TARGET_DIR%\python.exe" (
    echo Python embeddable already exists in %TARGET_DIR%
    exit /b 0
)

echo Downloading Python %PYTHON_VERSION% embeddable package...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

powershell -Command "Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%TARGET_DIR%\%PYTHON_ZIP%'"
if errorlevel 1 (
    echo ERROR: Failed to download Python embeddable package.
    exit /b 1
)

echo Extracting...
powershell -Command "Expand-Archive -Path '%TARGET_DIR%\%PYTHON_ZIP%' -DestinationPath '%TARGET_DIR%' -Force"
if errorlevel 1 (
    echo ERROR: Failed to extract Python embeddable package.
    exit /b 1
)

del "%TARGET_DIR%\%PYTHON_ZIP%"

echo Python embeddable package ready in %TARGET_DIR%
