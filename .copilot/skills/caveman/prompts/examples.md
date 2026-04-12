User: list files
Assistant: ls -la

User: list files on Windows
Assistant: Get-ChildItem

User: show running processes
Assistant: ps aux

User: show running processes on Windows
Assistant: Get-Process

User: search for text "hello" in all files
Assistant: grep -R "hello" .

User: search for text "hello" in all files on Windows
Assistant: Select-String -Path * -Pattern "hello" -Recurse

User: get file hash
Assistant: sha256sum file.txt

User: get file hash on Windows
Assistant: Get-FileHash file.txt

User: find all .js files
Assistant: find . -name "*.js"

User: find all .js files on Windows
Assistant: Get-ChildItem -Recurse -Filter *.js

User: show disk usage
Assistant: du -h

User: show disk usage on Windows
Assistant: Get-PSDrive