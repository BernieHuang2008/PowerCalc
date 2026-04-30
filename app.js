// Math Notebook Application Logic
import { create_auto_suggest_handler } from './mathinput_auto_suggestion.js';

window.currentScope = {};

document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById('editor');
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    const fileInput = document.getElementById('fileInput');

    let cells = [];

    // Initialize with one cell
    addCell();

    // Re-evaluate all cells sequentially
    function evaluateAll() {
        let parser = math.parser();
        let promptIndex = 1;
        
        // Dynamically adjust prompt width based on number of cells
        const maxDigits = Math.max(1, cells.length.toString().length);
        const promptWidth = 45 + maxDigits * 10; // Approx 10px per character for number
        editor.style.setProperty('--prompt-width', `${promptWidth}px`);

        cells.forEach(cell => {
            const inputVal = cell.inputEl.value.trim();
            cell.promptEl.textContent = `In [${promptIndex}]:`;
            
            if (!inputVal) {
                cell.outputEl.textContent = "";
                cell.outputEl.classList.remove('error-output');
                cell.wrapperEl.classList.remove('has-output');
                promptIndex++;
                return;
            }

            try {
                let result = parser.evaluate(inputVal);

                let texResult = "";
                
                if (result !== undefined) {
                    if (typeof result === 'function') {
                        texResult = "\\text{[Function]}";
                    } else if (result.isResultSet) {
                         // Multiple results e.g., variable assignment + expression
                         let lastRes = result.entries[result.entries.length - 1];
                         texResult = math.parse(math.format(lastRes, {precision: 14})).toTex();
                    } else {
                         texResult = math.parse(math.format(result, {precision: 14})).toTex();
                    }
                    cell.outputEl.textContent = `\\[ ${texResult} \\]`;
                    if (window.MathJax && MathJax.typesetPromise) {
                        MathJax.typesetPromise([cell.outputEl]).catch((err) => console.log(err.message));
                    }
                    cell.outputEl.classList.remove('error-output');
                    cell.wrapperEl.classList.add('has-output');
                } else {
                    // Variable assignment might return undefined in some mathjs versions or situations, but typically returns the value
                    cell.outputEl.textContent = "";
                    cell.wrapperEl.classList.remove('has-output');
                }
            } catch (err) {
                cell.outputEl.textContent = err.toString();
                cell.outputEl.classList.add('error-output');
                cell.wrapperEl.classList.add('has-output');
            }
            promptIndex++;
        });
        
        window.currentScope = parser.getAll();
    }

    function addCell(index = cells.length, initialValue = "") {
        const wrapper = document.createElement('div');
        wrapper.className = 'cell';

        const inner = document.createElement('div');
        inner.className = 'cell-inner';

        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';

        const prompt = document.createElement('div');
        prompt.className = 'input-prompt';
        prompt.textContent = `In [ ]:`;

        const input = document.createElement('input');
        input.className = 'cell-input';
        input.type = 'text';
        input.value = initialValue;
        input.placeholder = "Enter expression...";
        input.oninput = create_auto_suggest_handler(input);

        const output = document.createElement('div');
        output.className = 'output-container';
        
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = '删除此行';

        inputContainer.appendChild(prompt);
        inputContainer.appendChild(input);
        inner.appendChild(deleteBtn);
        inner.appendChild(inputContainer);
        inner.appendChild(output);
        wrapper.appendChild(inner);

        // Insert at specific index visually
        if (index >= cells.length) {
            editor.appendChild(wrapper);
        } else {
            editor.insertBefore(wrapper, cells[index].wrapperEl);
        }

        const cellData = {
            id: Date.now() + Math.random().toString(),
            wrapperEl: wrapper,
            inputEl: input,
            outputEl: output,
            promptEl: prompt
        };

        cells.splice(index, 0, cellData);
        
        deleteBtn.addEventListener('click', () => {
            const arrIndex = cells.indexOf(cellData);
            if (arrIndex > -1) {
                cells.splice(arrIndex, 1);
                wrapper.remove();
                if (cells.length === 0) {
                    addCell();
                }
                evaluateAll();
            }
        });

        // Event listener for Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // trigger re-evaluation
                evaluateAll();
                
                // If it's the last cell, or we pressed enter and want to go to next cell
                let currentIndex = cells.indexOf(cellData);
                if (currentIndex === cells.length - 1) {
                    addCell(currentIndex + 1);
                }
                
                // Focus the next cell
                cells[currentIndex + 1].inputEl.focus();
            } else if (e.key === 'ArrowUp') {
                let currentIndex = cells.indexOf(cellData);
                if (currentIndex > 0) {
                    cells[currentIndex - 1].inputEl.focus();
                }
            } else if (e.key === 'ArrowDown') {
                let currentIndex = cells.indexOf(cellData);
                if (currentIndex < cells.length - 1) {
                    cells[currentIndex + 1].inputEl.focus();
                }
            }
        });

        // Whenever input changes, we might want to re-evaluate on blur or directly
        input.addEventListener('input', () => {
             // For purely active recalculation we could call evaluateAll() here, 
             // but user asked for "linear input after hitting enter", so evaluateAll handles it.
        });

        requestAnimationFrame(() => {
            input.focus();
            evaluateAll();
        });
    }

    // JSON Save Format similar to Jupyter
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const notebookObj = {
            cells: cells.map(c => ({
                cell_type: "code",
                source: [c.inputEl.value]
            }))
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notebookObj, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "notebook.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    loadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const notebookObj = JSON.parse(evt.target.result);
                if (notebookObj && Array.isArray(notebookObj.cells)) {
                    // Clear existing
                    editor.innerHTML = "";
                    cells = [];

                    notebookObj.cells.forEach((c, idx) => {
                        let sourceCode = Array.isArray(c.source) ? c.source.join("") : (c.source || "");
                        addCell(idx, sourceCode);
                    });
                    
                    if (cells.length === 0) {
                        addCell();
                    }
                    evaluateAll();
                } else {
                    alert("Invalid Math Notebook format.");
                }
            } catch (err) {
                alert("Error loading file: " + err.message);
            }
        };
        reader.readAsText(file);
        // Reset file input
        fileInput.value = "";
    });

});