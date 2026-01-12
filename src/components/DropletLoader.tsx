import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

interface Props {
  visible: boolean;
  size?: number;
}

const DropletLoader: React.FC<Props> = ({ visible, size = 150 }) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LottieView
        source={require('../assets/animations/WaterAnimation.json')}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});

export default DropletLoader;
