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
    let requestData;
    switch (MODEL_ENV) {
        case "CPU with llama.cpp":
            requestData = getRequestDataCPU(prompt);
            break;
        case "GPU with TGI toolkit":
            requestData = getRequestDataGPU(prompt);
            break;
        default:
            requestData = undefined;
            break;
    }
    if (requestData) {
        abortController = new AbortController();
        new FetchStream({
            url: 'http://10.0.5.118:9002/streamingInterface/promptEngineTemplate/testStream',
            // url: SERVER_ADDR_CHAT + requestData.uri,
            requestInit: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: requestData.body,
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
        // body: {
        //     "prompt": "|<end>|" + prompt,
        //     "n_predict": MAX_TOKENS_CHAT,
        //     "temperature": 0.8,
        //     "repetition_penalty": 1.2,
        //     "top_k": 40,
        //     "top_p": 0.95,
        //     "stream": true,
        //     "stop": STOP_WORDS
        // }
        body: {
            "temperature": 70,
            "tokens": 2048,
            "system": "",
            "modelName": "Qwen1.5-14B-Chat",
            "talk": [
                {
                    "role": "user",
                    "text": prompt
                }
            ],
            "ref": "Qwen1.5-14B-Chat",
            "query": prompt,
            "role": "user",
            "modelParams": {
                "temperature": 0.7,
                "max_tokens": 2048
            }
        }
    };
}

function getRequestDataGPU(prompt: string,): RequestData {
    return {
        uri: "/generate_stream",
        // uri = "/codeshell-code/assistants",
        body: {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": MAX_TOKENS_CHAT,
                "temperature": 0.6,
                "repetition_penalty": 1.2,
                "top_p": 0.95,
                "do_sample": true,
                "stop": STOP_WORDS
            }
        }
    };
}