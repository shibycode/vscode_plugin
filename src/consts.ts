/*
 * @Description: 
 * @Author: shiby
 * @Date: 2024-06-26 14:05:05
 * @LastEditTime: 2024-06-28 11:07:36
 * @LastEditors: shiby
 * @Reference: 
 */
import { extensions, workspace } from "vscode";

export const EXTENSION_ID = "CodeDcit.codedcit-vscode";
export const EXTENSION_PATH = extensions.getExtension(EXTENSION_ID)?.extensionPath;


export const END_OF_TEXT = "<|endoftext|>";
export const STOP_WORDS = [END_OF_TEXT, "|<end>|", "|<end", "|end|", "## human"];


export const CODEDCITS_CONFIG = workspace.getConfiguration("CodeDcit");
export const MAX_TOKENS_CHAT =  CODEDCITS_CONFIG.get("ChatMaxTokens");
export const MAX_TOKENS_COMPLETION = CODEDCITS_CONFIG.get("CompletionMaxTokens");
export const MODEL_ENV = CODEDCITS_CONFIG.get("SwitchModel");
export const SERVER_ADDR_CHAT = CODEDCITS_CONFIG.get("ServerAddress");