import * as vscode from 'vscode';
import * as path from 'path';

class ShellLineDecorationProvider {
    private clickableDecorationType: vscode.TextEditorDecorationType;
    private clickedDecorationType: vscode.TextEditorDecorationType;
    
    private decorationRanges: Map<string, vscode.Range[]> = new Map();
    private currentClickedLine: number = -1;
    
    constructor() {

        this.clickableDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: 'rgba(173, 173, 173, 0.8)', 
                margin: '0 4px 0 0',
                textDecoration: 'none; cursor: pointer;' 
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.clickedDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: '#FFFFFF', 
                margin: '0 4px 0 0',
                textDecoration: 'none; cursor: pointer;',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    private isExecutableLine(line: vscode.TextLine): boolean {
        const trimmedText = line.text.trim();

        return !(trimmedText.length === 0 || trimmedText.startsWith('#'));
    }

    public updateDecorations(editor: vscode.TextEditor) {
        const clickableDecorations: vscode.DecorationOptions[] = [];
        const clickedDecorations: vscode.DecorationOptions[] = [];
        const newRanges: vscode.Range[] = [];
        
        for (let i = 0; i < editor.document.lineCount; i++) {
            const line = editor.document.lineAt(i);
            if (this.isExecutableLine(line)) {
                const range = new vscode.Range(i, 0, i, 0);
                newRanges.push(range);
                
                const decoration = {
                    range,
                    hoverMessage: 'Click to run this line' 
                };

                if (i === this.currentClickedLine) {
                    clickedDecorations.push(decoration);
                } else {
                    clickableDecorations.push(decoration);
                }
            }
        }
        
        this.decorationRanges.set(editor.document.uri.toString(), newRanges);
        editor.setDecorations(this.clickableDecorationType, clickableDecorations);
        editor.setDecorations(this.clickedDecorationType, clickedDecorations);
    }

    public handleClick(editor: vscode.TextEditor, position: vscode.Position): boolean {
        const ranges = this.decorationRanges.get(editor.document.uri.toString());
        if (!ranges) return false;

        for (const range of ranges) {
            if (range.contains(position)) {
                const lineToRun = range.start.line;

                this.currentClickedLine = lineToRun;
                this.updateDecorations(editor);
                
                setTimeout(() => {
                    this.currentClickedLine = -1;
                    if (vscode.window.activeTextEditor === editor) {
                        this.updateDecorations(editor);
                    }
                }, 250);
                
                vscode.commands.executeCommand('shell-line-runner.runLine', lineToRun);
                return true;
            }
        }
        return false;
    }

    public dispose() {
        this.clickableDecorationType.dispose();
        this.clickedDecorationType.dispose();
    }
}

let decorationProvider: ShellLineDecorationProvider;

export function activate(context: vscode.ExtensionContext) {
    decorationProvider = new ShellLineDecorationProvider();

    const updateDecorationsForActiveEditor = () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'shellscript') {
            decorationProvider.updateDecorations(editor);
        }
    };

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            updateDecorationsForActiveEditor();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                updateDecorationsForActiveEditor();
            }
        })
    );
    
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (event.textEditor.document.languageId === 'shellscript' &&
                event.kind === vscode.TextEditorSelectionChangeKind.Mouse && 
                event.selections.length === 1 &&
                event.selections[0].isEmpty) 
            {
                const position = event.selections[0].active;
                decorationProvider.handleClick(event.textEditor, position);
            }
        })
    );
    
    updateDecorationsForActiveEditor();

    context.subscriptions.push(
        vscode.commands.registerCommand('shell-line-runner.runLine', (line: number) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'shellscript') {
                const lineObject = editor.document.lineAt(line);
                
                editor.selection = new vscode.Selection(lineObject.range.start, lineObject.range.end);
                editor.revealRange(lineObject.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

                const terminal = vscode.window.activeTerminal || vscode.window.createTerminal({ name: "Shell Runner" });
                terminal.show();
                terminal.sendText(lineObject.text);
            }
        })
    );
}

export function deactivate() {
    if (decorationProvider) {
        decorationProvider.dispose();
    }
}