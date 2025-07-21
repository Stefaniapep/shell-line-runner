import * as vscode from 'vscode';
import * as path from 'path';

class ShellLineDecorationProvider {
    private normalDecorationType: vscode.TextEditorDecorationType;
    private hoverDecorationType: vscode.TextEditorDecorationType;
    private clickedDecorationType: vscode.TextEditorDecorationType;
    private decorationRanges: Map<string, vscode.Range[]> = new Map();
    private currentHoverLine: number = -1;
    private currentClickedLine: number = -1;
    
    constructor() {
        // Stato normale - molto trasparente
        this.normalDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: 'rgba(128, 128, 128, 0.3)', // Grigio molto trasparente
                margin: '0 4px 0 0',
                width: '14px',
                height: '14px',
                textDecoration: 'none; cursor: pointer;'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // Stato hover - più evidente
        this.hoverDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: 'rgba(214, 214, 214, 0.8)', // Blu più visibile
                margin: '0 4px 0 0',
                width: '14px',
                height: '14px',
                textDecoration: 'none; cursor: pointer;',
                backgroundColor: 'rgba(100, 150, 255, 0.1)' // Sfondo leggero solo sull'icona
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // Stato clicked - bianco
        this.clickedDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: '#ffffff', // Bianco puro
                margin: '0 4px 0 0',
                width: '14px',
                height: '14px',
                textDecoration: 'none; cursor: pointer;',
                backgroundColor: 'rgba(255, 255, 255, 0.2)' // Sfondo bianco leggero solo sull'icona
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    private isExecutableLine(line: vscode.TextLine): boolean {
        const trimmedText = line.text.trim();
        
        // Riga vuota
        if (trimmedText.length === 0) {
            return false;
        }
        
        // Commenti bash (#)
        if (trimmedText.startsWith('#')) {
            return false;
        }
        
        // Altri tipi di commenti shell comuni
        if (trimmedText.startsWith('//') || trimmedText.startsWith('/*')) {
            return false;
        }
        
        return true;
    }

    updateDecorations(editor: vscode.TextEditor) {
        const normalDecorations: vscode.DecorationOptions[] = [];
        const hoverDecorations: vscode.DecorationOptions[] = [];
        const clickedDecorations: vscode.DecorationOptions[] = [];
        const ranges: vscode.Range[] = [];
        
        for (let i = 0; i < editor.document.lineCount; i++) {
            const line = editor.document.lineAt(i);
            if (this.isExecutableLine(line)) {
                const range = new vscode.Range(i, 0, i, 1);
                ranges.push(range);
                
                const decoration = {
                    range,
                    hoverMessage: 'Click to run this line'
                };

                if (i === this.currentClickedLine) {
                    clickedDecorations.push(decoration);
                } else if (i === this.currentHoverLine) {
                    hoverDecorations.push(decoration);
                } else {
                    normalDecorations.push(decoration);
                }
            }
        }
        
        // Memorizza i range per la gestione dei click
        this.decorationRanges.set(editor.document.uri.toString(), ranges);
        
        // Applica tutte le decorazioni
        editor.setDecorations(this.normalDecorationType, normalDecorations);
        editor.setDecorations(this.hoverDecorationType, hoverDecorations);
        editor.setDecorations(this.clickedDecorationType, clickedDecorations);
    }

    setHoverLine(editor: vscode.TextEditor, line: number) {
        if (this.currentHoverLine !== line) {
            this.currentHoverLine = line;
            this.updateDecorations(editor);
        }
    }

    clearHover(editor: vscode.TextEditor) {
        if (this.currentHoverLine !== -1) {
            this.currentHoverLine = -1;
            this.updateDecorations(editor);
        }
    }

    setClickedLine(editor: vscode.TextEditor, line: number) {
        this.currentClickedLine = line;
        this.updateDecorations(editor);
        
        // Rimuovi lo stato clicked dopo 200ms
        setTimeout(() => {
            this.currentClickedLine = -1;
            this.updateDecorations(editor);
        }, 200);
    }

    handleClick(editor: vscode.TextEditor, position: vscode.Position): boolean {
        const ranges = this.decorationRanges.get(editor.document.uri.toString());
        if (!ranges) return false;

        // Controlla se il click è su una decorazione
        for (const range of ranges) {
            if (range.contains(position)) {
                // Imposta lo stato clicked
                this.setClickedLine(editor, range.start.line);
                
                // Esegui il comando
                vscode.commands.executeCommand('shell-line-runner.runLine', range.start.line);
                return true;
            }
        }
        return false;
    }

    handleMouseMove(editor: vscode.TextEditor, position: vscode.Position) {
        const ranges = this.decorationRanges.get(editor.document.uri.toString());
        if (!ranges) return;

        let foundHover = false;
        // Controlla se il mouse è sopra una decorazione
        for (const range of ranges) {
            if (range.contains(position)) {
                this.setHoverLine(editor, range.start.line);
                foundHover = true;
                break;
            }
        }
        
        if (!foundHover) {
            this.clearHover(editor);
        }
    }

    dispose() {
        this.normalDecorationType.dispose();
        this.hoverDecorationType.dispose();
        this.clickedDecorationType.dispose();
        this.decorationRanges.clear();
    }
}

// Alternativa: Usa CodeLens con icona personalizzata
class ShellLineCodeLensProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.text.trim().length > 0) {
                const range = new vscode.Range(i, 0, i, 0);
                
