import * as vscode from 'vscode';

export class LineDecorator {
    private decorator: vscode.TextEditorDecorationType;
    private activeEditor: vscode.TextEditor | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.decorator = vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZD0iTTQgMmwxMCA2LTEwIDZ6IiBmaWxsPSIjMzk5OUZGIi8+PC9zdmc+'),
            gutterIconSize: 'contain'
        });
    }

    public activate(context: vscode.ExtensionContext) {
        this.activeEditor = vscode.window.activeTextEditor;

        vscode.window.onDidChangeActiveTextEditor(editor => {
            this.activeEditor = editor;
            if (editor) {
                this.updateDecorations();
            }
        }, null, context.subscriptions);

        vscode.workspace.onDidChangeTextDocument(event => {
            if (this.activeEditor && event.document === this.activeEditor.document) {
                this.updateDecorations();
            }
        }, null, context.subscriptions);

        if (this.activeEditor) {
            this.updateDecorations();
        }

        // Store the main command in extension context
        context.subscriptions.push(
            vscode.commands.registerCommand('shell-line-runner.runLine', (line: number) => {
                if (this.activeEditor) {
                    const lineText = this.activeEditor.document.lineAt(line).text;
                    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
                    terminal.show();
                    terminal.sendText(lineText);
                }
            })
        );
    }

    private updateDecorations() {
        if (!this.activeEditor || this.activeEditor.document.languageId !== 'shellscript') {
            return;
        }

        // Dispose previous line-specific commands
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        const decorations: vscode.DecorationOptions[] = [];
        for (let i = 0; i < this.activeEditor.document.lineCount; i++) {
            const line = this.activeEditor.document.lineAt(i);
            if (line.text.trim().length > 0) {
                decorations.push({
                    range: new vscode.Range(i, 0, i, 0),
                    hoverMessage: 'Click to run this line'
                });

                // Register click handler for this line
                const disposable = vscode.commands.registerCommand(`shell-line-runner.runLine${i}`, () => {
                    vscode.commands.executeCommand('shell-line-runner.runLine', i);
                });
                
                this.disposables.push(disposable);
            }
        }

        this.activeEditor.setDecorations(this.decorator, decorations);
    }

    public dispose() {
        this.decorator.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}

