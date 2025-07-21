import * as vscode from 'vscode';
import * as path from 'path';

class ShellLineCodeLensProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.text.trim().length > 0) {
                const range = new vscode.Range(i, 0, i, 0);
                codeLenses.push(new vscode.CodeLens(range, {
                    title: '▶',
                    command: 'shell-line-runner.runLine',
                    arguments: [i]
                }));
            }
        }
        return codeLenses;
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Register CodeLens provider
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: 'shellscript' },
            new ShellLineCodeLensProvider()
        )
    );

    // Register command handler
    context.subscriptions.push(
        vscode.commands.registerCommand('shell-line-runner.runLine', (line: number) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const lineText = editor.document.lineAt(line).text;
                const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
                terminal.show();
                terminal.sendText(lineText);
            }
        })
    );
}

export function deactivate() {}