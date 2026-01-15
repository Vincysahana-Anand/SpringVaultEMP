import React, { useRef, ReactNode } from 'react';
import {
  View,
  Animated,
  PanResponder,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';
import { TabButton } from '../components/TabButton';

const DRAWER_WIDTH = 280;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DrawerLayoutProps {
  children: ReactNode; // Main content
  drawerContent: ReactNode; // Drawer menu items
  drawerFooter?: ReactNode; // Fixed bottom section (e.g., sign out)
  drawerLogo: ImageSourcePropType;
  drawerOpen: boolean;
  onDrawerToggle: () => void;
  tabButtons: Array<{
    icon: string;
    label: string;
    isActive: boolean;
  }>;
  onTabChange: (label: string) => void;
}

export function DrawerLayout({
  children,
  drawerContent,
  drawerFooter,
  drawerLogo,
  drawerOpen,
  onDrawerToggle,
  tabButtons,
  onTabChange,
}: DrawerLayoutProps) {
  const drawerAnimation = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  React.useEffect(() => {
    const toValue = drawerOpen ? 0 : -DRAWER_WIDTH;
    Animated.spring(drawerAnimation, {
      toValue,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [drawerOpen, drawerAnimation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        const { locationX } = evt.nativeEvent;
        return locationX < 20 && !drawerOpen;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= DRAWER_WIDTH) {
          drawerAnimation.setValue(-DRAWER_WIDTH + gestureState.dx);
        } else if (drawerOpen && gestureState.dx < 0) {
          const newValue = -gestureState.dx;
          if (newValue <= DRAWER_WIDTH) {
            drawerAnimation.setValue(-newValue);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > DRAWER_WIDTH / 2) {
          onDrawerToggle();
        } else if (drawerOpen && gestureState.dx < -DRAWER_WIDTH / 2) {
          onDrawerToggle();
        } else {
          Animated.spring(drawerAnimation, {
            toValue: drawerOpen ? 0 : -DRAWER_WIDTH,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View {...panResponder.panHandlers} style={{ flex: 1, backgroundColor: '#fafbfc' }}>
      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {children}
      </View>

      {/* Drawer */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: DRAWER_WIDTH,
            backgroundColor: '#fff',
            zIndex: 20,
            shadowColor: '#000',
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 16,
          },
          { transform: [{ translateX: drawerAnimation }] },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 28,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image source={drawerLogo} style={{ width: '100%', height: 96 }} resizeMode="contain" />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: 12, paddingBottom: 80 }}
          >
            {drawerContent}
          </ScrollView>

          {drawerFooter ? (
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                backgroundColor: '#fff',
              }}
            >
              {drawerFooter}
            </View>
          ) : null}
        </View>
      </Animated.View>

      {/* Overlay */}
      {drawerOpen && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 15,
          }}
          activeOpacity={1}
          onPress={onDrawerToggle}
        />
      )}

      {/* Tab Bar */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingVertical: 8,
          paddingHorizontal: 8,
          gap: 4,
        }}
      >
        {tabButtons.map((tab) => (
          <TabButton
            key={tab.label}
            icon={tab.icon as any}
            label={tab.label}
            isActive={tab.isActive}
            onPress={() => onTabChange(tab.label)}
          />
        ))}
      </View>
    </View>
  );
}