                codeLenses.push(new vscode.CodeLens(range, {
                    title: '$(play)', // Solo icona, più compatta
                    tooltip: 'Run this line',
                    command: 'shell-line-runner.runLine',
                    arguments: [i]
                }));
            }
        }
        
        return codeLenses;
    }
}

let decorationProvider: ShellLineDecorationProvider;

export function activate(context: vscode.ExtensionContext) {
    const useDecorations = true; // Cambia a false per usare CodeLens
    
    if (useDecorations) {
        // SOLUZIONE CON DECORATIONS CLICCABILI
        decorationProvider = new ShellLineDecorationProvider();
        
        // Aggiorna decorations quando cambia l'editor attivo
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && editor.document.languageId === 'shellscript') {
                    decorationProvider.updateDecorations(editor);
                }
            })
        );
        
        // Aggiorna decorations quando cambia il documento
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                const editor = vscode.window.activeTextEditor;
                if (editor && event.document === editor.document && editor.document.languageId === 'shellscript') {
                    decorationProvider.updateDecorations(editor);
                }
            })
        );
        
        // Gestisci il movimento del mouse per l'hover
        // NOTA: La gestione dei click è stata semplificata usando onDidChangeTextEditorSelection
        // che è un modo comune ma non perfetto per rilevare i click.
        // Potrebbe attivarsi anche con la navigazione da tastiera.
        // Un'API più robusta per i click sui gutter non esiste ancora.
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection(event => {
                // Controlla che sia un file shellscript e che l'evento non sia una selezione di testo
                if (event.textEditor.document.languageId === 'shellscript') {
                     const position = event.selections[0].active;
                    // Prova a gestire il click solo se la selezione è vuota (un cursore)
                    if (event.selections.length === 1 && event.selections[0].isEmpty) {
                        const clicked = decorationProvider.handleClick(event.textEditor, position);
                        // Se non è stato un click sul decoratore, gestisci l'hover
                        if (!clicked) {
                           decorationProvider.handleMouseMove(event.textEditor, position);
                        }
                    }
                } else if (event.textEditor.document.languageId === 'shellscript') {
                    // Gestisci comunque l'hover durante la selezione con il mouse
                    const position = event.selections[0].active;
                    decorationProvider.handleMouseMove(event.textEditor, position);
                }
            })
        );
        
        // Aggiorna immediatamente se c'è già un editor aperto
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'shellscript') {
            decorationProvider.updateDecorations(vscode.window.activeTextEditor);
        }
    } else {
        // SOLUZIONE CON CODELENS
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                { language: 'shellscript' },
                new ShellLineCodeLensProvider()
            )
        );
    }

    // Command handler
    context.subscriptions.push(
        vscode.commands.registerCommand('shell-line-runner.runLine', (line: number) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'shellscript') {
                
                // --- NUOVA LOGICA: EVIDENZIARE LA RIGA ---
                
                // 1. Otteniamo l'oggetto completo della riga per accedere al suo range.
                const lineObject = editor.document.lineAt(line);
                const lineText = lineObject.text;

                // 2. Creiamo una nuova selezione che copre l'intera riga.
                const selection = new vscode.Selection(lineObject.range.start, lineObject.range.end);

                // 3. Applichiamo la selezione all'editor.
                editor.selection = selection;
                
                // 4. (Opzionale ma consigliato) Assicuriamoci che la riga sia visibile.
                editor.revealRange(lineObject.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

                // --- FINE NUOVA LOGICA ---

                // 5. Eseguiamo il comando nel terminale.
                const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
                terminal.show();
                terminal.sendText(lineText);
            }
        })
    );
}

export function deactivate() {
    if (decorationProvider) {
        decorationProvider.dispose();
    }
}

