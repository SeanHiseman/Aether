const interactiveEditorScript = `
    <script>
    (function() {
        let selectedElement = null;
        let isResizing = false;
        let originalWidth, originalHeight, startX, startY;
        let editorActive = true;
        function createEditorControls() {
            const controls = document.createElement('div');
            controls.id = 'editor-controls';
            controls.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#333;padding:10px;border-radius:5px;z-index:9999;display:none;';
            const label = document.createElement('span');
            label.textContent = 'Style: ';
            label.style.color = 'white';
            const propertySelect = document.createElement('select');
            propertySelect.id = 'style-property';
            ['color', 'backgroundColor'].forEach(prop => {
                const option = document.createElement('option');
                option.value = prop;
                option.textContent = prop;
                propertySelect.appendChild(option);
            });
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.id = 'style-color';
            colorInput.onchange = function() {
                if (selectedElement) {
                    const property = propertySelect.value;
                    selectedElement.style[property] = this.value;
                    sendHeight();
                    parent.postMessage({
                        action: 'editedContentReady',
                        blockId: '${id}',
                        editedContent: document.documentElement.outerHTML
                    }, '*');
                }
            };
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.marginLeft = '10px';
            closeBtn.onclick = () => {
                controls.style.display = 'none';
                deselectElement();
            };
            controls.appendChild(label);
            controls.appendChild(propertySelect);
            controls.appendChild(colorInput);
            controls.appendChild(closeBtn);
            document.body.appendChild(controls);
            return controls;
        }
        function updateColorInputStyle(element) {
            const colorInput = document.getElementById('style-color');
            const property = document.getElementById('style-property')?.value || 'color';
            if (colorInput) {
                const computedStyle = window.getComputedStyle(element);
                colorInput.value = rgbToHex(computedStyle[property]);
            }
        }
        function createResizeHandles(element) {
            const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
            const container = document.createElement('div');
            container.className = 'resize-container';
            container.style.cssText = 'position:absolute;pointer-events:none;border:1px dashed blue;z-index:9998;';
            handles.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = 'resize-handle ' + pos;
                handle.style.cssText = 'position:absolute;width:10px;height:10px;background:blue;border-radius:50%;z-index:10000;cursor:' + pos + '-resize;pointer-events:all;';
                if (pos.includes('n')) handle.style.top = '-5px';
                if (pos.includes('s')) handle.style.bottom = '-5px';
                if (pos.includes('e')) handle.style.right = '-5px';
                if (pos.includes('w')) handle.style.left = '-5px';
                if (pos === 'n' || pos === 's') handle.style.left = 'calc(50% - 5px)';
                if (pos === 'e' || pos === 'w') handle.style.top = 'calc(50% - 5px)';
                handle.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                    startResize(e, pos);
                });
                container.appendChild(handle);
            });
            document.body.appendChild(container);
            updateResizeContainer(element, container);
            return container;
        }
        function updateResizeContainer(element, container) {
            const rect = element.getBoundingClientRect();
            container.style.top = rect.top + 'px';
            container.style.left = rect.left + 'px';
            container.style.width = rect.width + 'px';
            container.style.height = rect.height + 'px';
        }
        function makeEditable(element) {
            if (!element) return;
            if (element.isContentEditable ||
                element.tagName === 'INPUT' ||
                element.tagName === 'TEXTAREA' ||
                element.tagName === 'SELECT') {
                return;
            }
            element.contentEditable = true;
            element.focus();
            updateColorInputStyle(element);
            element.addEventListener('blur', function onBlur() {
                element.contentEditable = false;
                element.removeEventListener('blur', onBlur);
                sendHeight();
                parent.postMessage({
                    action: 'editedContentReady',
                    blockId: '${id}',
                    editedContent: document.documentElement.outerHTML
                }, '*');
            }, { once: true });
        }
        function selectElement(e) {
            if (!editorActive) return;
            if (e.target.id === 'editor-controls' || e.target.closest('#editor-controls')) return;
            if (e.target.className.includes('resize-handle')) return;
            deselectElement();
            selectedElement = e.target;
            if (selectedElement === document.body || selectedElement === document.documentElement) {
                selectedElement = null;
                return;
            }
            selectedElement.dataset.originalOutline = selectedElement.style.outline;
            selectedElement.style.outline = '2px solid blue';
            const controls = document.getElementById('editor-controls') || createEditorControls();
            controls.style.display = 'block';
            updateColorInputStyle(selectedElement);
            createResizeHandles(selectedElement);
            selectedElement.addEventListener('dblclick', function onDblClick(evt) {
                evt.stopPropagation();
                makeEditable(selectedElement);
            }, { once: true });
            e.stopPropagation();
        }
        function deselectElement() {
            if (!selectedElement) return;
            selectedElement.style.outline = selectedElement.dataset.originalOutline || '';
            delete selectedElement.dataset.originalOutline;
            selectedElement.contentEditable = false;
            const container = document.querySelector('.resize-container');
            if (container) container.remove();
            parent.postMessage({
                action: 'editedContentReady',
                blockId: '${id}',
                editedContent: document.documentElement.outerHTML
            }, '*');
            selectedElement = null;
        }
        function rgbToHex(rgb) {
            if (!rgb) return '#000000';
            if (rgb.startsWith('#')) return rgb;
            if (rgb.startsWith('rgba')) {
                const parts = rgb.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
                if (!parts) return '#000000';
                const r = parseInt(parts[1]).toString(16).padStart(2, '0');
                const g = parseInt(parts[2]).toString(16).padStart(2, '0');
                const b = parseInt(parts[3]).toString(16).padStart(2, '0');
                return '#' + r + g + b;
            }
            const parts = rgb.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
            if (!parts) return '#000000';
            const r = parseInt(parts[1]).toString(16).padStart(2, '0');
            const g = parseInt(parts[2]).toString(16).padStart(2, '0');
            const b = parseInt(parts[3]).toString(16).padStart(2, '0');
            return '#' + r + g + b;
        }
        function startResize(e, position) {
            if (!selectedElement) return;
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            originalWidth = selectedElement.offsetWidth;
            originalHeight = selectedElement.offsetHeight;
            const resizePos = position;
            function doResize(e) {
                if (!isResizing) return;
                e.preventDefault();
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                let newWidth = originalWidth;
                let newHeight = originalHeight;
                if (resizePos.includes('e')) newWidth = originalWidth + deltaX;
                if (resizePos.includes('w')) newWidth = originalWidth - deltaX;
                if (resizePos.includes('s')) newHeight = originalHeight + deltaY;
                if (resizePos.includes('n')) newHeight = originalHeight - deltaY;
                if (newWidth > 10) selectedElement.style.width = newWidth + 'px';
                if (newHeight > 10) selectedElement.style.height = newHeight + 'px';
                const container = document.querySelector('.resize-container');
                updateResizeContainer(selectedElement, container);
                sendHeight();
            }
            function stopResize() {
                isResizing = false;
                document.removeEventListener('mousemove', doResize);
                document.removeEventListener('mouseup', stopResize);
                parent.postMessage({
                    action: 'editedContentReady',
                    blockId: '${id}',
                    editedContent: document.documentElement.outerHTML
                }, '*');
            }
            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        }
        function getEditedHTML() {
            return document.documentElement.outerHTML;
        }
        window.addEventListener('message', function(event) {
            if (event.data.action === 'getEditedContent') {
                parent.postMessage({
                    action: 'editedContentReady',
                    blockId: '${id}',
                    editedContent: getEditedHTML()
                }, '*');
            }
        });
        function initEditor() {
            document.addEventListener('click', selectElement);
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    deselectElement();
                    const controls = document.getElementById('editor-controls');
                    if (controls) controls.style.display = 'none';
                }
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEditor);
        } else {
            initEditor();
        }
    })();
</script>`;