import { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ExerciseSectionProps {
  exercise: string;
  onResponse: (response: string) => void;
  initialResponse?: string;
}

export function ExerciseSection({
  exercise,
  onResponse,
  initialResponse = '',
}: ExerciseSectionProps) {
  const [response, setResponse] = useState(initialResponse);
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');

  const handleTextChange = (text: string) => {
    setResponse(text);
    onResponse(text);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.header}>
        Exercise
      </ThemedText>
      <ThemedText style={styles.exercise}>{exercise}</ThemedText>

      <ThemedText style={styles.label}>Your Response:</ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            color: textColor,
            backgroundColor,
            borderColor,
          },
        ]}
        value={response}
        onChangeText={handleTextChange}
        placeholder="Write your response here..."
        placeholderTextColor={textColor + '80'}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  header: {
    marginBottom: 12,
  },
  exercise: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
});
