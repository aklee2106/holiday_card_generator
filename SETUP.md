# Hugging Face Setup Instructions

To use AI-powered Christmas sweater transformation, you need a Hugging Face API key.

## Steps:

### 1. Create a Hugging Face Account
- Go to https://huggingface.co/join
- Sign up for a free account

### 2. Generate an API Token
- Go to https://huggingface.co/settings/tokens
- Click "New token"
- Give it a name (e.g., "holiday-card-app")
- Select "Read" access
- Click "Generate"
- Copy the token (starts with `hf_...`)

### 3. Add API Key to Your App
- In the project folder, create a file named `.env`
- Add this line (replace with your actual token):
  ```
  HUGGINGFACE_API_KEY=hf_your_token_here
  ```

### 4. Restart the Server
- Stop the server (Ctrl+C)
- Run `npm start` again

## Usage Notes:

- **Free Tier**: Hugging Face offers free API usage with rate limits
- **Rate Limits**: You may hit rate limits during peak times  
- **Fallback**: If AI transformation fails, the app will use the original image

## Testing:

1. Start the server with your API key configured
2. Upload a photo with people
3. Select "Christmas" theme
4. Click "Generate Holiday Card"
5. Wait 10-30 seconds for AI processing

The AI will transform the people in your photo to wear Christmas sweaters!

