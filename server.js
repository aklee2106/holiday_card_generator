const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public'));

// Initialize Hugging Face client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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

// Transform image using Hugging Face AI to add Christmas sweaters
async function transformImageWithAI(imageBuffer) {
    try {
        console.log('Transforming image with AI...');
        
        const prompt = "people wearing festive ugly christmas sweaters with red and green patterns, holiday theme";
        
        // Convert Buffer to Blob for Hugging Face API
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        
        // Try different available models
        const models = [
            "stabilityai/stable-diffusion-2-1",
            "runwayml/stable-diffusion-v1-5",
            "CompVis/stable-diffusion-v1-4"
        ];
        
        let result = null;
        let lastError = null;
        
        for (const model of models) {
            try {
                console.log(`Trying model: ${model}`);
                result = await hf.imageToImage({
                    model: model,
                    inputs: blob,
                    parameters: {
                        prompt: prompt,
                        negative_prompt: "blurry, distorted, low quality",
                        num_inference_steps: 20,
                        guidance_scale: 7.5,
                        strength: 0.7 // Keep 30% of original image
                    }
                });
                console.log(`✓ Success with model: ${model}`);
                break;
            } catch (modelError) {
                console.log(`✗ Model ${model} failed: ${modelError.message}`);
                lastError = modelError;
                continue;
            }
        }
        
        if (!result) {
            throw lastError || new Error('All models failed');
        }
        
        // Convert result to buffer
        const aiImageBuffer = Buffer.from(await result.arrayBuffer());
        console.log('✓ AI transformation complete');
        
        return aiImageBuffer;
    } catch (error) {
        console.error('Error with AI transformation:', error.message);
        throw error;
    }
}

// Create a Christmas sweater pattern SVG (fallback if AI fails)
function createSweaterPattern(width, height) {
    // Use pattern size that scales with image size
    const patternSize = Math.max(60, Math.min(width, height) / 10);
    const red = '#dc143c'; // Bright red
    const green = '#228b22'; // Forest green  
    const white = '#ffffff';
    
    // Draw pattern directly in SVG (more reliable than pattern definitions)
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Red background
    svg += `<rect width="${width}" height="${height}" fill="${red}"/>`;
    
    // Green horizontal stripes - make them thicker and more visible
    const stripeHeight = Math.max(12, patternSize * 0.25);
    const stripeSpacing = patternSize * 0.5;
    
    // Draw multiple stripes across the height
    for (let y = stripeSpacing; y < height; y += patternSize) {
        svg += `<rect x="0" y="${y}" width="${width}" height="${stripeHeight}" fill="${green}"/>`;
    }
    
    // White snowflake decorations - spaced evenly
    const decorationRadius = Math.max(4, patternSize * 0.2);
    for (let y = patternSize * 0.5; y < height; y += patternSize) {
        for (let x = patternSize * 0.5; x < width; x += patternSize) {
            svg += `<circle cx="${x}" cy="${y}" r="${decorationRadius}" fill="${white}"/>`;
        }
    }
    
    svg += `</svg>`;
    return svg;
}

