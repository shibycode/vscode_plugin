/* eslint-disable @typescript-eslint/naming-convention */
import { END_OF_TEXT, MAX_TOKENS_COMPLETION, MODEL_ENV, STOP_WORDS } from "../consts";
import { RequestData, axiosInstance } from "./commons";

function getRequestDataCPU(fimPrefixCode: string, fimSuffixCode: string): RequestData {
    const prompt = `fimPrefixCode=${fimPrefixCode},fimSuffixCode=${fimSuffixCode}.已知前缀代码fimPrefixCode和后缀代码fimSuffixCode,请补全并返回中间部分`;
    return {
        uri: "http://10.0.5.118:9002/streamingInterface/promptEngineTemplate/testStream",
        body: {
            "temperature": 70,
            "tokens": MAX_TOKENS_COMPLETION,
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
                "max_tokens": MAX_TOKENS_COMPLETION
            }
        }
    };
}
export async function postCompletion(fimPrefixCode: string, fimSuffixCode: string): Promise<string | undefined> {
    const requestData = getRequestDataCPU(fimPrefixCode, fimSuffixCode);
    const response = await axiosInstance.post(requestData.uri, requestData.body);
    const content = response.data;
    console.debug("response.data:", content);
    return content.replace(END_OF_TEXT, "");
}