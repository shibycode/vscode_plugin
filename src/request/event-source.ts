/*
 * @Description: 
 * @Author: shiby
 * @Date: 2024-06-26 14:05:05
 * @LastEditTime: 2024-06-28 11:04:38
 * @LastEditors: shiby
 * @Reference: 
 */
/* eslint-disable @typescript-eslint/naming-convention */
import { MAX_TOKENS_CHAT, MODEL_ENV, SERVER_ADDR_CHAT, STOP_WORDS } from "../consts";
import { RequestData } from "./commons";
import { FetchStream } from "./fetch-stream";

let abortController = new AbortController();

export async function stopEventStream() {
    abortController.abort();
}

export async function postEventStream(
    prompt: string,
    msgCallback: (data: string) => any,
    doneCallback: () => void,
    errorCallback: (err: any) => void
) {
    let requestData = getRequestDataCPU(prompt) || undefined;
    if (requestData) {
        abortController = new AbortController();
        new FetchStream({
            // url: 'http://10.0.5.118:9002/streamingInterface/promptEngineTemplate/testStream',
            url: SERVER_ADDR_CHAT + requestData.uri,
            requestInit: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestData.body),
                // body: requestData.body,
                signal: abortController.signal
            },
            onmessage: msgCallback,
            ondone: doneCallback,
            onerror: errorCallback
        });
    }
}

function getRequestDataCPU(prompt: string,): RequestData {
    return {
        uri: "/streamingInterface/promptEngineTemplate/testStream",
        body: {
            "temperature": 70,
            "tokens": MAX_TOKENS_CHAT,
            "system": "",
            "modelName": MODEL_ENV,
            "talk": [
                {
                    "role": "user",
                    "text": prompt
                }
            ],
            "ref": MODEL_ENV,
            "query": prompt,
            "role": "user",
            "modelParams": {
                "temperature": 0.7,
                "max_tokens": MAX_TOKENS_CHAT
            }
        }
    };
}