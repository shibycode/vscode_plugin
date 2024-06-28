/*
 * @Description: 
 * @Author: shiby
 * @Date: 2024-06-26 14:05:05
 * @LastEditTime: 2024-06-28 10:36:15
 * @LastEditors: shiby
 * @Reference: 
 */
import fetch, { RequestInit, Response } from "node-fetch";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import { window } from "vscode";
import axios  from "axios";
import { log } from "console";

export interface FetchStreamOptions {
  url: string;
  requestInit: RequestInit;
  onmessage: (data: string) => void;
  ondone?: () => void;
  onerror?: (response: Response) => void;
}

export class FetchStream {
  url: string;
  requestInit: RequestInit;
  onmessage: FetchStreamOptions["onmessage"];
  ondone: FetchStreamOptions["ondone"];
  onerror: FetchStreamOptions["onerror"];

  constructor(options: FetchStreamOptions) {
    this.url = options.url;
    this.requestInit = options.requestInit;
    this.onmessage = options.onmessage;
    this.ondone = options.ondone;
    this.onerror = options.onerror;
    this.createFetchRequest();
  }

  createFetchRequest() {    
      // axios.post(this.url, this.requestInit.body)
		  // .then(response => {
			//   console.log(response.data);
      //   if (response.data) {
      //     this.onmessage(response.data);
      //   } else {
      //     this.ondone?.();
      //   }
		  // })
		  // .catch(error => {
      //   console.error(error);
      //   window.showErrorMessage(`${error}`);
      //   window.setStatusBarMessage(`${error}`, 10000);
      //   this.onerror?.(error);
		  // });
        const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
          if (event.type === "event") {
            // this.onmessage(event.data);
          }
        });
    
        fetch(this.url, this.requestInit)
          .then(response => {
            if (response.status === 200) {
              // console.log('response:', response.text());              
              return response.body!;
            } else {
              return Promise.reject(response);
            }
          }).then(async (readableStream) => { 
            for await (const chunk of readableStream) {         
              parser.feed(chunk.toString());
              this.onmessage(chunk.toString());
            }
          }).then(() => {
            this.ondone?.();
          }).catch(error => { 
            console.error('error:', error);
            window.showErrorMessage(`${error}`);
            window.setStatusBarMessage(`${error}`, 10000);
            // 失败回调
            this.onerror?.(error);
          });         
  }

}