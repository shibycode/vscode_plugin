import fetch, { RequestInit, Response } from "node-fetch";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import { window } from "vscode";
import axios  from "axios";

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
      axios.post(this.url, this.requestInit.body)
		  .then(response => {
			  console.log(response.data);
        if (response.data) {
          this.onmessage(response.data);
        } else {
          this.ondone?.();
        }
		  })
		  .catch(error => {
        console.error(error);
        window.showErrorMessage(`${error}`);
        window.setStatusBarMessage(`${error}`, 10000);
        this.onerror?.(error);
		  });
  }


}
