import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';

var open_with_code = null;  //`
// # Welcome to Puter
// # Puter is a simple online Python interpreter
// # You can run Python code here
// # For example, you can run the following code
// print("Hello, Puter!")
// def add(a, b):
//     return a + b
// print(add(1, 2))
// 1+1
// # Enjoy it!
// `;
var open_with_file = null;
// puter.ui.onLaunchedWithItems(function(items){
//     if (items.length > 0) {
//         items[0].read().then((data) => {
//             open_with_file = items[0].name;
//             var fileReader = new FileReader();
//             fileReader.onload = function (e) {
//                 open_with_code = e.target.result;
//             }
//             fileReader.readAsText(data);
//         });
//     }
// })

const ENTER = '\r';
const DEL = '\u007F';
const VK_UP = '\x1b[A';
const VK_DOWN = '\x1b[B';
const VK_RIGHT = '\x1b[C';
const VK_LEFT = '\x1b[D';
var pyodide = null;
var pythonCodeX = 0;
var pythonCodeY = 0;
var historyCodeList = [];
var lastPythonCodeLine = "";
var renderingCode = false;
var stdout_codes = [];
function rawstdout(code) {
    stdout_codes.push(code);
}

var term = new Terminal();
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

var terminalContainer = document.getElementById('terminal');
console.log('terminalContainer', terminalContainer);
term.open(terminalContainer);

fitAddon.fit();

async function startPyodide() {
    term.write('Starting Python...');
    pyodide = await loadPyodide();
    await pyodide.loadPackage("pygments")
    
    var output = pyodide.runPython(`
    import sys
    from pygments import highlight
    from pygments.lexers import PythonLexer
    from pygments.formatters import TerminalTrueColorFormatter
    sys.version + ' (https://puter.com/)'
    `);
    
    term.write('\rPython ' + output + '\r\n');
    
    
    
    
    if(open_with_code !== null){
        stdout_codes = []
        pyodide.runPythonAsync(open_with_code).then(output => {
            let result = new TextDecoder().decode(new Uint8Array(stdout_codes));
            if (result.length > 0) {
                term.write(result.replaceAll("\n", "\r\n"));
            } else if (output != undefined) {
                term.write(output + '\n');
            }
            term.prompt();
        }).catch(err => {
            // term.write('\x1b[01;31m' + err.message.replaceAll('\n', '\r\n') + '\x1b[0m');
            open_with_code = ""
            pyodide.runPythonAsync(`
                _PY_code = """
                ${err.message.replaceAll('\n', '\r')}
                """
                _PY_highlighted_code = highlight(_PY_code, PythonLexer(), TerminalTrueColorFormatter(style='one-dark'));
                _PY_highlighted_code[:-1]
            `).then(output => {
                term.write(output.replaceAll('\n', '\r\n') + '\n')
                term.prompt();
            })
        });
    }
    else
    {
        pyodide.setStdout({ raw: rawstdout, isatty: true });
        term.prompt();
    }
}

term.prompt = () => {
    term.write('\r\x1b[01;32m>>> ');
};

var pythonCode = '';
var blockFlag = "";
var blockMap = {
    ":": "\r",
    "\\": "\r",
    "{": "}",
    "[": "]",
    "(": ")",
}
var historyIndex = 0;
var historyCode = "";
var lastCRIndex = 0;
function setCursorPosition(x, y) {
    term.write(`\x1b[${y};${x}H`)
}

async function writeHightPythonCode(x, y, pythonCode) {
    // term.write(e);
    setCursorPosition(x, y);
    await pyodide.runPythonAsync(`
        _PY_code = """
        ${pythonCode.replaceAll("\\", "\\\\")}
        """
        _PY_highlighted_code = highlight(_PY_code, PythonLexer(), TerminalTrueColorFormatter(style='native'));
        _PY_highlighted_code[:-1]
    `).then(output => {
        term.write(output.replaceAll('\n', '\r\n... '));
    });
}

