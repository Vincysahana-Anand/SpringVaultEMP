import React from 'react';
import { View, StyleSheet } from 'react-native';

export function EdgeIndicator() {
  return (
    <View style={styles.edgeIndicator}>
      <View style={styles.edgeBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  edgeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 10,
    justifyContent: 'center',
  },
  edgeBar: {
    width: 4,
    height: 40,
    backgroundColor: '#06b6d4',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
