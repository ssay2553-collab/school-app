import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import SVGIcon from './SVGIcon';

const { width, height } = Dimensions.get('window');

const StationaryBackground = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.icon, { top: height * 0.1, left: width * 0.1, transform: [{ rotate: '15deg' }] }]}>
        <SVGIcon name="pencil-outline" size={80} color="rgba(0,0,0,0.05)" />
      </View>
      <View style={[styles.icon, { top: height * 0.3, right: width * 0.05, transform: [{ rotate: '-10deg' }] }]}>
        <SVGIcon name="book-outline" size={100} color="rgba(0,0,0,0.05)" />
      </View>
      <View style={[styles.icon, { bottom: height * 0.2, left: width * 0.05, transform: [{ rotate: '-20deg' }] }]}>
        <SVGIcon name="calculator-outline" size={90} color="rgba(0,0,0,0.05)" />
      </View>
       <View style={[styles.icon, { bottom: height * 0.4, right: width * 0.15, transform: [{ rotate: '25deg' }] }]}>
        <SVGIcon name="flask-outline" size={70} color="rgba(0,0,0,0.05)" />
      </View>
      <View style={[styles.icon, { top: height * 0.6, left: width * 0.2, transform: [{ rotate: '10deg' }] }]}>
        <SVGIcon name="color-palette-outline" size={85} color="rgba(0,0,0,0.05)" />
      </View>
      <View style={[styles.icon, { top: height * 0.8, right: width * 0.25, transform: [{ rotate: '-15deg' }] }]}>
        <SVGIcon name="school-outline" size={110} color="rgba(0,0,0,0.05)" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
  },
});

export default StationaryBackground;