function earseCureentLinePythonCode() {
    if (pythonCodeY === (term.buffer._normal.cursorY + term.buffer._normal.baseY + 1)) {
        term.write('\r\x1b[2K\x1b[01;32m>>> ');
    } else if (term.buffer._normal.cursorX > 4) {
        term.write('\r\x1b[2K... ');
    } else {
        term.write('\r\x1b[2K');
    }
}

term.onData(e => {
    const printable = !e.altKey && !e.ctrlKey && !e.metaKey;
    switch (e) {
        case VK_LEFT:
            if (term.buffer._normal.cursorX > 4) {
                setCursorPosition(term.buffer._normal.cursorX, term.buffer._normal.cursorY + 1);
            }
            break;
        case VK_RIGHT:
            lastCRIndex = pythonCode.lastIndexOf('\r');
            lastPythonCodeLine = pythonCode.substring(lastCRIndex + 1, pythonCode.length + 1);
            if (term.buffer._normal.cursorX < (lastPythonCodeLine.length % term.cols + 4)) {
                setCursorPosition(term.buffer._normal.cursorX + 2, term.buffer._normal.cursorY + 1);
            }
            break;
        case VK_UP:
            if (historyCodeList.length === 0) {
                break;
            }
            if (pythonCode.length === 0) {
                pythonCodeX = term.buffer._normal.cursorX + 1;
                pythonCodeY = term.buffer._normal.cursorY + term.buffer._normal.baseY + 1;
            }
            historyCode = "";
            historyIndex += 1;
            if (historyIndex > (historyCodeList.length + 1)) {
                historyIndex = historyCodeList.length + 1;
            } else if (historyIndex != (historyCodeList.length + 1)) {
                historyCode = historyCodeList[historyCodeList.length - historyIndex]
            }
            earseCureentLinePythonCode();
            lastCRIndex = pythonCode.lastIndexOf('\r');
            pythonCode = pythonCode.substring(0, lastCRIndex + 1) + historyCode;
            if (historyCode.length > 0) {
                writeHightPythonCode(5, pythonCodeY - term.buffer._normal.baseY, pythonCode)
            }
            break;
        case VK_DOWN:
            if (historyCodeList.length === 0) {
                break;
            }
            if (pythonCode.length === 0) {
                pythonCodeX = term.buffer._normal.cursorX + 1;
                pythonCodeY = term.buffer._normal.cursorY + term.buffer._normal.baseY + 1;
            }
            historyCode = "";
            historyIndex -= 1;
            if (historyIndex < 0) {
                historyIndex = 0;
            } else if (historyIndex === 0) {
                historyCode = lastPythonCodeLine;
            }
            else {
                historyCode = historyCodeList[historyCodeList.length - historyIndex]
            }
            earseCureentLinePythonCode();
            lastCRIndex = pythonCode.lastIndexOf('\r');
            pythonCode = pythonCode.substring(0, lastCRIndex + 1) + historyCode;
            if (historyCode.length > 0) {
                writeHightPythonCode(5, pythonCodeY - term.buffer._normal.baseY, pythonCode)
            }
            break;
        case ENTER:
            if (pythonCode.length > 0) {
                historyIndex = 0;
                let pythonCodeList = pythonCode.split('\r');
                let lastLine = pythonCodeList[pythonCodeList.length - 1];
                if (lastLine.length > 0) {
                    historyCodeList = historyCodeList.concat(lastLine)
                }
                if (((pythonCode[pythonCode.length - 1] in blockMap)) && (blockFlag === "")) {
                    blockFlag = pythonCode[pythonCode.length - 1];
                    pythonCode += e;
                    term.writeln("\r");
                    term.write('... ');
                    break;
                }
                if (blockFlag != "") {
                    if (pythonCode[pythonCode.length - 1] === blockMap[blockFlag]) {
                        blockFlag = "";
                    } else {
                        pythonCode += e;
                        term.writeln("\r");
                        term.write('... ');
                        break;
                    }
                }
                term.writeln('\x1b[0m');

                stdout_codes = []
                pyodide.runPythonAsync(pythonCode).then(output => {
                    let result = new TextDecoder().decode(new Uint8Array(stdout_codes));
                    if (result.length > 0) {
                        term.write(result.replaceAll("\n", "\r\n"));
                    } else if (output != undefined) {
                        term.write(output + '\n');
                    }
                    term.prompt();
                }).catch(err => {
                    // term.write('\x1b[01;31m' + err.message.replaceAll('\n', '\r\n') + '\x1b[0m');
                    pythonCode = ""
                    pyodide.runPythonAsync(`
                        _PY_code = """
                        ${err.message.replaceAll('\n', '\r')}
                        """
                        _PY_highlighted_code = highlight(_PY_code, PythonLexer(), TerminalTrueColorFormatter(style='one-dark'));
                        _PY_highlighted_code[:-1]
                    `).then(output => {
                        term.write(output.replaceAll('\n', '\r\n') + '\n')
                        term.prompt();
                    })
                });

            } else {
                term.writeln('\x1b[0m');
                term.prompt();
            }
            pythonCode = '';
            break;
        case DEL:
            lastCRIndex = pythonCode.lastIndexOf('\r');
            lastPythonCodeLine = pythonCode.substring(lastCRIndex + 1, pythonCode.length + 1);
            if (term._core.buffer.x > 4 || lastPythonCodeLine.length >= term.cols - 4) {
                let currentCursorY = term.buffer._normal.cursorY + term.buffer._normal.baseY + 1;
                let lasetEditIndex = term.buffer._normal.cursorX - 4;
                let editIndex = lasetEditIndex;
                if (lastPythonCodeLine.length >= term.cols - 4) {
                    editIndex = lasetEditIndex + (currentCursorY - pythonCodeY) * term.cols
                }
                pythonCode = pythonCode.substring(0, lastCRIndex + 1) + lastPythonCodeLine.slice(0, editIndex - 1) + lastPythonCodeLine.slice(editIndex);
                term.write('\x1b[?25l');
                earseCureentLinePythonCode();
                writeHightPythonCode(pythonCodeX, pythonCodeY - term.buffer._normal.baseY, pythonCode).then(() => {
                    if (lastPythonCodeLine.length === term.cols - 4) {
                        setCursorPosition(term.cols, currentCursorY - term.buffer._normal.baseY - 1);
                    } else {
                        setCursorPosition(lasetEditIndex + 4, currentCursorY - term.buffer._normal.baseY);
                    }
                    term.write('\x1b[?25h'); // Show cursor
                });
            }

            break;
        default:
            if (printable) {
                if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E) || e >= '\u00a0') {
                    if (renderingCode === true) {
                        break;
                    }
                    renderingCode = true;
                    if (pythonCode.length === 0) {
                        pythonCodeX = term.buffer._normal.cursorX + 1;
                        pythonCodeY = term.buffer._normal.cursorY + term.buffer._normal.baseY + 1;
                    }
                    let currentCursorY = term.buffer._normal.cursorY + term.buffer._normal.baseY + 1;
                    lastCRIndex = pythonCode.lastIndexOf('\r');
                    let lasetEditIndex = term.buffer._normal.cursorX - 4;
                    let editIndex = lasetEditIndex;
                    lastPythonCodeLine = pythonCode.substring(lastCRIndex + 1, pythonCode.length + 1);
                    if (lastPythonCodeLine.length >= term.cols - 4) {
                        editIndex = lasetEditIndex + (currentCursorY - pythonCodeY) * term.cols;
                    }
                    lastPythonCodeLine = lastPythonCodeLine.slice(0, editIndex) + e + lastPythonCodeLine.slice(editIndex)
                    pythonCode = pythonCode.substring(0, lastCRIndex + 1) + lastPythonCodeLine;
                    term.write('\x1b[?25l');
                    writeHightPythonCode(pythonCodeX, pythonCodeY - term.buffer._normal.baseY, pythonCode).then(() => {
                        if ((lasetEditIndex + 6) > term.cols) {
                            setCursorPosition(0, currentCursorY - term.buffer._normal.baseY + 1);
                        } else {
                            setCursorPosition(lasetEditIndex + 6, currentCursorY - term.buffer._normal.baseY);
                        }
                        term.write('\x1b[?25h'); // Show cursor
                        renderingCode = false;
                    });
                }
            }
    }
});

console.log('Starting Pyodide...');
startPyodide();