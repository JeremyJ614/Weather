export function playIntro(
  host: HTMLElement,
  theme: { bg: string; metal: string; accent: string },
  options?: {
    onEnd?: () => void;
    variant?: "classic" | "storm";
    fast?: boolean;
  },
): () => void;
