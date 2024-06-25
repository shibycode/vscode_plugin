const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// 获取工作区所有代码
function getWorkspaceFilesContent() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showInformationMessage('No workspace opened');
        return;
    }

    const filesContent = {};

    workspaceFolders.forEach(folder => {
        const folderPath = folder.uri.fsPath;
        const files = getFiles(folderPath);

        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            filesContent[filePath] = content;
        });
    });

    return filesContent;
}
// 读取文件
function getFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    items.forEach(item => {
        const res = path.join(dir, item.name);
        if (item.isDirectory()) {
            files = files.concat(getFiles(res));
        } else {
            files.push(res);
        }
    });

    return files;
}

module.exports = {
    getWorkspaceFilesContent
};