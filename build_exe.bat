@echo off
setlocal
echo ============================================
echo   LEBL Editor - Build Standalone EXE
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Preparing embedded Python...
call src-tauri\setup_python.bat
if errorlevel 1 (
    echo.
    echo ERROR: Python setup failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Building frontend (npm run build)...
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Frontend build failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Building Tauri application...
call npm run tauri build
if errorlevel 1 (
    echo.
    echo ERROR: Tauri build failed.
    pause
    exit /b 1
)

echo.
echo [4/4] Renaming installers...
set BUNDLE_DIR=src-tauri\target\release\bundle

if exist "%BUNDLE_DIR%\msi\LEBL Editor_0.1.0_x64_en-US.msi" (
    move /Y "%BUNDLE_DIR%\msi\LEBL Editor_0.1.0_x64_en-US.msi" "%BUNDLE_DIR%\msi\LEBL Editor_0.1.0_x64.msi" >nul
    echo   MSI renamed to: LEBL Editor_0.1.0_x64.msi
)

echo.
echo ============================================
echo   Build complete!
echo ============================================
echo.
echo EXE location:
echo   src-tauri\target\release\lebl-editor.exe
echo.
echo Installer location:
echo   %BUNDLE_DIR%\msi\LEBL Editor_0.1.0_x64.msi
echo   %BUNDLE_DIR%\nsis\LEBL Editor_0.1.0_x64-setup.exe
echo.
pause
