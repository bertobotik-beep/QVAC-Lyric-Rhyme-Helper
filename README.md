# QVAC Lyric Rhyme Helper

Enter a line of lyrics and an on-device AI suggests several possible next lines that both rhyme with the end of your line and make sense thematically.

## Run

```
npm install
npm start
```

Then open http://localhost:29548

## QVAC SDK

Uses `@qvac/sdk` ^0.19.0 for fully local, on-device LLM inference. No cloud calls, no API key required.

## How it works

The server loads a small local model at startup with `loadModel`. Your line is sent to the model through `completion()` with a one-shot example of a numbered list of rhyming next-line options; a forgiving parser extracts the list and a deterministic rhyme check (matching trailing vowel/consonant sound) filters out any options that don't actually rhyme. `unloadModel` releases the model on shutdown.

## License

MIT
