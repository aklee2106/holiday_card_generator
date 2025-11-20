# Holiday Card Generator

A beautiful web application that transforms your photos into stunning holiday cards. Upload any image and watch it get transformed into a festive holiday card with decorative borders, corner accents, and holiday greetings.

## Features

- 🎨 **Beautiful UI**: Modern, responsive design with smooth animations
- 📸 **Easy Upload**: Drag & drop or click to upload your photos
- 🎄 **Multiple Themes**: Choose from Christmas, New Year, Hanukkah, or Generic holiday themes
- 🤖 **AI-Powered**: Uses Hugging Face AI to transform people into Christmas sweaters
- 🖼️ **Automatic Processing**: Images are automatically resized and enhanced
- 💾 **Download**: Save your generated holiday cards instantly

## Setup Instructions

### Prerequisites

- Node.js 14.x or higher
- npm (Node Package Manager)
- Hugging Face API key (free - see SETUP.md)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Hugging Face API (for AI Christmas sweaters):**
   - Create a free account at https://huggingface.co
   - Get your API token from https://huggingface.co/settings/tokens
   - Create a `.env` file in the project root:
     ```
     HUGGINGFACE_API_KEY=hf_your_token_here
     ```
   - See `SETUP.md` for detailed instructions

3. **Run the application:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Usage

1. Click or drag & drop an image onto the upload area
2. Select your preferred holiday theme
3. Click "Generate Holiday Card"
4. Download your beautiful holiday card!

## Technical Details

- **Backend**: Express.js (Node.js)
- **Image Processing**: Sharp (for image manipulation) + Canvas (for text and graphics)
- **File Upload**: Multer
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Features**:
  - Automatic image resizing while maintaining aspect ratio
  - Decorative borders and corner accents
  - Holiday-themed color schemes
  - Custom greeting text based on selected theme
  - High-quality JPEG output

## Project Structure

```
poof_app_v2/
├── server.js           # Express.js backend server
├── index.html          # Frontend HTML/CSS/JavaScript
├── package.json        # Node.js dependencies
├── README.md          # This file
├── uploads/           # Temporary uploaded images (auto-created)
└── outputs/           # Generated holiday cards (auto-created)
```

## Notes

- Uploaded images are automatically cleaned up after processing
- The app runs on port 3000 by default (configurable via PORT environment variable)
- Supported image formats: JPG, PNG, and other formats supported by Sharp
- Maximum file size: 10MB

Enjoy creating your holiday cards! 🎉