// Detect skin tones and estimate person regions
async function detectPersonRegions(imageBuffer, width, height) {
    // Get raw pixel data
    const { data, info } = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const regions = [];
    const skinThreshold = {
        rMin: 95, rMax: 240,
        gMin: 40, gMax: 210,
        bMin: 20, bMax: 180
    };
    
    // Sample pixels to find skin-tone regions (faces, necks, arms)
    const sampleRate = 10; // Sample every 10th pixel for performance
    const skinPixels = [];
    
    for (let y = 0; y < info.height; y += sampleRate) {
        for (let x = 0; x < info.width; x += sampleRate) {
            const idx = (y * info.width + x) * info.channels;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Check if pixel matches skin tone
            if (r >= skinThreshold.rMin && r <= skinThreshold.rMax &&
                g >= skinThreshold.gMin && g <= skinThreshold.gMax &&
                b >= skinThreshold.bMin && b <= skinThreshold.bMax) {
                skinPixels.push({ x, y });
            }
        }
    }
    
    if (skinPixels.length === 0) {
        console.log('No skin tones detected, using center region as fallback');
        // Fallback: assume person is in center
        return [{
            x: Math.floor(width * 0.2),
            y: Math.floor(height * 0.1),
            width: Math.floor(width * 0.6),
            height: Math.floor(height * 0.7)
        }];
    }
    
    // Find bounding boxes for skin regions (likely faces/necks)
    const minX = Math.min(...skinPixels.map(p => p.x));
    const maxX = Math.max(...skinPixels.map(p => p.x));
    const minY = Math.min(...skinPixels.map(p => p.y));
    const maxY = Math.max(...skinPixels.map(p => p.y));
    
    // Estimate torso region based on detected face/neck area
    // Torso is typically below the face and wider
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const faceCenterX = (minX + maxX) / 2;
    const faceCenterY = (minY + maxY) / 2;
    
    // Estimate torso dimensions (typically 1.5-2x face width, 2-3x face height)
    const torsoWidth = Math.max(faceWidth * 1.8, width * 0.3);
    const torsoHeight = Math.max(faceHeight * 2.5, height * 0.4);
    const torsoX = Math.max(0, faceCenterX - torsoWidth / 2);
    const torsoY = Math.min(height - torsoHeight, faceCenterY + faceHeight * 0.5);
    
    regions.push({
        x: Math.floor(torsoX),
        y: Math.floor(torsoY),
        width: Math.floor(Math.min(torsoWidth, width - torsoX)),
        height: Math.floor(Math.min(torsoHeight, height - torsoY))
    });
    
    console.log(`Detected ${skinPixels.length} skin pixels, estimated torso region:`, regions[0]);
    return regions;
}

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
        
        // For Christmas theme, use AI to transform the image
        let processedImageBuffer = resizedImage;
        
        console.log('=== AI Transformation Check ===');
        console.log('Holiday type:', holidayType);
        console.log('API key exists:', !!process.env.HUGGINGFACE_API_KEY);
        console.log('API key value:', process.env.HUGGINGFACE_API_KEY ? process.env.HUGGINGFACE_API_KEY.substring(0, 10) + '...' : 'NOT SET');
        
        if (holidayType === 'christmas' && process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY !== 'your_api_key_here') {
            try {
                console.log('✓ Calling AI to add Christmas sweaters...');
                processedImageBuffer = await transformImageWithAI(resizedImage);
                console.log('✓ AI transformation successful!');
            } catch (aiError) {
                console.error('✗ AI transformation failed:', aiError.message);
                console.error('Full error:', aiError);
                // Fall back to original image if AI fails
            }
        } else if (holidayType === 'christmas') {
            console.log('✗ No valid Hugging Face API key found, skipping AI transformation');
            console.log('   Get your key at: https://huggingface.co/settings/tokens');
        }
        
        // Create sweater overlays for fallback (if needed)
        let sweaterOverlays = [];
        if (false && holidayType === 'christmas') { // Disabled overlay approach when using AI
            try {
                console.log('Creating sweater overlays for Christmas theme...');
                
                // Apply sweater to lower torso region (below faces, on clothing)
                // Position it lower to avoid covering faces
                const sweaterWidth = Math.floor(width * 0.6);
                const sweaterHeight = Math.floor(height * 0.35);
                const sweaterX = Math.floor((width - sweaterWidth) / 2);
                const sweaterY = Math.floor(height * 0.35); // Start lower to avoid faces
                
                const compositeTop = padding + sweaterY;
                const compositeLeft = padding + sweaterX;
                
                console.log(`Creating sweater: ${sweaterWidth}x${sweaterHeight} at (${compositeLeft}, ${compositeTop})`);
                
                // Create sweater pattern SVG
                const sweaterPattern = createSweaterPattern(sweaterWidth, sweaterHeight);
                
                // Convert SVG to PNG buffer
                const sweaterBuffer = await sharp(Buffer.from(sweaterPattern))
                    .png()
                    .toBuffer();
                
                // Verify dimensions
                const sweaterMetadata = await sharp(sweaterBuffer).metadata();
                console.log(`Sweater buffer created: ${sweaterMetadata.width}x${sweaterMetadata.height}`);
                
                // Resize to exact dimensions if needed
                let finalSweaterBuffer = sweaterBuffer;
                if (sweaterMetadata.width !== sweaterWidth || sweaterMetadata.height !== sweaterHeight) {
                    console.log(`Resizing sweater from ${sweaterMetadata.width}x${sweaterMetadata.height} to ${sweaterWidth}x${sweaterHeight}`);
                    finalSweaterBuffer = await sharp(sweaterBuffer)
                        .resize(sweaterWidth, sweaterHeight, { fit: 'fill' })
                        .png()
                        .toBuffer();
                }
                
                // Use 'overlay' blend mode with reduced opacity for a more natural clothing effect
                // This will make the pattern visible but blend with the underlying clothing
                sweaterOverlays.push({
                    input: finalSweaterBuffer,
                    top: compositeTop,
                    left: compositeLeft,
                    blend: 'overlay' // Overlay blend mode for better integration
                });
                
                console.log(`Successfully added sweater overlay to composite layers`);
                
                // Also try to detect and add more sweaters if people are detected
                try {
                    const personRegions = await detectPersonRegions(resizedImage, width, height);
                    console.log(`Also detected ${personRegions.length} person region(s) for additional sweaters`);
                    
                    for (const region of personRegions) {
                        const regionTop = padding + region.y;
                        const regionLeft = padding + region.x;
                        const regionWidth = Math.min(region.width, width - region.x, cardWidth - regionLeft);
                        const regionHeight = Math.min(region.height, height - region.y, cardHeight - regionTop);
                        
                        if (regionWidth > 0 && regionHeight > 0 && 
                            regionTop >= 0 && regionLeft >= 0 &&
                            regionTop + regionHeight <= cardHeight &&
                            regionLeft + regionWidth <= cardWidth) {
                            
                            const pattern = createSweaterPattern(regionWidth, regionHeight);
                            const buffer = await sharp(Buffer.from(pattern))
                                .resize(regionWidth, regionHeight, { fit: 'fill' })
                                .png()
                                .toBuffer();
                            
                            sweaterOverlays.push({
                                input: buffer,
                                top: regionTop,
                                left: regionLeft,
                                blend: 'overlay'
                            });
                            
                            console.log(`Added additional sweater at (${regionLeft}, ${regionTop})`);
                        }
                    }
                } catch (detectError) {
                    console.log('Person detection failed, using default sweater only:', detectError.message);
                }
                
            } catch (error) {
                console.error('Error creating sweater overlays:', error);
                console.error('Error stack:', error.stack);
            }
        }
        
        console.log(`Total sweater overlays to apply: ${sweaterOverlays.length}`);
        
        // Composite: background + processed image (AI-transformed or original) + sweater overlays + SVG overlay
        const compositeLayers = [
            {
                input: processedImageBuffer,
                top: padding,
                left: padding
            },
            ...sweaterOverlays,
            {
                input: svgOverlay,
                top: 0,
                left: 0,
                blend: 'over' // Ensure proper blending
            }
        ];
        
        const cardBuffer = await background
            .composite(compositeLayers)
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
