import * as vscode from "vscode";

export async function getFiles() {
    // 激活插件时触发的函数
    
    // 获取工作区根目录URI
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder is open.');
        return;
    }
    
    const rootFolder = workspaceFolders[0].uri;
    
    // 忽略node_modules 和 .vscode的正则表达式
    // const ignorePattern = /(\/|^)(node_modules|\.vscode)(\/|\.public)(\/|$)/;
    const ignoreNodeModules = /node_modules/;

    // 忽略.ico文件
    const ignoreIcons = /\.ico$/;
    
    try {
        await readFilesRecursively(rootFolder, ignoreNodeModules, ignoreIcons);
    } catch (error) {
        console.error('Error reading files:', error);
    }
}

// 读取文件夹及其子文件夹中的所有文件
async function readFilesRecursively(uri: vscode.Uri, ignorePattern: RegExp, ignoreIcons: RegExp): Promise<void> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    
    for (const [name, type] of entries) {
        if (ignorePattern.test(name)) {
            continue; // 跳过node_modules目录
        }
        // if (ignoreIcons.test(type)) {
        //     continue; // 跳过node_modules目录
        // }
        
        const itemUri = uri.with({ path: uri.path + '/' + name });
        
        if (type === vscode.FileType.Directory) {
            // 如果是目录，则递归调用自身
            await readFilesRecursively(itemUri, ignorePattern, ignoreIcons);
        } else if (type === vscode.FileType.File) {
            // 处理文件，例如打印文件路径
            console.log(`Reading file: ${itemUri.fsPath}`);


            // 示例：显示文件内容
            const document = await vscode.workspace.openTextDocument(itemUri);
            console.log(`File content: ${document.getText()}`);
        }
    }
}