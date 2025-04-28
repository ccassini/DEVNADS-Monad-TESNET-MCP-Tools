@echo off
echo Setting up git remote...
git remote add origin https://github.com/ccassini/DEVNADS-Monad-TESNET-MCP-Tools.git
echo Remote set up complete. Pushing to GitHub...
git branch -M main
git push -u origin main
echo Process completed.
pause 