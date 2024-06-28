/*
 * @Description: 
 * @Author: shiby
 * @Date: 2024-06-26 14:05:05
 * @LastEditTime: 2024-06-28 15:26:34
 * @LastEditors: shiby
 * @Reference: 
 */
// The module "vscode" contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { CodeCompletionProvider } from "./CodeCompletionProvider";
import { CodeWebviewViewProvider } from "./CodeWebviewViewProvider";
import { CODEDCITS_CONFIG } from "./consts";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	registerCompleteionExtension(context);
	registerWebviewViewExtension(context);
    registerSettingCommand(context);
}

// This method is called when your extension is deactivated
export function deactivate() { }


// 在扩展中注册 Webview 视图扩展
function registerWebviewViewExtension(context: vscode.ExtensionContext) {
 const provider = new CodeWebviewViewProvider(context);

 // 使用扩展的上下文注册提供程序
 context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(CodeWebviewViewProvider.viewId, provider, {
   webviewOptions: { retainContextWhenHidden: true }
  }),
  // 注册命令以执行相关的操作
  vscode.commands.registerCommand("codedcit.explain_this_code", () => provider.executeCommand("codedcit.explain_this_code")),
  vscode.commands.registerCommand("codedcit.improve_this_code", () => provider.executeCommand("codedcit.improve_this_code")),
  vscode.commands.registerCommand("codedcit.clean_this_code", () => provider.executeCommand("codedcit.clean_this_code")),
  vscode.commands.registerCommand("codedcit.generate_comment", () => provider.executeCommand("codedcit.generate_comment")),
  vscode.commands.registerCommand("codedcit.generate_unit_test", () => provider.executeCommand("codedcit.generate_unit_test")),
  // vscode.commands.registerCommand("codedcit.check_performance", () => provider.executeCommand("codedcit.check_performance")),
  // vscode.commands.registerCommand("codedcit.check_security", () => provider.executeCommand("codedcit.check_security")),
  vscode.commands.registerCommand("codedcit.open.history", () => provider.executeCommand("codedcit.open_history")),
  vscode.commands.registerCommand("codedcit.open.chat", () => provider.executeCommand("codedcit.open_newchat")),
  vscode.commands.registerCommand("codedcit.code_generation", () => provider.executeCommand("codedcit.code_generation")),
  vscode.commands.registerCommand("codedcit.insert.components", () => provider.executeCommand("codedcit.insert.components")),
  vscode.commands.registerCommand("codedcit.open.plugin", () => provider.executeCommand("codedcit.open.plugin")),
 );
}
// 注册自动提示扩展函数
function registerCompleteionExtension(context: vscode.ExtensionContext) {
 // 创建状态栏项
 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
 statusBar.text = "$(lightbulb)";  // 设置状态栏文本
 statusBar.tooltip = `CodeDcit - Ready`;  // 设置状态栏提示信息

 // 完成状态回调
 const completionStatusCallback = (enabled: boolean) => async () => {
  const configuration = vscode.workspace.getConfiguration();  // 获取工作区配置
  const target = vscode.ConfigurationTarget.Global;
  configuration.update("CodeDcit.AutoTriggerCompletion", enabled, target, false).then(console.error);  // 更新配置 
  var msg = enabled ? vscode.l10n.t("Enable automatically code completion (triggered when input stops)") : vscode.l10n.t("Disable auto code completion (can be triggered by shortcut keys)");  // 获取消息
  vscode.window.showInformationMessage(msg);  // 显示信息消息
  statusBar.show();  // 显示状态栏
 };

 // 订阅相关内容
 context.subscriptions.push(
  vscode.languages.registerInlineCompletionItemProvider(
   { pattern: "**" }, new CodeCompletionProvider(statusBar)  // 注册内联提示提供程序
  ),

  vscode.commands.registerCommand("codedcit.auto_completion_enable", completionStatusCallback(true)),  // 注册命令 - 启用自动完成
  vscode.commands.registerCommand("codedcit.auto_completion_disable", completionStatusCallback(false)),  // 注册命令 - 禁用自动完成
  statusBar  // 状态栏项目
 );

 // 如果已配置自动触发完成，执行相应命令
 if (CODEDCITS_CONFIG.get("AutoTriggerCompletion")) {
  vscode.commands.executeCommand("codedcit.auto_completion_enable");
 } else {
  vscode.commands.executeCommand("codedcit.auto_completion_disable");
 }
}

// 注册命令 打开插件设置
function registerSettingCommand(context: vscode.ExtensionContext) {
    // 创建一个命令
    const openSettingsCommand = vscode.commands.registerCommand('codedcit.open.settings', function() {
        // 插件的标识符
        const pluginId = '@ext:CodeDcit.codedcit-vscode';
        // 执行内置命令打开特定插件的设置
        vscode.commands.executeCommand('workbench.action.openSettings', { query: pluginId });
    });

    // 将命令的可处置对象添加到插件的上下文中
    context.subscriptions.push(openSettingsCommand);
}

