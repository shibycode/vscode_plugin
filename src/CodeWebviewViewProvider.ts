import * as vscode from "vscode";
import * as prompt from "./CreatePrompt";
import { ChatItem, HumanMessage, AIMessage, SessionItem, SessionStore } from "./ChatMemory";
import { postEventStream, stopEventStream } from "./request/event-source";
import { sleep } from "./Utils";
import { getFiles } from "./getWorkspaceFiles";

export class CodeWebviewViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = "codedcit.chatView";
	private _view?: vscode.WebviewView;
	private _extensionUri: vscode.Uri;

	private sessionStore: SessionStore;
	private sessionItem: SessionItem = new SessionItem();

	constructor(private readonly _extensionContext: vscode.ExtensionContext) {
		this._extensionUri = _extensionContext.extensionUri;
		this.sessionStore = new SessionStore(_extensionContext);
	}

	public resolveWebviewView(webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken) {

		this._view = webviewView;
		// set options for the webview, allow scripts
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		// set the HTML for the webview
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// add an event listener for messages received by the webview
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				// 插入代码
				case "codeBlockInsert": {
					let code = data.value;
					//code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");
					const snippet = new vscode.SnippetString();
					snippet.appendText(code);
					// insert the code as a snippet into the active text editor
					vscode.window.activeTextEditor?.insertSnippet(snippet);
					break;
				}
				// 新建文件
				case "addFileCode": {
					this.saveCodeToFile(data.value);
					break;
				}
				// 开始新的问题
				case "startQuestion": {
					this.startQuestion(data.value);
					break;
				}
				// 开始新的会话
				case "startNewSession": {
					this.sessionStore.update(this.sessionItem);
					this.sessionItem = new SessionItem();
					break;
				}
				// 显示session历史记录
				case "showSessionHistory": {
					this.showSessionHistory();
					break;
				}
				// 点击sessionItem
				case "sessionItemClicked": {
					this.sessionItemClicked(data.value);
					break;
				}
				// 删除sessionItem
				case "sessionItemDelete": {
					this.sessionItemDelete(data.value);
					break;
				}
				// 重新生成当前问题的答案
				case "regenerateThisAnswer": {
					this.generateAnswer(data.value);
					break;
				}
				// 停止生成流
				case "stopGenerationStream": {
					this.stopGenerationStream();
					break;
				}
			}
		});
	}

		// 快速修复
		public async quickFixCode(errorMessage: string, errorCode: string) {
			if (!this._view) {
				await vscode.commands.executeCommand("codedcit.chatView.focus");
				await sleep(1000);
			} else {
				this._view?.show?.(true);
			}
	
			const languageId = vscode.window.activeTextEditor?.document.languageId;
			if (!languageId) {
				vscode.window.showErrorMessage(vscode.l10n.t("Unknown Language type"));
				return;
			}
	
			// 在这里处理错误信息和代码
			let humanPrompt = prompt.quickFixCode(languageId, errorMessage, errorCode);
	
			this.startQuestion(humanPrompt);
		}
	
		// 打开插件相关命令
		public async toViewCommand(command: string) {
			if (command !== 'codedcit.open.plugin') {
				// 保存当前对话
				this.sessionStore.update(this.sessionItem);
				this.sessionItem = new SessionItem();
			}
	
			switch (command) {
				case 'codedcit.open_history':
					// 展示历史会话div
					this.showSessionHistory();
					// 展示历史对话
					this._view?.webview.postMessage({ type: "clickOpenHistory"});
					break;
				case 'codedcit.open_newchat':
					// 开启新会话
					this._view?.webview.postMessage({ type: "startNewChat", value: this._makestartChatDiv() });
					break;
				case 'codedcit.insert.components':
					// 展示组件列表
					this._view?.webview.postMessage({ type: "showComponentList"});
					break;
				case 'codedcit.open.plugin': 
					// 通过快捷键打开插件
					if (!this._view) {
						await vscode.commands.executeCommand("codedcit.chatView.focus");
						await sleep(1000);
					} else {
						this._view?.show?.(true);
					}
				break;
			}
		}

	// 对话相关命令执行入口
	public async executeCommand(command: string) {
		// Get the selected text of the active editor
		const selection = vscode.window.activeTextEditor?.selection;
		const selectedText = vscode.window.activeTextEditor?.document.getText(selection);
		if (!selectedText) {
			vscode.window.showErrorMessage(vscode.l10n.t("Please select a section of code"));
			return;
		}
		const languageId = vscode.window.activeTextEditor?.document.languageId;
		if (!languageId) {
			vscode.window.showErrorMessage(vscode.l10n.t("Unknown Language type"));
			return;
		}

		let humanPrompt = "";
		switch (command) {
			case "codedcit.explain_this_code": {
				humanPrompt = prompt.createPromptCodeExplain(languageId, selectedText);
				break;
			}
			case "codedcit.improve_this_code": {
				humanPrompt = prompt.createPromptCodeImprove(languageId, selectedText);
				break;
			}
			case "codedcit.clean_this_code": {
				humanPrompt = prompt.createPromptCodeClean(languageId, selectedText);
				break;
			}
			case "codedcit.generate_comment": {
				humanPrompt = prompt.createPromptGenerateComment(languageId, selectedText);
				break;
			}
			case "codedcit.generate_unit_test": {
				humanPrompt = prompt.createPromptGenerateUnitTest(languageId, selectedText);
				break;
			}
			case "codedcit.check_performance": {
				humanPrompt = prompt.createPromptCheckPerformance(languageId, selectedText);
				break;
			}
			case "codedcit.check_security": {
				humanPrompt = prompt.createPromptCheckSecurity(languageId, selectedText);
				break;
			}
			// 代码生成
			case "codedcit.code_generation": {
				humanPrompt = selectedText;
				// humanPrompt = prompt.createPromptCheckSecurity(languageId, selectedText);
				break;
			}
		}

		//   // 从活动栏中获取焦点以执行gpt活动
		if (!this._view) {
			await vscode.commands.executeCommand("codedcit.chatView.focus");
			await sleep(1000);
		} else {
			this._view?.show?.(true);
		}
		if (humanPrompt) {
			this.startQuestion(humanPrompt);
		}
	}
	private async saveCodeToFile(fileData: string) {
		// 文件保存路径 优先存到与当前编辑文件同级的目录下
		let currentUri;
		if (vscode.window.activeTextEditor) {
			currentUri = vscode.window.activeTextEditor.document.uri;
		} else {
			//备用的默认路径
			currentUri = vscode.Uri.file('/path/to/default/folder');
		}
		const options: vscode.SaveDialogOptions = {
			defaultUri: currentUri
		};

		vscode.window.showSaveDialog(options).then(async (uri: vscode.Uri | undefined) => {
			if (uri) {
				try {
					// 使用用户的文件路径和内容创建一个文件
					await vscode.workspace.fs.writeFile(uri, Buffer.from(fileData, 'utf-8'));

					// 显示消息告知用户文件已保存
					vscode.window.showInformationMessage(`文件已保存到：${uri.fsPath}`);

					// 打开保存的文件
					const document = await vscode.workspace.openTextDocument(uri);
					vscode.window.showTextDocument(document);
				} catch (error) {
					// 对错误进行分类处理（示例仅提供了一个基本的错误信息展示，实际应用中可以根据不同错误类型进行更细致的处理）
					if (error instanceof Error && error.message.includes('文件内容不能为空')) {
						vscode.window.showErrorMessage('文件内容验证失败：请确保文件内容有效。');
					} else {
						vscode.window.showErrorMessage(`操作文件时出错：${error}`);
					}
				}
			}
		});
	}

	private startQuestion(question: string) {
		const contentIndex = this.sessionItem.chatList.length;
		const divContent = this._makeQuestionAnswerDiv(contentIndex);
		const eventData = {
			"divContent": divContent,
			"contentIndex": contentIndex,
			"question": question
		};
		this._view?.webview.postMessage({ type: "addQuestionAnswerDiv", value: eventData });

		const humanMessage = new HumanMessage(question);
		const aiMessage = new AIMessage("");
		const chatItem = new ChatItem(humanMessage, aiMessage);
		this.sessionItem.addChatItem(chatItem);
		this.generateAnswer(contentIndex);
	}

	// 获取sessionItem的历史记录和当前问题的答案，并显示在webview中
	private generateAnswer(index: number) {
		const chatItem = this.sessionItem.chatList[index];
		chatItem.aiMessage.content = "";
		this.sessionStore.update(this.sessionItem);
		const historyPrompt = this.sessionItem.getSlicePrompt(0, index);
		const respData = {
			"contentIndex": index,
			"responseText": chatItem.aiMessage.content,
			"aiMsgId": chatItem.aiMsgId,
		};
		let prompt = `你是一个经验丰富的前端开发工程师，请按照要求完成任务：\n${historyPrompt}`;
		console.log("historyPrompt:", historyPrompt);
		// 调接口成功 后发送历史记录和当前问题的答案给webview
		postEventStream(prompt, (data) => {
			console.log("generateAnswer.streamData:", data);
			chatItem.aiMessage.append(data);
			chatItem.aiMsgId = index.toString();
			respData.responseText = chatItem.aiMessage.content;
			respData.aiMsgId = chatItem.aiMsgId;
			this._view?.webview.postMessage({ type: "addStreamResponse", value: respData });
			this.sessionStore.update(this.sessionItem);
		}, () => {
			// 流式输出完毕 或 ai回复为空
			console.log("generateAnswer.requstsDone:", chatItem.aiMessage.content);
			this.sessionStore.update(this.sessionItem);
			this._view?.webview.postMessage({ type: "responseStreamDone", value: respData });
		}, (_err) => {
			// 接口请求失败
			this.sessionStore.update(this.sessionItem);
			this._view?.webview.postMessage({ type: "responseStreamDone", value: respData });
		});
	}

	// 停止生成流
	private stopGenerationStream() {
		stopEventStream();
	}

	private sessionItemClicked(itemId: string) {
		const sessionItem = this.sessionStore.getSessionItemById(itemId);
		this.sessionItem = sessionItem;
		this._makeQuestionAnswerDivFromSessionItem(sessionItem);
	}

	private sessionItemDelete(itemId: string) {
		const sessionItem = this.sessionStore.getSessionItemById(itemId);
		this.sessionStore.delete(sessionItem);
		const historyChat = this.sessionStore.getSessionHistory();

		if(historyChat.length <= 0) {
			// 历史记录删完 跳转到对话页面
			this._view?.webview.postMessage({ type: "startNewChat", value: this._makestartChatDiv() });
		}
		this.showSessionHistory();
	}

	private showSessionHistory() {
		var html = this._makeHistoryDiv();
		this._view?.webview.postMessage({ type: "historySessionDone", value: html });
	}

	private _makeHistoryDiv() {
		let history = this.sessionStore.getSessionHistory();

		let html = "";
		for (const item of history) {
			html += this._makeHistoryItemDiv(item);
		}
		return html;
	}

	private _makeHistoryItemDiv(sessionItem: SessionItem) {
		const sessionTime = sessionItem.time.toLocaleString();

		return `
			<div class="session" id="${sessionItem.id}">
				<div class="session-item">
					<p class="session-title"> ${sessionItem.title} </p>
					<p class="session-date-time"> ${sessionTime} </p>
				</div>
				<div class="session-options inner-btns ant-dropdown-trigger">
					<svg t="1718328756099" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7972" width="16" height="16">
						<path fill="currentColor" d="M974.991554 109.146486 647.781177 109.146486c0-2.225921 2.225921-4.451842 2.225921-6.677763 0-55.648023-46.74434-102.392363-102.392363-102.392363l-66.777628 0C422.963163-2.14956 378.444744 44.594779 378.444744 100.242803c0 2.225921 0 4.451842 2.225921 6.677763L49.008446 106.920565c-22.259209 0-40.066577 17.807367-40.066577 40.066577s17.807367 40.066577 40.066577 40.066577l77.907233 0 0 636.613387c0 111.296047 91.262758 200.332884 200.332884 200.332884l389.536163 0c111.296047 0 200.332884-91.262758 200.332884-200.332884L917.11761 189.27964l60.099865 0c22.259209 0 40.066577-17.807367 40.066577-40.066577S997.250763 109.146486 974.991554 109.146486zM458.577898 100.242803c0-11.129605 11.129605-22.259209 22.259209-22.259209l66.777628 0c11.129605 0 22.259209 11.129605 22.259209 22.259209 0 2.225921 0 4.451842 2.225921 6.677763l-113.521968 0C456.351977 106.920565 458.577898 102.468724 458.577898 100.242803zM836.984456 825.893026c0 66.777628-53.422102 120.19973-120.19973 120.19973L327.248563 946.092757c-66.777628 0-120.19973-53.422102-120.19973-120.19973L207.048832 189.27964l629.935624 0L836.984456 825.893026zM411.833558 756.889478c22.259209 0 40.066577-17.807367 40.066577-40.066577l0-311.62893c0-22.259209-17.807367-40.066577-40.066577-40.066577s-40.066577 17.807367-40.066577 40.066577l0 311.62893C371.766981 739.08211 389.574349 756.889478 411.833558 756.889478zM632.19973 756.889478c22.259209 0 40.066577-17.807367 40.066577-40.066577l0-311.62893c0-22.259209-17.807367-40.066577-40.066577-40.066577-22.259209 0-40.066577 17.807367-40.066577 40.066577l0 311.62893C592.133154 739.08211 609.940521 756.889478 632.19973 756.889478z" p-id="7973"></path>
					</svg>
				</div>
			</div>
		`;
	}

	// 查看历史对话
	private _makeQuestionAnswerDivFromSessionItem(sessionItem: SessionItem) {
		let html = "";
		for (let i = 0; i < sessionItem.chatList.length; i++) {
			html += this._makeQuestionAnswerDiv(i);
		}
		const eventData = {
			"divContent": html,
			"chatList": sessionItem.chatList
		};
		this._view?.webview.postMessage({ type: "historyQuestionAnswerDone", value: eventData });
	}

	// 问答对话框
	private _makeQuestionAnswerDiv(contentIndex: number) {
		return `
		<div id="qa_section_div_${contentIndex}"
			class="qa-section-div-main focus-on-tab" style="border-bottom: 0.5px solid #626668; padding: 5px 5px">
			<div class="question-container col-12">
				<div class="row mr-0">
					<div class="col-4 pr-0"><div class="question-title">${vscode.l10n.t("Question :")}</div></div>
					<div class="col-8 p-0" style="align-items: center; display: flex; justify-content: flex-end;">
						<div class="edit-btn focus-on-tab inner-btns" style="float: right;" title="Edit" id="editBtn${contentIndex}">
							<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
								<path d="M816.277333 165.056a128 128 0 0 1 0 181.013333L309.653333 852.693333a21.333333 21.333333 0 0 1-15.082666 6.229334H165.056a42.666667 42.666667 0 0 1-42.666667-42.666667v-129.493333a21.333333 21.333333 0 0 1 6.229334-15.104L635.306667 165.056a128 128 0 0 1 180.992 0z m-45.226666 45.226667a64 64 0 0 0-87.786667-2.56l-2.752 2.56L188.885333 701.930667a8.533333 8.533333 0 0 0-2.496 6.037333v78.464c0 4.714667 3.818667 8.533333 8.533334 8.533333h78.421333a8.533333 8.533333 0 0 0 6.037333-2.517333l491.648-491.605333a64 64 0 0 0 2.581334-87.786667l-2.56-2.730667z" fill="currentColor" p-id="6891"></path>
								<path fill="currentColor" d="M590.016 210.304l181.013333 181.013333-45.248 45.248-181.013333-181.013333z" p-id="6892"></path>
								<path fill="currentColor" d="M490.666667 795.733333m8.533333 0l345.6 0q8.533333 0 8.533333 8.533334l0 46.933333q0 8.533333-8.533333 8.533333l-345.6 0q-8.533333 0-8.533333-8.533333l0-46.933333q0-8.533333 8.533333-8.533334Z"  p-id="6893"></path>
								<path d="M661.333333 667.733333m8.533334 0l174.933333 0q8.533333 0 8.533333 8.533334l0 46.933333q0 8.533333-8.533333 8.533333l-174.933333 0q-8.533333 0-8.533334-8.533333l0-46.933333q0-8.533333 8.533334-8.533334Z" fill="currentColor" p-id="6894"></path>
							</svg>
						</div>
					</div>
				</div>
				<div id="questionDiv${contentIndex}" class="questionDiv d-block row col-12 m-0"></div>
			</div>
			<div class="row mr-0">
				<div class="col-4 pr-0">
					<div class="answer-title">${vscode.l10n.t("Answer :")}</div>
				</div>
			</div>
			<div class="answer-container">
				<div class="answerDiv" id="outputDiv${contentIndex}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="18" cy="12" r="0" fill="currentColor"><animate attributeName="r" begin=".67" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="12" r="0" fill="currentColor"><animate attributeName="r" begin=".33" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="6" cy="12" r="0" fill="currentColor"><animate attributeName="r" begin="0" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle></svg></div>
			</div>
			<div class="row mr-0">
				<div class="col-12 p-0" style="align-items: center; display: none; justify-content: flex-end;" id="feedbackDiv${contentIndex}">
					<div class="answer-title">${vscode.l10n.t("How about this answer?")}</div>
					<div class="copy-btn copybtn-icn focus-on-tab inner-btns" style="float: right;" id="feedbackGoodBtn${contentIndex}">
						<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
							<path d="M925.696 585.788235c4.999529 12.227765 7.951059 28.069647 7.951059 48.609883 0 31.683765-14.456471 58.488471-37.406118 74.270117 8.312471 14.095059 12.288 30.177882 12.288 46.260706 0 33.852235-18.853647 62.704941-47.284706 77.583059 4.818824 11.324235 7.649882 25.298824 7.770353 42.465882 0.120471 27.045647-7.770353 48.790588-23.552 64.632471-16.624941 16.685176-40.176941 25.178353-69.933176 25.178353H436.705882c-45.417412 0-76.679529-24.335059-99.568941-42.164706-13.191529-10.24-25.660235-19.998118-34.334117-19.998118H176.188235a30.117647 30.117647 0 0 1 0-60.235294h126.614589c29.334588 0 51.621647 17.347765 71.318588 32.64753 19.456 15.119059 37.827765 29.455059 62.58447 29.455058h338.82353c12.769882 0 22.467765-2.590118 27.226353-7.408941 4.096-4.096 6.144-11.444706 6.083764-21.805176-0.180706-26.322824-5.541647-31.984941-61.861647-31.984941h-6.384941a30.117647 30.117647 0 0 1 0-60.235294h75.776c18.492235 0 31.924706-11.866353 31.924706-28.190118 0-27.105882-27.045647-31.141647-43.188706-31.141647h-45.17647a30.117647 30.117647 0 0 1 0-60.235294h86.558117c19.937882 0 26.985412-15.058824 26.985412-29.153883 0-29.635765 0-29.635765-26.443294-30.418823-3.072-0.060235-6.264471-0.301176-9.396706-0.421647H772.818824a30.117647 30.117647 0 0 1 0-60.235294h59.151058c0.421647 0 0.783059-0.240941 1.204706-0.240942h38.008471c17.769412 0 32.286118-13.673412 32.286117-30.418823s-14.456471-30.418824-32.286117-30.418824H602.955294a30.057412 30.057412 0 0 1-29.575529-35.719529l31.322353-164.683294c3.734588-16.444235 14.336-63.066353 1.987764-83.727059a24.696471 24.696471 0 0 0-20.48-11.083294c-11.806118 0-23.913412 9.456941-34.093176 26.503529L356.894118 528.745412a30.117647 30.117647 0 0 1-25.6 14.275764H176.549647a30.117647 30.117647 0 0 1 0-60.235294h137.999059l186.006588-300.574117c28.672-48.188235 65.957647-55.476706 85.534118-55.476706h0.060235c29.214118 0 57.524706 15.902118 72.161882 40.417882 21.925647 36.683294 14.336 87.04 5.240471 126.85553l-24.274824 127.939764h231.845648c51.019294 0 92.521412 40.658824 92.521411 90.654118 0.060235 29.997176-14.938353 56.681412-37.948235 73.185882z" p-id="4585" fill="currentColor"></path>
						</svg>
					</div>
					<div class="copy-btn copybtn-icn-tick" style="float: right; display: none" id="feedbackCheckBtn${contentIndex}">
						<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
							<path d="M369.792 704.32L930.304 128 1024 223.616 369.984 896l-20.288-20.864-0.128 0.128L0 516.8 96.128 423.68l273.664 280.64z"fill="#1296db" p-id="4526"></path>
						</svg>
					</div>
					<div class="copy-btn copybtn-icn focus-on-tab inner-btns" style="float: right;" id="feedbackBadBtn${contentIndex}">
						<svg t="1695020265894" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5724" width="20" height="20">
							<path d="M877.507765 572.295529a30.117647 30.117647 0 0 1-30.117647 30.117647h-137.999059l-186.006588 300.574118c-28.732235 48.188235-65.957647 55.476706-85.534118 55.476706h-0.060235a85.534118 85.534118 0 0 1-72.222118-40.417882c-21.925647-36.743529-14.336-87.100235-5.240471-126.85553l24.274824-127.939764H152.756706c-51.019294 0-92.461176-40.658824-92.461177-90.654118 0-33.008941 18.070588-61.982118 45.056-77.824a73.788235 73.788235 0 0 1-15.058823-43.91153c0-31.683765 14.456471-58.488471 37.406118-74.270117a91.376941 91.376941 0 0 1-12.288-46.320941c0-34.635294 19.757176-63.969882 49.212235-78.607059a91.136 91.136 0 0 1-9.758118-41.562353C154.864941 153.961412 189.861647 120.470588 248.410353 120.470588h338.823529c45.417412 0 76.739765 24.335059 99.568942 42.164706 13.191529 10.24 25.660235 19.998118 34.273882 19.998118h126.674823a30.117647 30.117647 0 0 1 0 60.235294h-126.674823c-29.334588 0-51.621647-17.347765-71.318588-32.64753-19.395765-15.239529-37.767529-29.515294-62.524236-29.515294H248.410353c-28.129882 0-33.310118 9.938824-33.310118 29.394824 0 9.517176 0 31.744 61.861647 31.744h6.324706a30.117647 30.117647 0 0 1 0 60.235294H207.510588c-18.492235 0-31.864471 11.866353-31.86447 28.190118 0 27.105882 27.045647 31.141647 43.188706 31.141647h45.17647a30.117647 30.117647 0 0 1 0 60.235294H177.513412c-19.877647 0-26.985412 15.058824-26.985412 29.153882 0 10.119529 22.046118 27.527529 42.465882 30.900706h58.187294a30.117647 30.117647 0 0 1 0 60.235294h-59.211294c-0.421647 0-0.783059 0.240941-1.204706 0.240941h-38.00847c-17.769412 0-32.225882 13.673412-32.225882 30.418824s14.456471 30.418824 32.225882 30.418823h268.227765a30.057412 30.057412 0 0 1 29.575529 35.71953l-31.322353 164.683294c-3.734588 16.444235-14.336 63.006118-1.987765 83.727059a24.816941 24.816941 0 0 0 20.48 11.083294c11.806118 0 23.913412-9.456941 34.093177-26.50353l195.102117-315.271529a30.117647 30.117647 0 0 1 25.6-14.275765h154.744471a30.117647 30.117647 0 0 1 30.238118 30.117647z" p-id="5725" fill="currentColor"></path>
						</svg>
					</div>
				</div>
			</div>
		</div>
		`;
	}

	// 开始对话 欢迎页面html
	private _makestartChatDiv() {
		return `
			<div id="start-chat" style="display: block">
				<center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center>
				<h3 style="color: lightblue;font-size: larger">嗨，我是你的智能编码助手。请问有什么可以帮助您？</h3>
				</center><center><p>&nbsp;</p></center>
				<p>&nbsp;&nbsp;•&nbsp;快捷键Ctrl + D 可以随时召唤我。</p>
				<p>&nbsp;&nbsp;•&nbsp;选中代码后右击触发快捷命令。</p>
				<p>&nbsp;&nbsp;•&nbsp;点击上方图标，体验实用小功能。</p>
				<p>&nbsp;&nbsp;•&nbsp;例如点击上方【聊天图标➕】，即可开始与AI代码助手聊天。</p>
				</center><center><p>&nbsp;</p></center>
				<p>&nbsp;&nbsp;•&nbsp;打开您正在编写的代码文件，输入任意代码即可使用自动补全功能。</p>
				<p>&nbsp;&nbsp;•&nbsp;按下 tab 接受所有补全建议。</p>
				<div><p>&nbsp;&nbsp;•&nbsp;按下 Ctrl+➡️ 接受一个单词的补全建议。</p></div>
				<center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center>
			</div>
		`;
	}

	private _makeComponentDiv() {
		let components = [
			{
				name: "Dummy",
				description: "Dummy component",
				id: '0'
			},
			{
				name: "BckPage",
				description: "返回组件,返回至上个页面",
				id: '1'
			},
			{
				name: "CountDown",
				description: "倒计时组件",
				id: '2'
			},
			{
				name: "TablePage",
				description: "前端分页表格组件",
				id: '3'
			},
		];

		let html = "";
		components.forEach(item => {
			html += this._makeComponentItemDiv(item);
		});
		return html;
	}

	private _makeComponentItemDiv(componentItem: any) {

		return `
			<div class="session" id="${componentItem.id}">
				<div class="session-item">
					<p class="session-title"> ${componentItem.name} </p>
					<p class="session-date-time"> ${componentItem.description} </p>
				</div>
				<div id="insertComponent" class="session-options inner-btns ant-dropdown-trigger">
					<svg t="1719469749633" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14227" width="16" height="16">
						<path d="M992 528c0 54.4-137.6 134.4-412.8 240v-137.6H80c-25.6 0-48-22.4-48-48v-108.8c0-25.6 22.4-48 48-48h499.2V288c275.2 105.6 412.8 185.6 412.8 240z" fill="currentColor" p-id="14228"></path>
					</svg>
				</div>
			</div>
		`;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		const mainScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.js"));
		const hightlightUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "scripts", "highlight.min.js"));
		const showdownUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "scripts", "showdown.min.js"));
		const tailwindUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "scripts", "tailwind.min.js"));

		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "styles"));

		const historySessionItems = this._makeHistoryDiv();
		const componentSessionItems = this._makeComponentDiv();


		return `<!DOCTYPE html>
		<html lang="en">
		
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<script src="${tailwindUri}"></script>
			<script src="${showdownUri}"></script>
			<script src="${hightlightUri}"></script>
		
			<link href="${styleUri}/styles.771a66d94c0526be.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c48.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c100.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c101.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c110.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c111.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c116.css" rel="stylesheet" type="text/css" />
			<link href="${styleUri}/styles.c117.css" rel="stylesheet" type="text/css" />
		
		
			<style type="text/css">
				.hljs-ln {
					border-collapse: collapse
				}
		
				.hljs-ln td {
					padding: 0
				}
		
				.hljs-ln-n:before {
					content: attr(data-line-number)
				}

        #fileInput {
          display: none;
        }
        .custom-file-upload {
          color: #fff;
          display: inline-block;
          padding: 5px;
          cursor: pointer;
          color: #fff;
          font-size: 16px;
          background: #007acc;
          border-radius: 4px;
          margin-top: 3px;
          margin-right: 10px;
        }
			</style>
		
		</head>
		
		<body>
		
			<app-root _nghost-uim-c118 ng-version="13.1.3">
				<div role="main" style="overflow: hidden !important;"
					class="main-app-content-section-tzs content d-block">
					<router-outlet></router-outlet>
					<app-ai-chat-container>
						<router-outlet _ngcontent-uim-c112></router-outlet>
						<app-aichat>
							<div appkeyboardshortcuteventdirective>
								<div class="ai-parent-div">
									<div id="aichat_history_div" style="display: none">
										<div class="history-btn-section row">
											<div class="col-6 d-flex justify-content-start">
												<div tabindex="0" id="historyBackButton" class="history-btn focus-on-tab">
													<svg t="1718328542731" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6417" width="20" height="20">
														<path d="M395.21518 513.604544l323.135538-312.373427c19.052938-18.416442 19.052938-48.273447 0-66.660212-19.053961-18.416442-49.910737-18.416442-68.964698 0L291.75176 480.290811c-19.052938 18.416442-19.052938 48.273447 0 66.660212l357.633237 345.688183c9.525957 9.207709 22.01234 13.796214 34.497699 13.796214 12.485359 0 24.971741-4.588505 34.466999-13.82896 19.052938-18.416442 19.052938-48.242747 0-66.660212L395.21518 513.604544z" fill="#7a8084" p-id="6418"></path>
													</svg>
													<span class="ml-2 history-buttons">${vscode.l10n.t("Back")}</span>
												</div>
											</div>
										</div>
										<div class="history-panel">
											<div tabindex="0" infinite-scroll="" class="historyListConainer focus-on-tab" id="history_session_div">
												${historySessionItems}
											</div>
										</div>
									</div>
									<div id="aichat_component_div" style="display: none">
										<div class="history-btn-section row">
											<div class="col-6 d-flex justify-content-start">
												<div tabindex="0" id="componentBackButton" class="history-btn focus-on-tab">
													<svg t="1718328542731" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6417" width="20" height="20">
														<path d="M395.21518 513.604544l323.135538-312.373427c19.052938-18.416442 19.052938-48.273447 0-66.660212-19.053961-18.416442-49.910737-18.416442-68.964698 0L291.75176 480.290811c-19.052938 18.416442-19.052938 48.273447 0 66.660212l357.633237 345.688183c9.525957 9.207709 22.01234 13.796214 34.497699 13.796214 12.485359 0 24.971741-4.588505 34.466999-13.82896 19.052938-18.416442 19.052938-48.242747 0-66.660212L395.21518 513.604544z" fill="#7a8084" p-id="6418"></path>
													</svg>
													<span class="ml-2 history-buttons">${vscode.l10n.t("Back")}</span>
												</div>
											</div>
										</div>
										<div class="history-panel">
											<div tabindex="0" infinite-scroll="" class="historyListConainer focus-on-tab" id="history_session_div">
												${componentSessionItems}
											</div>
										</div>
									</div>
									<div id="main-div-aichat" class="main-ai-chat-div">
										<div id="chatContainerQuestionListId" tabindex="0"
											class="no-shift-needed-tzs chat-container tzs-list-questions questions-asked-2"
											infinite-scroll style="height: calc(98vh - 190px) !important">
											<div id="start-chat" style="display: block">
												<center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center>
												<h3 style="color: var( --vscode-chat-slashCommandForeground);font-size: larger">嗨，我是你的智能编码助手。请问有什么可以帮助您？</h3>
												</center><center><p>&nbsp;</p></center>
												<p>&nbsp;&nbsp;•&nbsp;快捷键Ctrl + D 可以随时召唤我。</p>
												<p>&nbsp;&nbsp;•&nbsp;选中代码后右击触发快捷命令。</p>
												<p>&nbsp;&nbsp;•&nbsp;点击上方图标，体验实用小功能。</p>
												<p>&nbsp;&nbsp;•&nbsp;例如点击上方【聊天图标➕】，即可开始与AI代码助手聊天。</p>
												</center><center><p>&nbsp;</p></center>
												<p>&nbsp;&nbsp;•&nbsp;打开您正在编写的代码文件，输入任意代码即可使用自动补全功能。</p>
												<p>&nbsp;&nbsp;•&nbsp;按下 tab 接受所有补全建议。</p>
												<div><p>&nbsp;&nbsp;•&nbsp;按下 Ctrl+➡️ 接受一个单词的补全建议。</p></div>
												<center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center><p>&nbsp;</p></center><center>
											</div>
										</div>
										<div class="footerContent">
											<div class="generating-and-stop" id="generte-stop" style="display: none">
												<div class="generating-and-stop-inner">
													<span class="ai-button generating-and-stop-right" id="btn-stop-streaming" style="display: none">
														<span role="img" class="anticon" style="margin-right: 4px;">
														<svg t="1718674478273" fill="currentColor" class="icon" viewBox="0 0 1030 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="19862" width="16" height="16">
															<path d="M512 0C229.26 0 0 229.239 0 512c0 282.783 229.239 512 512 512 282.783 0 512-229.217 512-512 0.021-282.761-229.196-512-512-512z m0 958.843C265.213 958.843 65.178 758.787 65.178 512S265.235 65.178 512 65.178c246.83 0 446.843 200.035 446.843 446.822C958.864 758.787 758.83 958.843 512 958.843z" p-id="19863"></path>
															<path d="M365.102 328.528h85.705v385.67h-85.705v-385.67zM536.512 328.528h107.13v385.67h-107.13v-385.67z" p-id="19864"></path>
														</svg>
														</span>
														${vscode.l10n.t("Stop Gen")}
													</span>
													<span class="ai-button generating-and-stop-right" id="refreshBtn">
														<span role="img" class="anticon" style="margin-right: 4px;" id="refresh_svg_content">
														<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
															<path fill="currentColor" d="M866.133333 85.333333c4.693333 0 8.533333 3.84 8.533334 8.533334v194.133333a32 32 0 0 1-28.928 31.850667L842.666667 320h-194.133334a8.533333 8.533333 0 0 1-8.533333-8.533333v-46.933334c0-4.693333 3.84-8.533333 8.533333-8.533333h120.341334A361.536 361.536 0 0 0 512 149.333333C311.701333 149.333333 149.333333 311.701333 149.333333 512s162.368 362.666667 362.666667 362.666667c185.813333 0 339.008-139.776 360.170667-319.914667 0.384-3.328 0.810667-7.829333 1.28-13.546667a8.533333 8.533333 0 0 1 8.512-7.850666h47.061333a8.533333 8.533333 0 0 1 8.533333 9.109333c-0.426667 5.696-0.789333 10.218667-1.130666 13.589333C914.346667 770.986667 732.778667 938.666667 512 938.666667 276.352 938.666667 85.333333 747.648 85.333333 512S276.352 85.333333 512 85.333333c116.288 0 221.717333 46.506667 298.666667 121.984V93.866667c0-4.693333 3.84-8.533333 8.533333-8.533334h46.933333z" p-id="2282"></path>
														</svg>
														</span>
														${vscode.l10n.t("Retry")}
													</span>
												</div>
											</div>
											<div class="tzs-common-textarea-section">
												<div class="fake-input textarea-container pb-2">
													<textarea nz-input aria-label="ai-input-box"
														required apptextareaautoresize id="questioninput" autofocus
														class="form-control chat-input ant-input ng-touched ng-dirty ng-invalid"
														placeholder='${vscode.l10n.t("Ask here, press Enter key to send")}'></textarea>
													<div id="reply-buttons2" class="reply-buttons2"
														style="overflow: hidden;">
														<div class="row">
															<div class="col-3 text-left d-flex"></div>
															<div class="col-9 text-right">
																<!-- <span class="shift-enter-text"><span style="font-weight: 600;">Shift + Enter</span>${vscode.l10n.t("Line break")}</span> -->
																<a class="send send-disabled">
																	<svg class="send-icon" id="send-button-img" style="margin: 2px 0; cursor:pointer" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
																		<path d="M1008.00076 6.285714q18.857143 13.714286 15.428571 36.571429l-146.285714 877.714286q-2.857143 16.571429-18.285714 25.714286-8 4.571429-17.714286 4.571429-6.285714 0-13.714286-2.857143l-258.857143-105.714286-138.285714 168.571429q-10.285714 13.142857-28 13.142857-7.428571 0-12.571429-2.285714-10.857143-4-17.428571-13.428571t-6.571429-20.857143l0-199.428571 493.714286-605.142857-610.857143 528.571429-225.714286-92.571429q-21.142857-8-22.857143-31.428571-1.142857-22.857143 18.285714-33.714286l950.857143-548.571429q8.571429-5.142857 18.285714-5.142857 11.428571 0 20.571429 6.285714z" p-id="7866" fill="#ffffff"></path>
																	</svg>
																</a>
                                <label class="custom-file-upload" style="display:inline-block;">
                                  <svg t="1719819091936" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6610" width="16" height="16">
                                    <path d="M909.01333333 936.10666667H101.12c-41.17333333 0-74.66666667-33.49333333-74.66666667-74.66666667V184.10666667c0-41.17333333 33.49333333-74.66666667 74.66666667-74.66666667h350.50666667c41.17333333 0 74.66666667 33.49333333 74.66666666 74.66666667 0 11.73333333-9.6 21.33333333-21.33333333 21.33333333s-21.33333333-9.6-21.33333333-21.33333333c0-17.70666667-14.29333333-32-32-32H101.12c-17.70666667 0-32 14.29333333-32 32v677.33333333c0 17.70666667 14.29333333 32 32 32h807.89333333c11.73333333 0 21.33333333 9.6 21.33333334 21.33333333s-9.38666667 21.33333333-21.33333334 21.33333334z" fill="#ffffff" p-id="6611"></path><path d="M909.01333333 936.10666667c-11.73333333 0-21.33333333-9.6-21.33333333-21.33333334s9.6-21.33333333 21.33333333-21.33333333c17.70666667 0 32-14.29333333 32-32V422.61333333c0-17.70666667-14.29333333-32-32-32H277.97333333c-17.70666667 0-32 14.29333333-32 32v286.50666667c0 11.73333333-9.6 21.33333333-21.33333333 21.33333333s-21.33333333-9.6-21.33333333-21.33333333V422.61333333c0-41.17333333 33.49333333-74.66666667 74.66666666-74.66666666h631.04c41.17333333 0 74.66666667 33.49333333 74.66666667 74.66666666v438.82666667c0 41.17333333-33.49333333 74.66666667-74.66666667 74.66666667zM748.8 280.53333333h-190.08c-41.17333333 0-74.66666667-33.49333333-74.66666667-74.66666666v-11.09333334c0-11.73333333 9.6-21.33333333 21.33333334-21.33333333s21.33333333 9.6 21.33333333 21.33333333v11.09333334c0 17.70666667 14.29333333 32 32 32H748.8c11.73333333 0 21.33333333 9.6 21.33333333 21.33333333s-9.6 21.33333333-21.33333333 21.33333333z" fill="#ffffff" p-id="6612"></path><path d="M171.52000001 936.10666667l-16.85333334 0c-11.73333333 0-21.33333332-9.6-21.33333335-21.33333334s9.6-21.33333332 21.33333335-21.33333333l16.85333333 0c17.70666667 0 32-14.29333333 32-32l0-179.84c0-11.73333333 9.6-21.33333332 21.33333333-21.33333333s21.33333332 9.6 21.33333334 21.33333333l0 179.84c-0.21333333 41.17333333-33.49333333 74.66666667-74.66666666 74.66666667zM838.4 390.82666667c-11.73333333 0-21.33333332-9.6-21.33333333-21.33333334l-1e-8-56.74666666c0-17.70666667-14.29333333-32-32-32l-96.42666666-1e-8c-11.73333333 0-21.33333332-9.6-21.33333332-21.33333333s9.6-21.33333332 21.33333332-21.33333332L785.06666667 238.08000001c41.17333332 0 74.66666667 33.49333333 74.66666666 74.66666666l0 56.74666666c0 11.73333333-9.6 21.33333332-21.33333333 21.33333334z" fill="#ffffff" p-id="6613"></path><path d="M615.19265186 818.56284445c-13.34992592 0-24.27259259-10.92266667-24.2725926-24.2725926V536.75804445c0-13.34992592 10.92266667-24.27259259 24.2725926-24.2725926s24.27259259 10.92266667 24.27259258 24.2725926v257.5322074c0 13.34992592-10.92266667 24.27259259-24.27259258 24.2725926z" fill="#ffffff" p-id="6614"></path><path d="M719.07934815 664.91733333c-6.31087408 0-12.37902222-2.42725925-17.23354074-7.03905185L597.95911111 553.99158518c-9.46631111-9.46631111-9.46631111-24.75804445 0-34.22435555 9.46631111-9.46631111 24.75804445-9.46631111 34.22435555 0L736.31288889 623.65392592c9.46631111 9.46631111 9.46631111 24.75804445 0 34.22435556-4.85451852 4.85451852-10.92266667 7.03905185-17.23354074 7.03905185z" fill="#ffffff" p-id="6615"></path><path d="M511.06322963 664.91733333c-6.31087408 0-12.37902222-2.42725925-17.23354074-7.03905185-9.46631111-9.46631111-9.46631111-24.75804445 0-34.22435556l104.12942222-104.12942222c9.46631111-9.46631111 24.75804445-9.46631111 34.22435555 0 9.46631111 9.46631111 9.46631111 24.75804445 0 34.22435555l-104.12942222 104.12942223c-4.61179259 4.85451852-10.67994075 7.03905185-16.99081481 7.03905185z" fill="#ffffff" p-id="6616"></path>
                                  </svg>
                                  <input type=file id="fileInput" />
                                </label>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</app-aichat>
					</app-ai-chat-container>
				</div>
			</app-root>
		
		
			<script src="${mainScriptUri}"></script>
		
		
		</body>
		
		</html>`;
	}
}