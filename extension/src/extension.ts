import * as vscode from 'vscode';
import * as fs from 'fs';
import { JsonlIndexer } from './indexer';

const VIEW_TYPE = 'jsonVision.editor';

export function activate(context: vscode.ExtensionContext) {
  const provider = new JsonVisionEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    }),
  );

  // Command: open the active JSON/JSONL file in JSON Vision.
  context.subscriptions.push(
    vscode.commands.registerCommand('jsonVision.open', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        vscode.window.showWarningMessage('Open a .json or .jsonl file first.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE);
    }),
  );
}

export function deactivate() {}

interface VisionDocument extends vscode.CustomDocument {
  indexer: JsonlIndexer;
}

class JsonVisionEditorProvider implements vscode.CustomReadonlyEditorProvider<VisionDocument> {
  constructor(private readonly context: vscode.ExtensionContext) {}

  // We never load the file content into a TextDocument (which would hit VS Code's
  // ~50MB editor limit). We keep only the uri and do our own fs paging.
  openCustomDocument(uri: vscode.Uri): VisionDocument {
    const name = uri.path.split('/').pop() ?? uri.fsPath;
    return {
      uri,
      indexer: new JsonlIndexer(uri.fsPath, name),
      dispose: () => {},
    };
  }

  async resolveCustomEditor(
    document: VisionDocument,
    panel: vscode.WebviewPanel,
  ): Promise<void> {
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    };
    panel.webview.html = this.getHtml(panel.webview, mediaRoot);

    panel.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === 'init') {
          const res = await document.indexer.init((progress, rows) => {
            panel.webview.postMessage({ type: 'progress', id: msg.id, progress, rowsIndexed: rows });
          });
          panel.webview.postMessage({ type: 'ready', id: msg.id, ...res });
        } else if (msg.type === 'getRows') {
          const rows = await document.indexer.getRows(msg.start, msg.count);
          panel.webview.postMessage({ type: 'rows', id: msg.id, start: msg.start, rows });
        } else if (msg.type === 'getRowsByIndices') {
          const rows = await document.indexer.getRowsByIndices(msg.indices);
          panel.webview.postMessage({ type: 'rowsByIndices', id: msg.id, rows });
        } else if (msg.type === 'query') {
          const res = await document.indexer.query(msg.spec, (progress) => {
            panel.webview.postMessage({ type: 'progress', id: msg.id, progress, rowsIndexed: 0 });
          });
          panel.webview.postMessage({ type: 'queryResult', id: msg.id, order: res.order, matched: res.matched });
        }
      } catch (err) {
        panel.webview.postMessage({
          type: 'error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private getHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
    const indexPath = vscode.Uri.joinPath(mediaRoot, 'index.html');
    let html = fs.readFileSync(indexPath.fsPath, 'utf-8');

    const baseUri = webview.asWebviewUri(mediaRoot).toString();
    const nonce = makeNonce();

    // Rewrite relative asset URLs (./assets/...) to webview resource URIs.
    html = html.replace(/(src|href)="\.\/assets\//g, `$1="${baseUri}/assets/`);
    // Add a nonce to every module/script tag so our CSP allows them.
    html = html.replace(/<script /g, `<script nonce="${nonce}" `);

    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource} https: data:`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `worker-src ${webview.cspSource} blob:`,
      `connect-src ${webview.cspSource}`,
    ].join('; ');

    const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
    html = html.replace('<head>', `<head>\n    ${meta}`);
    return html;
  }
}

function makeNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
