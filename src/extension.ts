import * as vscode from 'vscode';

export class ShellLineCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.text.trim().length > 0) {
                const range = new vscode.Range(i, 0, i, 0);
                const command = {
                    title: "$(play) Run",
                    command: 'shell-line-runner.runLine',
                    arguments: [document, i]
                };
                codeLenses.push(new vscode.CodeLens(range, command));
            }
        }
        
        return codeLenses;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const codeLensProvider = new ShellLineCodeLensProvider();
    
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: 'shellscript', scheme: 'file' },
            codeLensProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('shell-line-runner.runLine', 
            (document: vscode.TextDocument, line: number) => {
                const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
                const lineText = document.lineAt(line).text;
                terminal.show();
                terminal.sendText(lineText);
            }
        )
    );
}

export function deactivate() {}