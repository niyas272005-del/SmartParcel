@echo off
setlocal
where mvn >nul 2>nul
if %ERRORLEVEL% equ 0 (
    mvn %*
) else if exist "%USERPROFILE%\.m2\wrapper\dists\apache-maven-3.9.12\59fe215c0ad6947fea90184bf7add084544567b927287592651fda3782e0e798\bin\mvn.cmd" (
    "%USERPROFILE%\.m2\wrapper\dists\apache-maven-3.9.12\59fe215c0ad6947fea90184bf7add084544567b927287592651fda3782e0e798\bin\mvn.cmd" %*
) else (
    echo Maven not found.
    exit /b 1
)

