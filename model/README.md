# AI Tutor Model — Phi-3 mini

The AI tutor uses **Phi-3 mini 4K instruct** via WebLLM. The model runs entirely
in the browser — no server, no API key required.

## File size

The model is approximately **2 GB**. It is NOT committed to this git repository
(it would make cloning impractical). Instead, pre-load it onto the USB drive.

## How to pre-load onto a USB drive

1. On a computer with a fast internet connection, open the app in Chrome.
2. Open the AI tutor panel and click **Load Tutor**.
3. Wait for the download to complete (~2 GB — takes 5–20 minutes depending on speed).
4. Once loaded, the model is cached in the browser's Cache API.

**Alternatively**, if you want the model on the USB itself (so it works even
without any prior download):

1. Download the model files from [Hugging Face — Phi-3 mini](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-onnx-web).
2. Place the ONNX files in a folder named `phi-3-mini/` inside this `model/` directory.
3. The app will automatically detect and load from this local path.

## Graceful degradation

If the model is not available, the tutor panel shows **static hint cards** instead.
Students can still complete all lessons without the AI tutor.

## Model details

| Property | Value |
|---|---|
| Model | Phi-3 mini 4K instruct |
| Format | ONNX (WebGPU) |
| Size | ~2 GB |
| Runs in | Browser via WebLLM + WebGPU |
| Privacy | All inference on-device, nothing sent to any server |

## System requirements for AI tutor

- Chrome 113+ or Edge 113+ (WebGPU support required)
- 6+ GB RAM recommended
- Integrated GPU is fine — no dedicated GPU needed

Students on older devices will see the hint card fallback automatically.
