import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation } from '../theme/theme';
import { MessagePayload, MessageType, registerMessageHandler } from './messageBus';

type InternalMessage = Required<Pick<MessagePayload, 'type' | 'message'>> &
  Pick<MessagePayload, 'title' | 'durationMs'>;

const DEFAULT_DURATION_MS = 5000;

function getVisuals(type: MessageType) {
  switch (type) {
    case 'success':
      return {
        icon: 'check-circle-outline' as const,
        iconColor: colors.success[700],
        bg: colors.success[50],
        border: colors.success[200],
        title: 'Success',
      };
    case 'error':
      return {
        icon: 'alert-circle-outline' as const,
        iconColor: colors.danger[600],
        bg: colors.danger[50],
        border: colors.danger[200],
        title: 'Error',
      };
    case 'warning':
      return {
        icon: 'alert-outline' as const,
        iconColor: colors.warning[600],
        bg: colors.warning[50],
        border: colors.warning[200],
        title: 'Notice',
      };
    case 'info':
    default:
      return {
        icon: 'information-outline' as const,
        iconColor: colors.primary[600],
        bg: colors.primary[50],
        border: colors.primary[200],
        title: 'Info',
      };
  }
}

export function GlobalMessageProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<InternalMessage | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const hide = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -24, duration: 160, useNativeDriver: true }),
    ]).start(() => setMsg(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (payload: MessagePayload) => {
      clearTimer();
      const next: InternalMessage = {
        type: payload.type,
        message: payload.message,
        title: payload.title,
        durationMs: payload.durationMs,
      };
      setMsg(next);

      // Ensure it always animates in even if already visible
      translateY.setValue(-24);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
      ]).start();

      const rawDuration =
        typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)
          ? payload.durationMs
          : undefined;

      const durationMs = rawDuration && rawDuration > 0 ? rawDuration : DEFAULT_DURATION_MS;
      hideTimer.current = setTimeout(hide, durationMs);
    },
    [hide, opacity, translateY]
  );

  useEffect(() => {
    registerMessageHandler(show);
    return () => {
      registerMessageHandler(null);
      clearTimer();
    };
  }, [show]);

  const visuals = useMemo(() => (msg ? getVisuals(msg.type) : null), [msg]);

  return (
    <View style={styles.root}>
      {children}

      {msg && visuals ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: Math.max(10, insets.top + 8),
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.banner, { backgroundColor: visuals.bg, borderColor: visuals.border }]}>
            <MaterialCommunityIcons name={visuals.icon} size={22} color={visuals.iconColor} />

            <View style={styles.textBlock}>
              <Text style={styles.title}>{msg.title || visuals.title}</Text>
              <Text style={styles.message} numberOfLines={3}>
                {msg.message}
              </Text>
            </View>

            <TouchableOpacity onPress={hide} hitSlop={10} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={18} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    ...elevation.md,
  },
  textBlock: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.gray[900],
  },
  message: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray[700],
  },
  closeBtn: {
    paddingTop: 2,
  },
});
