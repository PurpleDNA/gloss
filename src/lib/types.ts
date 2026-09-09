/** What we lift off the page when the user triggers Gloss. */
export interface Capture {
  /** The literal highlighted text. */
  text: string;
  /** Surrounding prose, so a single highlighted word is disambiguated. */
  context: string;
  url: string;
  title: string;
  capturedAt: number;
}

export type CaptureError = "restricted" | "empty";

export interface PendingCapture {
  /** Fresh per trigger, so re-selecting identical text still re-renders. */
  id: string;
  tabId: number;
  capture: Capture | null;
  error?: CaptureError;
}

export interface PendingMessage {
  type: "gloss:pending";
  pending: PendingCapture;
}

export const PENDING_KEY = "gloss:pending";
