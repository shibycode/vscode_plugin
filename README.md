# CodeDcit VSCode Extension

`codedcit-vscode`项目是基于大模型开发的支持[Visual Studio Code]的智能编码助手插件，支持python、java、c++/c、javascript、go等多种编程语言，为开发者提供代码补全、代码解释、代码优化、注释生成、对话问答等功能，旨在通过智能化的方式帮助开发者提高编程效率。

## 环境要求

- [node](https://nodejs.org/en)版本v18及以上
- Visual Studio Code版本要求 1.68.1 及以上

## 编译插件

如果要从源码进行打包，需要安装 `node` v18 以上版本，并执行以下命令：

```zsh
git clone https://github.com/shibycode/vscode_plugin
cd codedcit-vscode
npm install
npm exec vsce package
```

然后会得到一个名为`codedcit-vscode-${VERSION_NAME}.vsix`的文件。

## 配置插件

VSCode中执行`Install from VSIX...`命令，选择`codedcit-vscode-${VERSION_NAME}.vsix`，完成插件安装。

- 设置CodeDcit大模型服务地址
- 配置是否自动触发代码补全建议
- 配置自动触发代码补全建议的时间延迟
- 配置补全的最大tokens数量
- 配置问答的最大tokens数量
- 配置模型运行环境


![插件配置截图](https://raw.githubusercontent.com/WisdomShell/codeshell-vscode/main/assets/readme/docs_settings_new.png)

## 功能特性

### 1. 代码补全

- 自动触发代码建议
- 热键触发代码建议

在编码过程中，当停止输入时，代码补全建议可自动触发（在配置选项`Auto Completion Delay`中可设置为1~3秒），或者您也可以主动触发代码补全建议，使用快捷键`Alt+\`（对于`Windows`电脑）或`option+\`（对于`Mac`电脑）。

当插件提供代码建议时，建议内容以灰色显示在编辑器光标位置，您可以按下Tab键来接受该建议，或者继续输入以忽略该建议。

![代码建议截图](https://raw.githubusercontent.com/WisdomShell/codeshell-vscode/main/assets/readme/docs_completion.png)

### 2. 代码辅助

- 对一段代码进行解释/优化/清理
- 为一段代码生成注释/单元测试
- 检查一段代码是否存在性能/安全性问题

在vscode侧边栏中打开插件问答界面，在编辑器中选中一段代码，在鼠标右键CodeShell菜单中选择对应的功能项，插件将在问答界面中给出相应的答复。

![代码辅助截图](https://raw.githubusercontent.com/WisdomShell/codeshell-vscode/main/assets/readme/docs_assistants.png)

### 3. 智能问答

- 支持多轮对话
- 支持会话历史
- 基于历史会话（做为上文）进行多轮对话
- 可编辑问题，重新提问
- 对任一问题，可重新获取回答
- 在回答过程中，可以打断

![智能问答截图](https://raw.githubusercontent.com/WisdomShell/codeshell-vscode/main/assets/readme/docs_chat.png)

在问答界面的代码块中，可以点击复制按钮复制该代码块，也可点击插入按钮将该代码块内容插入到编辑器光标处。

## 开源协议

Apache 2.0

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=WisdomShell/codeshell-vscode&type=Date)](https://star-history.com/#WisdomShell/codeshell-vscode&Date)