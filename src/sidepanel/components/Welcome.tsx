import { Logo, OpenRouterIcon } from "./Icons";

/**
 * The first thing a new user sees, and the only screen until Gloss can answer.
 * Two ways in: paste a key from any provider, or let OpenRouter mint one.
 */
export function Welcome(props: {
  connecting: boolean;
  error: string | null;
  onKey: () => void;
  onConnect: () => void;
}) {
  return (
    <div class="welcome">
      <Logo size={44} animated />

      <h1 class="hero">
        Understand <span>anything</span>
      </h1>
      <p class="welcome-sub">Highlight a word or a passage anywhere and ask.</p>

      <button class="primary wide" onClick={props.onKey}>
        Set API key
      </button>

      <div class="or">or</div>

      <button class="ghost wide with-icon" disabled={props.connecting} onClick={props.onConnect}>
        <OpenRouterIcon />
        {props.connecting ? "Connecting…" : "Connect OpenRouter"}
      </button>

      <p class="welcome-note">Gloss needs an AI provider first.</p>

      {props.error && <div class="error">{props.error}</div>}
    </div>
  );
}
