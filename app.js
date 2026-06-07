const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const scaleSlider = document.getElementById('scaleSlider');
const rotationSlider = document.getElementById('rotationSlider');
const scaleValue = document.getElementById('scaleValue');
const rotationValue = document.getElementById('rotationValue');
const exportBtn = document.getElementById('exportBtn');
const copyBtn = document.getElementById('copyBtn');
const gridPreview = document.getElementById('gridPreview');
const tileCount = document.getElementById('tileCount');
const gridSize = document.getElementById('gridSize');
const blueprintSection = document.getElementById('blueprintSection');
const blueprintOutput = document.getElementById('blueprintOutput');
const status = document.getElementById('status');

let currentImageData = null;

uploadArea.addEventListener('click', () => imageInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        imageInput.files = e.dataTransfer.files;
        handleImageUpload();
    }
});

imageInput.addEventListener('change', handleImageUpload);

function handleImageUpload() {
    const file = imageInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            previewImg.src = e.target.result;
            imagePreview.style.display = 'block';
            processImage(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function processImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    showStatus('Image loaded! Adjust settings and preview.', 'info');
    updatePreview();
    exportBtn.disabled = false;
}

scaleSlider.addEventListener('input', () => {
    scaleValue.textContent = scaleSlider.value + 'px';
    updatePreview();
});

rotationSlider.addEventListener('input', () => {
    const rotations = ['0°', '90°', '180°', '270°'];
    rotationValue.textContent = rotations[rotationSlider.value];
    updatePreview();
});

function updatePreview() {
    if (!currentImageData) return;

    const scale = parseInt(scaleSlider.value);
    const rotation = parseInt(rotationSlider.value);

    const grid = generateGrid(currentImageData, scale, rotation);
    renderPreview(grid);

    tileCount.textContent = grid.tiles.length.toLocaleString();
    gridSize.textContent = grid.width + '×' + grid.height;
}

function generateGrid(imageData, pixelsPerTile, rotation) {
    const data = imageData.data;
    const imgWidth = imageData.width;
    const imgHeight = imageData.height;

    let minX = imgWidth, maxX = 0, minY = imgHeight, maxY = 0;
    let hasPixels = false;

    for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 127) {
            hasPixels = true;
            const pixelIndex = i / 4;
            const x = pixelIndex % imgWidth;
            const y = Math.floor(pixelIndex / imgWidth);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }

    if (!hasPixels) {
        return { tiles: [], width: 0, height: 0, grid: [] };
    }

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const gridWidth = Math.max(16, Math.ceil(cropWidth / pixelsPerTile));
    const gridHeight = Math.max(16, Math.ceil(cropHeight / pixelsPerTile));

    const binaryGrid = [];
    for (let gy = 0; gy < gridHeight; gy++) {
        for (let gx = 0; gx < gridWidth; gx++) {
            const pixelX = Math.floor(minX + gx * pixelsPerTile + pixelsPerTile / 2);
            const pixelY = Math.floor(minY + gy * pixelsPerTile + pixelsPerTile / 2);

            if (pixelX >= 0 && pixelX < imgWidth && pixelY >= 0 && pixelY < imgHeight) {
                const idx = (pixelY * imgWidth + pixelX) * 4 + 3;
                binaryGrid.push(data[idx] > 127 ? 1 : 0);
            } else {
                binaryGrid.push(0);
            }
        }
    }

    let rotatedGrid = binaryGrid;
    let rotatedWidth = gridWidth;
    let rotatedHeight = gridHeight;

    for (let r = 0; r < rotation; r++) {
        const newGrid = [];
        for (let x = 0; x < rotatedWidth; x++) {
            for (let y = rotatedHeight - 1; y >= 0; y--) {
                newGrid.push(rotatedGrid[y * rotatedWidth + x]);
            }
        }
        rotatedGrid = newGrid;
        [rotatedWidth, rotatedHeight] = [rotatedHeight, rotatedWidth];
    }

    const tiles = [];
    for (let y = 0; y < rotatedHeight; y++) {
        for (let x = 0; x < rotatedWidth; x++) {
            if (rotatedGrid[y * rotatedWidth + x]) {
                tiles.push({ x, y });
            }
        }
    }

    return { tiles, width: rotatedWidth, height: rotatedHeight, grid: rotatedGrid };
}

function renderPreview(gridData) {
    const { width, height, grid } = gridData;

    if (width === 0 || height === 0) {
        gridPreview.innerHTML = '<div style="color: #666; text-align: center;">No content detected</div>';
        return;
    }

    const tileSize = Math.max(1, Math.floor(200 / Math.max(width, height)));

    let html = `<div class="grid" style="grid-template-columns: repeat(${width}, ${tileSize}px);">`;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i]) {
            html += `<div class="grid-tile" style="width: ${tileSize}px; height: ${tileSize}px;"></div>`;
        } else {
            html += `<div style="width: ${tileSize}px; height: ${tileSize}px;"></div>`;
        }
    }
    html += '</div>';
    gridPreview.innerHTML = html;
}

exportBtn.addEventListener('click', () => {
    if (!currentImageData) return;

    showStatus('Generating blueprint...', 'info');

    try {
        const scale = parseInt(scaleSlider.value);
        const rotation = parseInt(rotationSlider.value);
        const gridData = generateGrid(currentImageData, scale, rotation);

        if (gridData.tiles.length === 0) {
            showStatus('Error: No tiles to generate', 'error');
            return;
        }

        const tiles = gridData.tiles.map((tile) => ({
            name: 'space-platform-foundation',
            position: { x: tile.x, y: tile.y }
        }));

        const blueprint = {
            blueprint: {
                tiles,
                entities: [],
                schedules: []
            }
        };

        const jsonStr = JSON.stringify(blueprint);
        const compressed = pako.deflate(jsonStr);
        const encoded = btoa(String.fromCharCode.apply(null, compressed));
        const blueprintString = '0' + encoded;

        blueprintOutput.value = blueprintString;
        blueprintSection.style.display = 'block';
        copyBtn.disabled = false;

        showStatus('Blueprint generated! ✓', 'success');
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
        console.error(error);
    }
});

copyBtn.addEventListener('click', () => {
    blueprintOutput.select();
    document.execCommand('copy');
    showStatus('Copied to clipboard! ✓', 'success');
});

function showStatus(message, type) {
    status.textContent = message;
    status.className = 'status ' + type;
    setTimeout(() => {
        if (type === 'success') status.style.display = 'none';
    }, 3000);
}