import { StyleSheet, Text } from 'react-native';

export default function ActionLabel({ children, style }) {
  return <Text textBreakStrategy="simple" style={[style, styles.label]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    alignSelf: 'stretch',
    textAlign: 'center',
    // Android font scaling can round the measured width down at the last glyph.
    paddingHorizontal: 3,
  },
});
