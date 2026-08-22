import React, { memo } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../SVGIcon";
import { COLORS } from "../../../../constants/theme";
import MathCanvas from "../../../MathCanvas";

const MathematicsFields = memo(({
  q,
  qIndex,
  updateMathematicsQuestion,
  updateOption,
  addOption,
  styles
}: any) => {

  return (
    <Animatable.View animation="fadeIn" duration={400}>
      <MathCanvas
        visualGroup={q.visualGroup || []}
        onChange={(newGroup) => updateMathematicsQuestion(qIndex, { visualGroup: newGroup })}
        label="Question Builder (Canvas)"
      />

      <Text style={styles.inputLabel}>Instructions (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Solve for x or Simplify the expression"
        value={q.text}
        onChangeText={(t) => updateMathematicsQuestion(qIndex, { text: t })}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' }}>
        <TouchableOpacity
          onPress={() => updateMathematicsQuestion(qIndex, { showWorking: !q.showWorking })}
          style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: q.showWorking ? COLORS.primary : 'transparent' }}
        >
          {q.showWorking && <SVGIcon name="checkmark" size={16} color="#FFF" />}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0369A1' }}>Require Students to Show Working</Text>
          <Text style={{ fontSize: 11, color: '#0EA5E9' }}>Students will see an additional area to type their step-by-step solution.</Text>
        </View>
      </View>

      {/* Multiple Choice Options */}
      <View style={[styles.optionsContainer, { marginTop: 20 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <Text style={styles.inputLabel}>Options (Multiple Choice - Optional)</Text>
          {q.options && q.options.length > 0 && (
            <TouchableOpacity onPress={() => updateMathematicsQuestion(qIndex, { options: [] })}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10, fontStyle: 'italic' }}>
          Leave empty if you want students to type their own answers.
        </Text>

        {q.options?.map((opt: string, oIndex: number) => (
          <View key={oIndex} style={styles.optionRow}>
            <View style={styles.bullet} />
            <TextInput
              style={styles.optionInput}
              placeholder={`Option ${oIndex + 1}`}
              value={opt}
              onChangeText={(t) => updateOption(qIndex, oIndex, t)}
            />
            <TouchableOpacity
              onPress={() => {
                const newOptions = q.options.filter((_: any, i: number) => i !== oIndex);
                updateMathematicsQuestion(qIndex, { options: newOptions });
              }}
              style={{ padding: 5 }}
            >
              <SVGIcon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => addOption(qIndex)}
          style={[styles.addOptionBtn, {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: COLORS.secondary + '10',
            padding: 8,
            borderRadius: 8,
            alignSelf: 'flex-start'
          }]}
        >
          <SVGIcon name="add-circle" size={16} color={COLORS.secondary} />
          <Text style={styles.addOptionText}>Add Choice</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );
});

export default MathematicsFields;
