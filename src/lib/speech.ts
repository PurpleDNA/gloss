/**
 * Thin wrapper over the Web Speech API. Transcription happens through the
 * browser's own service, so there is no extra key, no extra cost, and no audio
 * passing through Gloss.
 */

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface SpeechEvent {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechErrorEvent {
  error: string;
}
interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognizer;

function ctor(): Ctor | undefined {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const speechSupported = (): boolean => Boolean(ctor());

export interface SpeechOptions {
  /** Fires repeatedly with the in-progress phrase. */
  onInterim(text: string): void;
  /** Fires once per settled phrase. */
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface SpeechSession {
  stop(): void;
}

const MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in Settings, then try again.",
  "service-not-allowed": "Microphone access was blocked. Allow it in Settings, then try again.",
  "audio-capture": "No microphone was found.",
  network: "Speech service unreachable — check your connection.",
};

export function startSpeech(options: SpeechOptions): SpeechSession | null {
  const Recognizer = ctor();
  if (!Recognizer) return null;

  const rec = new Recognizer();
  rec.lang = navigator.language || "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  // Chrome ends the session on its own after a pause. Restart until the user
  // actually stops, so a thinking pause does not cut the recording short.
  let stopped = false;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) options.onFinal(text);
      else interim += text;
    }
    if (interim) options.onInterim(interim);
  };

  rec.onerror = (e) => {
    // "no-speech" and "aborted" are ordinary, not worth interrupting the user.
    if (e.error === "no-speech" || e.error === "aborted") return;
    stopped = true;
    options.onError(MESSAGES[e.error] ?? `Speech recognition failed (${e.error}).`);
  };

  rec.onend = () => {
    if (stopped) return options.onEnd();
    try {
      rec.start();
    } catch {
      options.onEnd();
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop() {
      stopped = true;
      rec.stop();
    },
  };
}
