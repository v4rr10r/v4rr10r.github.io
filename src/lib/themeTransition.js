// Replace this file path with another local GIF when you have your own mask.
// Transparent GIFs work best because their alpha channel controls the reveal.
export const THEME_TRANSITION_GIF_PATH = "/assets/theme-transition.gif?v=transparent-mask";

// Keep this value in sync with the injected View Transition CSS.
export const THEME_TRANSITION_DURATION = 1750;
export const THEME_TRANSITION_EASING = "cubic-bezier(0.7, 0, 0.84, 0)";

export function preloadThemeTransitionGif() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (available) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(available);
    };

    image.onload = () =>
      finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false);
    image.src = THEME_TRANSITION_GIF_PATH;

    if (image.complete) {
      finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    }
  });
}


