const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

// Create directories if they don't exist
const UPLOAD_FOLDER = 'uploads';
const OUTPUT_FOLDER = 'outputs';

async function ensureDirectories() {
    try {
        await fs.mkdir(UPLOAD_FOLDER, { recursive: true });
        await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

ensureDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_FOLDER);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `upload_${timestamp}.jpg`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function createSVGOverlay(cardWidth, cardHeight, holidayType) {
    const padding = 50;
    const borderWidth = 8;
    const innerBorder = 20;
    const cornerSize = 30;
    const borderColor = holidayType === 'christmas' ? '#8b4513' : '#4b0082';
    const cornerColor = holidayType === 'christmas' ? '#dc143c' : '#ff8c00';
    
    const greetings = {
        'christmas': 'Merry Christmas!',
        'newyear': 'Happy New Year!',
        'hanukkah': 'Happy Hanukkah!',
        'generic': 'Season\'s Greetings!'
    };
    const greeting = greetings[holidayType] || greetings['generic'];
    const year = new Date().getFullYear();
    
    const textColor = holidayType === 'christmas' ? '#8b4513' : '#4b0082';
    const textX = cardWidth / 2;
    const textY = cardHeight - 100;
    const yearY = cardHeight - 50;
    
    return `
    <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- Outer border -->
        <rect x="${borderWidth / 2}" y="${borderWidth / 2}" 
              width="${cardWidth - borderWidth}" height="${cardHeight - borderWidth}" 
              fill="none" stroke="${borderColor}" stroke-width="${borderWidth}"/>
        
        <!-- Inner decorative border -->
        <rect x="${borderWidth + innerBorder}" y="${borderWidth + innerBorder}" 
              width="${cardWidth - (borderWidth * 2) - (innerBorder * 2)}" 
              height="${cardHeight - (borderWidth * 2) - (innerBorder * 2)}" 
              fill="none" stroke="#c8c8c8" stroke-width="2"/>
        
        <!-- Corner decorations -->
        <circle cx="${borderWidth + 10 + cornerSize / 2}" 
                cy="${borderWidth + 10 + cornerSize / 2}" 
                r="${cornerSize / 2}" fill="${cornerColor}"/>
        <circle cx="${cardWidth - borderWidth - 10 - cornerSize / 2}" 
                cy="${borderWidth + 10 + cornerSize / 2}" 
                r="${cornerSize / 2}" fill="${cornerColor}"/>
        <circle cx="${borderWidth + 10 + cornerSize / 2}" 
                cy="${cardHeight - borderWidth - 10 - cornerSize / 2}" 
                r="${cornerSize / 2}" fill="${cornerColor}"/>
        <circle cx="${cardWidth - borderWidth - 10 - cornerSize / 2}" 
                cy="${cardHeight - borderWidth - 10 - cornerSize / 2}" 
                r="${cornerSize / 2}" fill="${cornerColor}"/>
        
        <!-- Text shadow -->
        <text x="${textX + 2}" y="${textY + 2}" 
              font-family="Arial, sans-serif" font-size="40" font-weight="bold" 
              fill="#646464" text-anchor="middle" dominant-baseline="middle">
            ${greeting}
        </text>
        
        <!-- Main greeting text -->
        <text x="${textX}" y="${textY}" 
              font-family="Arial, sans-serif" font-size="40" font-weight="bold" 
              fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
            ${greeting}
        </text>
        
        <!-- Year text -->
        <text x="${textX}" y="${yearY}" 
              font-family="Arial, sans-serif" font-size="24" 
              fill="#969696" text-anchor="middle" dominant-baseline="middle">
            ${year}
        </text>
    </svg>
    `;
}

async function createHolidayCard(imagePath, holidayType = 'christmas') {
    try {
        console.log('Starting card creation...');
        
        // Load and resize the image
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        
        console.log('Image metadata:', { width: metadata.width, height: metadata.height, format: metadata.format });
        
        // Resize image to a standard card size (maintaining aspect ratio)
        const maxWidth = 1200;
        const maxHeight = 1600;
        
        let width = metadata.width;
        let height = metadata.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        
        console.log('Resized dimensions:', { width, height });
        
        // Create card dimensions
        const padding = 50;
        const cardWidth = width + (padding * 2);
        const cardHeight = height + (padding * 2) + 150; // Extra space for text
        
        console.log('Card dimensions:', { cardWidth, cardHeight });
        
        // Create SVG overlay with borders, decorations, and text
        const svgString = createSVGOverlay(cardWidth, cardHeight, holidayType);
        const svgOverlay = Buffer.from(svgString);
        
        console.log('SVG overlay created, size:', svgOverlay.length);
        
        // Create the card by compositing:
        // 1. Create background
        // 2. Composite resized image on top
        // 3. Composite SVG overlay on top
        
        // First, create a background image
        const background = sharp({
            create: {
                width: cardWidth,
                height: cardHeight,
                channels: 3,
                background: { r: 255, g: 250, b: 240 } // cream color
            }
        });
        
        // Resize the uploaded image
        const resizedImage = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
        
        console.log('Resized image buffer size:', resizedImage.length);
        
        // Composite: background + image + SVG overlay
        const cardBuffer = await background
            .composite([
                {
                    input: resizedImage,
                    top: padding,
                    left: padding
                },
                {
                    input: svgOverlay,
                    top: 0,
                    left: 0,
                    blend: 'over' // Ensure proper blending
                }
            ])
            .jpeg({ quality: 95 })
            .toBuffer();
        
        console.log('Card buffer created, size:', cardBuffer.length);
        
        return cardBuffer;
    } catch (error) {
        console.error('Error in createHolidayCard:', error);
        throw error;
    }
}

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Generate holiday card endpoint
app.post('/api/generate-card', upload.single('image'), async (req, res) => {
    try {
        console.log('Received request to generate card');
        
        if (!req.file) {
            console.log('No file in request');
            return res.status(400).json({ error: 'No image file provided' });
        }
        
        const holidayType = req.body.holiday_type || 'christmas';
        const imagePath = req.file.path;
        
        console.log(`Processing image: ${imagePath}, holiday type: ${holidayType}`);
        
        // Generate holiday card
        const cardBuffer = await createHolidayCard(imagePath, holidayType);
        
        console.log(`Card generated successfully, size: ${cardBuffer.length} bytes`);
        
        // Clean up uploaded file
        await fs.unlink(imagePath).catch(() => {});
        
        // Send the card as response
        res.set('Content-Type', 'image/jpeg');
        res.send(cardBuffer);
        
    } catch (error) {
        console.error('Error generating card:', error);
        console.error('Error stack:', error.stack);
        
        // Clean up uploaded file on error
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ error: error.message || 'Failed to generate holiday card' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Holiday Card Generator server running on http://localhost:${PORT}`);
});
