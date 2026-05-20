# NeuralPocket

**NeuralPocket** is a private, browser-based AI assistant that runs large language models directly on the user's device.

Built with **React**, **TypeScript**, **Vite**, and **MediaPipe Tasks GenAI**, the app provides a clean chat experience with support for **text**, **images**, and **audio inputs** while keeping inference local whenever the selected model and browser environment support it.

## Highlights

- **On-device AI inference** powered by Gemma-compatible models
- **Multimodal chat** with text, image, and audio inputs
- **Per-chat custom system prompts** for specialized assistant behavior
- **Multiple model options** with built-in switching support
- **Model caching in the browser** using OPFS for faster repeat launches
- **Streaming responses** for a more natural chat experience
- **Local chat history** stored in `localStorage`
- **Dark and light themes**
- **Mobile-friendly UI** inspired by modern messenger apps

## Demo Experience

NeuralPocket is designed to feel like a compact personal AI app:

1. The user opens the app and sees a short onboarding screen.
2. A model is selected and initialized in the browser.
3. The app downloads the model once and stores it locally.
4. The user can then chat, attach an image, or attach an audio file.
5. The selected Gemma-compatible model generates responses directly on-device.

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS v4 + custom CSS variables / component styling
- **AI Runtime:** `@mediapipe/tasks-genai`
- **Inference Execution:** Web Worker + WebGPU
- **Persistence:**
  - `localStorage` for chat history, theme, and onboarding state
  - OPFS (Origin Private File System) for downloaded model files

## Core Features

### 1. Local-first AI chat
The main chat interface supports conversational interaction with a Gemma-compatible LLM running in the browser.

### 2. Image input
Users can attach an image and ask the model to describe, analyze, or extract information from it.

### 3. Audio input
Users can upload an audio file, which is decoded in the browser and sent to the model as 16 kHz mono PCM for speech understanding or transcription-style tasks.

### 4. Model selection
The app includes a model picker with predefined options and also allows loading a **custom compatible model URL**.

### 5. Per-chat system prompt editing
Each conversation can have its own custom system prompt, making the app suitable for different assistant personas or workflows.

### 6. Browser-side model caching
Downloaded models are stored locally so returning users do not need to download the same model every time.

## Included Model Presets

The project currently defines three model entries:

- **Gemma 4 E2B** — balanced size and performance
- **Gemma 4 E4B** — larger reasoning-focused variant
- **Gemma 3 Multimodal** — intended for text + image + audio workflows

## Project Structure

```text
src/
  components/
    CameraCapture.tsx
    ChatInterface.tsx
    ModelDownloader.tsx
    OnboardingScreen.tsx
  hooks/
    useGemmaModel.ts
  workers/
    ai-worker.ts
  constants.ts
  App.tsx
  main.tsx
  index.css
public/
  favicon.svg
  icons.svg
  manifest.json
```

### Important files

- `src/App.tsx` — top-level app state and screen flow
- `src/components/OnboardingScreen.tsx` — first-run introduction
- `src/components/ModelDownloader.tsx` — model selection, download, and initialization UI
- `src/components/ChatInterface.tsx` — main chat UI, attachments, chat history, and prompt editor
- `src/hooks/useGemmaModel.ts` — worker communication and model lifecycle management
- `src/workers/ai-worker.ts` — Web Worker that loads MediaPipe runtime, caches models, and performs inference
- `vite.config.ts` — Vite configuration, worker output format, and COOP/COEP headers needed for browser AI runtime scenarios

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the development server

```bash
npm run dev
```

### 3. Build for production

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` — start the Vite development server
- `npm run build` — run TypeScript build and create a production bundle
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

## Browser Requirements

Because NeuralPocket relies on **WebGPU** and browser-side model execution, users should use a modern Chromium-based browser such as:

- Google Chrome
- Microsoft Edge
- Other recent Chromium browsers with WebGPU enabled

Recommended environment:

- Hardware acceleration enabled
- Updated GPU drivers
- Enough GPU memory for the selected model

If WebGPU is unavailable, model initialization will fail and the app shows guidance for enabling the necessary browser settings.

## Privacy and Offline Notes

NeuralPocket is clearly built with a **privacy-first local inference architecture**:

- model execution happens in the browser
- chats are stored locally
- downloaded models are cached locally
- there is no backend server in this repository handling user prompts

However, there are a few practical caveats:

1. **The first model download requires network access** unless the model is already cached.
2. **The MediaPipe GenAI runtime is imported from jsDelivr** in the worker.
3. **Google Fonts are loaded from Google Fonts** in `index.html`.

So, in its current form, the project is **local-first and privacy-oriented**, but not yet a fully self-contained offline package out of the box. If full offline support is a goal, you should self-host the runtime assets, fonts, and model files.

## How Model Loading Works

1. The selected model URL is stored in `localStorage`.
2. The worker checks whether the model already exists in OPFS.
3. If not cached, the model is downloaded and written into OPFS.
4. The worker creates a blob URL from the cached file.
5. MediaPipe `LlmInference` is initialized with that local blob URL.
6. Prompts are sent to the worker, and partial output is streamed back to the UI.

This architecture keeps the UI responsive and avoids blocking the main thread during AI inference.

## Multimodal Flow

### Image handling
- Images are read in the browser as Base64 data URLs
- The worker converts them to `ImageBitmap`
- The image is attached to the model prompt when supported

### Audio handling
- Audio files are decoded via the browser `AudioContext`
- Audio is resampled to **16 kHz mono Float32 PCM**
- The PCM data is transferred to the worker using transferable buffers

## Strengths of the Current Implementation

- Clean and polished UI
- Good separation between UI state and inference logic
- Web Worker architecture for responsiveness
- Browser caching strategy for large model files
- Sensible error handling around WebGPU and unsupported model capabilities
- Easy-to-extend model configuration
- Custom prompt support per conversation

## Known Limitations

- No backend fallback for browsers without WebGPU
- No authentication or user accounts
- Chat history is only local to the current browser
- The markdown rendering is intentionally lightweight and not a full Markdown parser
- The multimodal preset depends on a model file that is not bundled in this repository
- Full offline mode requires self-hosting external runtime/font assets

## Troubleshooting

### WebGPU not available
If the app fails during initialization:

- enable hardware acceleration in the browser
- update your GPU drivers
- ensure your browser supports WebGPU
- try Chrome or Edge latest stable version

### Multimodal requests fail
If image or audio prompts produce an error, the selected model may not support those input types. Switch to a multimodal-compatible model.

### Custom model URL does not work
Make sure the URL points directly to a valid compatible model file such as `.task`, `.litertlm`, or another supported asset expected by your MediaPipe runtime setup.

## Suggested Next Improvements

If you continue developing this project, good next steps would be:

- add true PWA/offline packaging
- self-host all runtime dependencies
- provide a built-in settings screen for model management
- support microphone recording directly inside the UI
- improve markdown rendering with code blocks and tables
- add export/import for local chat sessions
- include usage diagnostics for GPU memory and model compatibility

## Why this project is interesting

NeuralPocket is not just another chat UI. It is a strong prototype for a **private edge AI assistant** that runs directly in the browser and demonstrates how modern web apps can combine:

- local inference
- multimodal input
- responsive UI
- browser storage APIs
- hardware-accelerated execution

That makes it a solid foundation for privacy-focused AI products, offline assistants, and mobile-first edge AI experiences.

## License

MIT
