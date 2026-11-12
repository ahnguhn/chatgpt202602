@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Upload week 11 student projects to GitHub.
rem Excluded file types: PDF, HWP, HWPX.
rem If the remote repository is empty, the first branch is created automatically.

set "REPO_URL=https://github.com/ahnguhn/chatgpt202602.git"
set "SOURCE_DIR=%~dp0"
if "!SOURCE_DIR:~-1!"=="\" set "SOURCE_DIR=!SOURCE_DIR:~0,-1!"
set "WORK_DIR=%TEMP%\chatgpt202602_week11_upload"
set "COMMIT_MESSAGE=Add week 11 student web projects"
set "IN_WORKTREE="
set "BRANCH="

if /I "%~1"=="--check" (
    echo CHECK_OK
    echo SOURCE_DIR=%SOURCE_DIR%
    echo WORK_DIR=%WORK_DIR%
    exit /b 0
)

echo.
echo [1/7] Checking Git installation...
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git was not found. Install Git and run this file again.
    goto :fail
)

echo.
echo [2/7] Preparing the GitHub repository...
if exist "%WORK_DIR%\.git" (
    pushd "%WORK_DIR%"
    set "IN_WORKTREE=1"
    git remote set-url origin "%REPO_URL%"
    git fetch origin
    if errorlevel 1 goto :git_fail
) else (
    if exist "%WORK_DIR%" (
        echo ERROR: The temporary folder exists but is not a Git repository.
        echo Rename or remove this folder, then run the file again:
        echo %WORK_DIR%
        goto :fail
    )
    git clone "%REPO_URL%" "%WORK_DIR%"
    if errorlevel 1 goto :git_fail
    pushd "%WORK_DIR%"
    set "IN_WORKTREE=1"
)

echo.
echo [3/7] Detecting the working branch...
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not defined BRANCH (
    set "BRANCH=master"
    git checkout -b "!BRANCH!"
    if errorlevel 1 goto :git_fail
)
echo Using branch: !BRANCH!

git ls-remote --exit-code --heads origin "!BRANCH!" >nul 2>&1
if not errorlevel 1 (
    git pull --ff-only origin "!BRANCH!"
    if errorlevel 1 goto :git_fail
)

echo.
echo [4/7] Copying files except PDF, HWP, and HWPX...
robocopy "%SOURCE_DIR%" "%WORK_DIR%" /E /R:2 /W:1 /XF *.pdf *.hwp *.hwpx /XD .git
set "ROBOCOPY_RC=!ERRORLEVEL!"
echo Robocopy exit code: !ROBOCOPY_RC!
if !ROBOCOPY_RC! GEQ 8 (
    echo ERROR: File copy failed with exit code !ROBOCOPY_RC!.
    goto :fail
)

echo.
echo [5/7] Staging changed files...
git add -A
if errorlevel 1 goto :git_fail

git diff --cached --quiet
if not errorlevel 1 (
    echo No new changes to commit.
    goto :success
)

echo.
echo [6/7] Committing changes...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :git_fail

echo.
echo [7/7] Pushing the current branch to GitHub...
git push -u origin HEAD
if errorlevel 1 goto :git_fail

goto :success

:git_fail
echo.
echo ERROR: A Git command failed.
echo Check GitHub login, Internet access, repository permission, and Git user settings.
goto :fail

:success
if defined IN_WORKTREE popd 2>nul
set "IN_WORKTREE="
echo.
echo ============================================================
echo Completed. Files were pushed to branch: !BRANCH!
echo PDF, HWP, and HWPX files were excluded.
echo Repository: %REPO_URL%
echo Temporary folder: %WORK_DIR%
echo ============================================================
pause
exit /b 0

:fail
if defined IN_WORKTREE popd 2>nul
set "IN_WORKTREE="
echo.
echo The upload was not completed.
pause
exit /b 1
