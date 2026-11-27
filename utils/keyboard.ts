import { Keyboard } from 'react-native';

/**
 * Backdrop handler for sheets that contain text inputs. A tap outside the
 * sheet while the keyboard is up only puts the keyboard away; the next tap
 * closes the sheet. Without this, the only "tap outside" available on a
 * lifted sheet is the backdrop, and that threw the whole form away.
 */
export function closeOrDismissKeyboard(onClose: () => void) {
  return () => {
    if (Keyboard.isVisible()) Keyboard.dismiss();
    else onClose();
  };
}
