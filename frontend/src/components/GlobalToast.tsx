import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Toast as InlineToast } from './Toast';
import { toastStore, type ToastMessage } from '../services/toastStore';

type ToastConfig = Record<string, (message: ToastMessage) => React.ReactNode>;

function GlobalToast({ config = {} }: { config?: ToastConfig }) {
  const message = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => null);
  useEffect(() => {
    if (!message || message.autoHide === false) return;
    const timer = setTimeout(() => toastStore.hide(message), message.visibilityTime ?? 4000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  const render = config[message.type ?? 'success'];
  const placement = message.position === 'bottom'
    ? { bottom: message.bottomOffset ?? 40 }
    : { top: message.topOffset ?? 40 };

  return <View pointerEvents="box-none" style={styles.overlay}>
    <View pointerEvents="box-none" accessibilityLiveRegion="polite" style={[styles.message, placement]}>
      {render ? render(message) : <InlineToast visible
        type={message.type} message={[message.text1, message.text2].filter(Boolean).join('\n')}
        onDismiss={() => toastStore.hide(message)} />}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10000, elevation: 10000 },
  message: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});

export default Object.assign(GlobalToast, { show: toastStore.show, hide: () => toastStore.hide() });
