import * as vscode from 'vscode';

/**
 * Gestisce la creazione e l'aggiornamento delle decorazioni "play" a lato di ogni riga eseguibile.
 */
class ShellLineDecorationProvider {
    private visibleDecorationType: vscode.TextEditorDecorationType;
    private fadedDecorationType: vscode.TextEditorDecorationType;
    private decorationRanges: Map<string, vscode.Range[]> = new Map();
    private visibleLine: number = -1; // Traccia la linea con la decorazione attiva

    constructor() {
        // Decorazione per la riga attiva (più visibile)
        this.visibleDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: 'rgba(255,255,255,0.8)',
                margin: '0 4px 0 0',
                textDecoration: 'none; cursor: pointer;',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });

        // Decorazione per le altre righe eseguibili (meno visibile)
        this.fadedDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '▶',
                color: 'rgba(255,255,255,0.1)',
                margin: '0 4px 0 0',
                textDecoration: 'none; cursor: pointer;',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });
    }

    /**
     * Controlla se una riga contiene codice eseguibile (non vuota e non un commento).
     */
    private isExecutableLine(line: vscode.TextLine): boolean {
        const trimmed = line.text.trim();
        return trimmed.length > 0 && !trimmed.startsWith('#');
    }

    /**
     * Aggiorna le decorazioni nell'editor, evidenziando la riga attiva.
     */
    public updateDecorations(editor: vscode.TextEditor, selection?: vscode.Selection) {
        const faded: vscode.DecorationOptions[] = [];
        const visible: vscode.DecorationOptions[] = [];
        const ranges: vscode.Range[] = [];

        const active = selection ?? editor.selection;
        // Calcola la riga attiva (la prima riga di una selezione) e la memorizza.
        const selectedLine = !active.isEmpty ? Math.min(active.start.line, active.end.line) : -1;
        this.visibleLine = selectedLine;

        for (let i = 0; i < editor.document.lineCount; i++) {
            const line = editor.document.lineAt(i);
            if (!this.isExecutableLine(line)) continue;

            const range = new vscode.Range(i, 0, i, 0);
            ranges.push(range);

            const deco = { range, hoverMessage: 'Click to run' };
            if (i === selectedLine) {
                visible.push(deco);
            } else {
                faded.push(deco);
            }
        }

        this.decorationRanges.set(editor.document.uri.toString(), ranges);
        editor.setDecorations(this.visibleDecorationType, visible);
        editor.setDecorations(this.fadedDecorationType, faded);
    }

    /**
     * Restituisce il numero di riga se il click è avvenuto su una decorazione.
     */
    public getClickedLine(editor: vscode.TextEditor, position: vscode.Position): number | undefined {
        const ranges = this.decorationRanges.get(editor.document.uri.toString());
        if (!ranges) return;

        for (const range of ranges) {
            if (range.contains(position)) {
                return range.start.line;
            }
        }
        return;
    }

    /**
     * Restituisce il numero della riga che ha la decorazione attiva (visibile).
     */
    public getVisibleLine(): number {
        return this.visibleLine;
    }

    /**
     * Rilascia le risorse delle decorazioni quando l'estensione viene disattivata.
     */
    public dispose() {
        this.visibleDecorationType.dispose();
        this.fadedDecorationType.dispose();
    }
}

const decorationProvider = new ShellLineDecorationProvider();
/**
 * Funzione principale che attiva l'estensione.
 */
export function activate(context: vscode.ExtensionContext) {
    let lastSelection: vscode.Selection | undefined;

    // Aggiorna le decorazioni quando l'editor attivo cambia
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'shellscript') {
                decorationProvider.updateDecorations(editor);
                lastSelection = editor.selection;
            }
        })
    );

    // Aggiorna le decorazioni quando il testo del documento cambia
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === event.document && editor.document.languageId === 'shellscript') {
                decorationProvider.updateDecorations(editor, editor.selection);
            }
        })
    );

    // Gestore principale per click ed eventi di selezione
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            const editor = event.textEditor;
            if (editor.document.languageId !== 'shellscript') return;

            const currentSelection = event.selections[0];
            const selectionBeforeClick = lastSelection;
            lastSelection = currentSelection;

            const clickedLine = decorationProvider.getClickedLine(editor, currentSelection.active);
            const visibleLine = decorationProvider.getVisibleLine();
            const wasMultiLine = selectionBeforeClick && !selectionBeforeClick.isEmpty && (selectionBeforeClick.start.line !== selectionBeforeClick.end.line);

            // ⚠️ Solo dopo aver ottenuto clickedLine aggiorniamo le decorazioni
            decorationProvider.updateDecorations(editor, currentSelection);

            if (
                event.kind === vscode.TextEditorSelectionChangeKind.Mouse &&
                currentSelection.isEmpty &&
                clickedLine !== undefined
            ) {
                let textToSend: string;

                if (wasMultiLine && clickedLine === visibleLine) {
                    editor.selection = selectionBeforeClick;

                    const rawText = editor.document.getText(selectionBeforeClick);
                    textToSend = rawText
                        .split(/\r?\n/)
                        .filter(line => {
                            const trimmed = line.trim();
                            return trimmed.length > 0 && !trimmed.startsWith('#');
                        })
                        .join('\n');

                    lastSelection = undefined;
                } else {
                    const clickedLineObject = editor.document.lineAt(clickedLine);
                    const lineSelection = new vscode.Selection(clickedLineObject.range.start, clickedLineObject.range.end);
                    editor.selection = lineSelection;
                    textToSend = clickedLineObject.text;
                }

                sendToTerminal(textToSend);
            }
        })
    );

    // Inizializza le decorazioni all'avvio se un file shell è già aperto
    if (vscode.window.activeTextEditor) {
        const editor = vscode.window.activeTextEditor;
        if (editor.document.languageId === 'shellscript') {
            decorationProvider.updateDecorations(editor);
            lastSelection = editor.selection;
        }
    }

    // Aggiunge il provider alla lista di oggetti da deallocare
    context.subscriptions.push({ dispose: () => decorationProvider.dispose() });
}

/**
 * Invia il testo fornito al terminale attivo, o ne crea uno nuovo.
 */
function sendToTerminal(text: string) {
    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal({ name: 'Shell Runner' });
    terminal.show();

    // Invia una riga alla volta per una maggiore robustezza
    text.split(/\r?\n/).forEach(line => {
        if (line.trim().length > 0) {
            terminal.sendText(line);
        }
    });
}

/**
 * Funzione chiamata quando l'estensione viene disattivata.
 */

export function deactivate() {
    if (decorationProvider) {
        decorationProvider.dispose();
    }
}