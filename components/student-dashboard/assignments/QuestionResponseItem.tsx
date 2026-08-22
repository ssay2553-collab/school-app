import React, { memo } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { COLORS } from "../../../constants/theme";
import SVGIcon from "../../SVGIcon";
import { Question, VisualItem } from "../../../types/assignments";
import MathCanvas from "../../MathCanvas";

interface QuestionResponseItemProps {
  q: Question;
  qIdx: number;
  type: string;
  answer: any;
  setAnswer: (val: any) => void;
}

const QuestionResponseItem = memo(({
  q,
  qIdx,
  type,
  answer,
  setAnswer
}: QuestionResponseItemProps) => {
  const isPreschool = type === "preschool";
  const isMathematics = type === "mathematics";
  const isPreschoolOptions = isPreschool && ![
    "simple_addition", "fill_missing"
  ].includes(q.type || "");

  const hasOptions = q.options && q.options.filter(opt => opt.trim() !== "").length > 0;
  const showOptions = type === "mcq" || isPreschoolOptions || (isMathematics && hasOptions);

  // Handle rich math answers (VisualItem[]) vs standard strings
  const mathValue = (typeof answer === 'object' && !Array.isArray(answer))
    ? (answer?.answer || [])
    : (Array.isArray(answer) ? answer : (answer ? [{ type: 'text', value: String(answer), id: 'init' }] : []));

  const workingValue = (typeof answer === 'object' && !Array.isArray(answer))
    ? (answer?.working || [])
    : [];

  const handleAnswerChange = (val: any) => {
    const newVal = typeof val === 'string' ? [{ type: 'text', value: val, id: 'opt_' + Math.random() }] : val;
    if (q.showWorking && isMathematics) {
      setAnswer({ answer: newVal, working: workingValue });
    } else {
      setAnswer(newVal);
    }
  };

  const handleWorkingChange = (val: VisualItem[]) => {
    setAnswer({ answer: mathValue, working: val });
  };

  // Helper to check if an option is selected for math (which uses VisualItem[])
  const isOptionSelected = (opt: string) => {
    if (isMathematics) {
      return Array.isArray(mathValue) && mathValue.length === 1 && mathValue[0].type === 'text' && mathValue[0].value === opt;
    }
    return answer === opt;
  };

  // Worksheet style layout for specific preschool types
  const isWorksheetRow = isPreschool && showOptions && [
    "count_objects", "identify_shape", "simple_addition", "odd_one_out", "true_false", "identify_letter", "match_case", "beginning_letter"
  ].includes(q.type || "");

  if (isWorksheetRow) {
    return (
      <View style={styles.worksheetRow}>
        <View style={styles.worksheetLeft}>
          <View style={styles.worksheetVisualBox}>
            {q.visualGroup && q.visualGroup.length > 0 ? (
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  {q.visualGroup.map((item: any, gIdx: number) => {
                    const iconSize = isPreschool ? (item.size === 'large' ? 60 : item.size === 'small' ? 25 : 45) : (item.size === 'large' ? 45 : item.size === 'small' ? 20 : 30);
                    const fontSize = isPreschool ? (item.size === 'large' ? 40 : item.size === 'small' ? 20 : 32) : (item.size === 'large' ? 32 : item.size === 'small' ? 16 : 24);

                    return (
                      <React.Fragment key={gIdx}>
                        {item.isNewLine && <View style={{ width: '100%', height: 0 }} />}
                        {item.type === 'icon' ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                            {[...Array(item.count || 1)].map((_, i) => (
                              <SVGIcon key={`${gIdx}-${i}`} name={item.value} size={iconSize} color={COLORS.secondary} />
                            ))}
                          </View>
                        ) : (
                          <Text style={{ fontSize: fontSize, fontWeight: '800', color: '#1E293B' }}>{item.value}</Text>
                        )}
                      </React.Fragment>
                    );
                  })}
               </View>
            ) : (
              <Text style={[styles.questionText, isPreschool && { fontSize: 24, lineHeight: 32, marginBottom: 0 }]}>{qIdx + 1}. {q.text}</Text>
            )}
          </View>
        </View>

        <View style={styles.worksheetRight}>
          <View style={styles.worksheetOptionsRow}>
            {q.options?.map((opt, oIdx) => {
              const isSelected = isOptionSelected(opt);
              return (
                <TouchableOpacity
                  key={oIdx}
                  style={[styles.worksheetOption, isSelected && styles.worksheetOptionSelected, isPreschool && { minWidth: 50, height: 50 }]}
                  onPress={() => handleAnswerChange(opt)}
                >
                  <SVGIcon name={opt} size={isPreschool ? 36 : 28} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.questionBox}>
      {q.type && (
        <View style={styles.preschoolBadge}>
          <Text style={styles.preschoolBadgeText}>{q.type.replace('_', ' ').toUpperCase()}</Text>
        </View>
      )}

      <Text style={[
        styles.questionText,
        isPreschool ? { fontSize: 26, lineHeight: 34, fontWeight: '800' } :
        isMathematics ? { fontSize: 18, lineHeight: 26, fontWeight: '600' } :
        { fontSize: 15, lineHeight: 22, fontWeight: '600' }
      ]}>{qIdx + 1}. {q.text}</Text>

      {q.visualGroup && q.visualGroup.length > 0 && (
        <View style={styles.visualContainer}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 15 }}>
            {q.visualGroup.map((item: any, gIdx: number) => {
              const baseSize = isPreschool ? 1.5 : 1;
              const iconSize = (item.size === 'large' ? 60 : item.size === 'small' ? 30 : 45) * baseSize;
              const containerSize = iconSize + 10;

              let textFontSize = (item.size === 'large' ? 32 : item.size === 'small' ? 16 : 24) * baseSize;
              if (!isPreschool && isMathematics && (item.size === 'medium' || !item.size)) {
                textFontSize = 18;
              }

              const mathFontWeight = isPreschool ? '800' : '600';

              return (
                <React.Fragment key={gIdx}>
                  {item.isNewLine && <View style={{ width: '100%', height: 0 }} />}
                  {item.type === 'icon' ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
                      {[...Array(item.count || 1)].map((_, i) => (
                        <View key={`${gIdx}-${i}`} style={{ width: containerSize, height: containerSize, alignItems: 'center', justifyContent: 'center' }}>
                          <SVGIcon name={item.value} size={iconSize} color={COLORS.secondary} />
                        </View>
                      ))}
                    </View>
                  ) : item.type === 'fraction' ? (
                    <View style={{ alignItems: 'center', minWidth: 20, marginHorizontal: 2 }}>
                      <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#000' }}>
                        {item.numerator?.map((n: any) => n.value).join('') || '1'}
                      </Text>
                      <View style={{ height: 1.5, backgroundColor: '#000', width: '100%' }} />
                      <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#000' }}>
                        {item.denominator?.map((d: any) => d.value).join('') || '2'}
                      </Text>
                    </View>
                  ) : item.type === 'mixed_fraction' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: 2 }}>
                      <Text style={{ fontSize: textFontSize * 1.1, fontWeight: mathFontWeight, color: '#000' }}>{item.whole || '2'}</Text>
                      <View style={{ alignItems: 'center', minWidth: 18 }}>
                        <Text style={{ fontSize: textFontSize * 0.8, fontWeight: mathFontWeight, color: '#000' }}>
                          {item.numerator?.map((n: any) => n.value).join('') || '1'}
                        </Text>
                        <View style={{ height: 1.5, backgroundColor: '#000', width: '100%' }} />
                        <Text style={{ fontSize: textFontSize * 0.8, fontWeight: mathFontWeight, color: '#000' }}>
                          {item.denominator?.map((d: any) => d.value).join('') || '2'}
                        </Text>
                      </View>
                    </View>
                  ) : item.type === 'sqrt' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
                      <SVGIcon name="sqrt" size={iconSize * 0.8} color="#000" />
                      <View style={{ borderTopWidth: 1.5, borderTopColor: '#000', paddingTop: 2, minWidth: 16, marginLeft: -2 }}>
                        <Text style={{
                          fontSize: textFontSize,
                          fontWeight: mathFontWeight,
                          color: '#000',
                          fontStyle: /[a-zA-Z]/.test(item.content?.map((c: any) => c.value).join('') || '') ? 'italic' : 'normal',
                          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        }}>{item.content?.map((c: any) => c.value).join('') || 'x'}</Text>
                      </View>
                    </View>
                  ) : item.type === 'bracket' ? (
                    <Text style={{
                      fontSize: textFontSize * 1.5,
                      fontWeight: isPreschool ? '800' : '300',
                      color: '#000',
                      marginHorizontal: 1,
                      marginTop: -2
                    }}>{item.value || (item.bracketType === 'round' ? '(' : item.bracketType === 'square' ? '[' : '{')}</Text>
                  ) : item.type === 'mapping' ? (
                    <View style={{ alignItems: 'center', minWidth: 20, marginHorizontal: 4 }}>
                      <Text style={{
                        fontSize: textFontSize,
                        fontWeight: mathFontWeight,
                        color: '#000',
                        fontStyle: /[a-zA-Z]/.test(item.numerator?.map((n: any) => n.value).join('') || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}>{item.numerator?.map((n: any) => n.value).join('') || 'x'}</Text>
                      <Text style={{ fontSize: textFontSize * 0.9, fontWeight: '900', color: '#000', marginTop: -2, marginBottom: -2 }}>↓</Text>
                      <Text style={{
                        fontSize: textFontSize,
                        fontWeight: mathFontWeight,
                        color: '#000',
                        fontStyle: /[a-zA-Z]/.test(item.denominator?.map((d: any) => d.value).join('') || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}>{item.denominator?.map((d: any) => d.value).join('') || 'y'}</Text>
                    </View>
                  ) : item.type === 'vector' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
                      <Text style={{ fontSize: textFontSize * 1.5, fontWeight: isPreschool ? '800' : '300', color: '#000', marginTop: -2 }}>(</Text>
                      <View style={{ alignItems: 'center', minWidth: 16, marginHorizontal: 1 }}>
                        <Text style={{
                          fontSize: textFontSize * 0.9,
                          fontWeight: mathFontWeight,
                          color: '#000',
                          fontStyle: /[a-zA-Z]/.test(item.numerator?.map((n: any) => n.value).join('') || '') ? 'italic' : 'normal',
                          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        }}>{item.numerator?.map((n: any) => n.value).join('') || 'x'}</Text>
                        <Text style={{
                          fontSize: textFontSize * 0.9,
                          fontWeight: mathFontWeight,
                          color: '#000',
                          fontStyle: /[a-zA-Z]/.test(item.denominator?.map((d: any) => d.value).join('') || '') ? 'italic' : 'normal',
                          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        }}>{item.denominator?.map((d: any) => d.value).join('') || 'y'}</Text>
                      </View>
                      <Text style={{ fontSize: textFontSize * 1.5, fontWeight: isPreschool ? '800' : '300', color: '#000', marginTop: -2 }}>)</Text>
                    </View>
                  ) : item.type === 'matrix' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
                      <Text style={{ fontSize: textFontSize * 1.8, fontWeight: isPreschool ? '800' : '300', color: '#000', marginTop: -4 }}>(</Text>
                      <View style={{ paddingHorizontal: 2, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Text style={{ fontSize: textFontSize * 0.9, fontWeight: mathFontWeight, color: '#000' }}>{item.cells?.[0]?.value || 'a'}</Text>
                          <Text style={{ fontSize: textFontSize * 0.9, fontWeight: mathFontWeight, color: '#000' }}>{item.cells?.[1]?.value || 'b'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Text style={{ fontSize: textFontSize * 0.9, fontWeight: mathFontWeight, color: '#000' }}>{item.cells?.[2]?.value || 'c'}</Text>
                          <Text style={{ fontSize: textFontSize * 0.9, fontWeight: mathFontWeight, color: '#000' }}>{item.cells?.[3]?.value || 'd'}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: textFontSize * 1.8, fontWeight: isPreschool ? '800' : '300', color: '#000', marginTop: -4 }}>)</Text>
                    </View>
                  ) : item.type === 'bar' ? (
                    <View style={{ alignItems: 'center', marginHorizontal: 2 }}>
                      <View style={{ height: 1.5, backgroundColor: '#000', width: '100%', marginBottom: 1 }} />
                      <Text style={{
                        fontSize: textFontSize,
                        fontWeight: mathFontWeight,
                        color: '#000',
                        fontStyle: /[a-zA-Z]/.test(item.content?.map((c: any) => c.value).join('') || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}>{item.content?.map((c: any) => c.value).join('') || 'x'}</Text>
                    </View>
                  ) : item.type === 'superscript' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 1 }}>
                      <Text style={{
                        fontSize: textFontSize,
                        fontWeight: mathFontWeight,
                        fontStyle: /[a-zA-Z]/.test(item.base || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        color: '#000'
                      }}>{item.base || 'x'}</Text>
                      <Text style={{ fontSize: textFontSize * 0.7, fontWeight: '700', color: '#000', marginTop: -4 }}>{item.value || '2'}</Text>
                    </View>
                  ) : item.type === 'subscript' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 1 }}>
                      <Text style={{
                        fontSize: textFontSize,
                        fontWeight: mathFontWeight,
                        fontStyle: /[a-zA-Z]/.test(item.base || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        color: '#000'
                      }}>{item.base || 'x'}</Text>
                      <Text style={{ fontSize: textFontSize * 0.7, fontWeight: '700', color: '#000', marginBottom: -3 }}>{item.value || '2'}</Text>
                    </View>
                  ) : item.type === 'variable' ? (
                    <Text style={{
                      fontSize: textFontSize,
                      fontWeight: mathFontWeight,
                      fontStyle: 'italic',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      color: '#000'
                    }}>{item.value}</Text>
                  ) : item.type === 'operator' ? (
                    <Text style={{
                      fontSize: textFontSize,
                      fontWeight: mathFontWeight,
                      color: '#000',
                      marginHorizontal: 4
                    }}>{item.value}</Text>
                  ) : item.type === 'number' ? (
                    <Text style={{
                      fontSize: textFontSize,
                      fontWeight: mathFontWeight,
                      color: '#000'
                    }}>{item.value}</Text>
                  ) : (
                    <Text style={{
                      fontSize: isPreschool ? textFontSize * 0.8 : textFontSize,
                      fontWeight: isPreschool ? '800' : '600',
                      color: isPreschool ? '#334155' : '#000',
                      lineHeight: textFontSize * 1.2
                    }}>{item.value}</Text>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      )}

      {q.imageCategory && !q.visualGroup && (
        <View style={styles.visualContainer}>
            {q.type === 'count_objects' && q.count ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {[...Array(q.count)].map((_, i) => (
                <SVGIcon key={i} name={q.imageCategory!} size={isPreschool ? 60 : 40} color={COLORS.secondary} />
              ))}
            </View>
          ) : (
            <SVGIcon name={q.imageCategory} size={isPreschool ? 120 : 80} color={COLORS.secondary} />
          )}
          <Text style={[styles.visualLabel, isPreschool && { fontSize: 16 }]}>
            {q.type === 'count_objects' ? `How many ${q.imageCategory.replace('-', ' ')}s do you see?` : `Look at the ${q.imageCategory.replace('-', ' ')}`}
          </Text>
        </View>
      )}

      {isMathematics && (q.showWorking || !showOptions) && (
        <View style={styles.mathCanvasWrapper}>
          {q.showWorking && (
             <MathCanvas
              visualGroup={workingValue}
              onChange={handleWorkingChange}
              label="Step-by-Step Working"
              placeholder="Show your working steps here..."
              minHeight={150}
            />
          )}

          {!showOptions && (
            <MathCanvas
              visualGroup={mathValue}
              onChange={handleAnswerChange}
              label="Solution"
              placeholder="Enter solution..."
              minHeight={100}
            />
          )}
        </View>
      )}

      <View style={{ gap: 15 }}>
        {showOptions ? (
          <View style={styles.optionsList}>
            {q.options?.map((opt, oIdx) => {
              const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
              const isVisual = emojiRegex.test(opt) || [
                "square-outline", "circle-outline", "triangle-outline", "diamond-outline",
                "star-outline", "heart-outline", "pentagon", "pentagon-outline",
                "hexagon", "hexagon-outline", "octagon", "octagon-outline"
              ].includes(opt);

              const isSelected = isOptionSelected(opt);

              return (
                <TouchableOpacity
                  key={oIdx}
                  style={[styles.optionBtn, isSelected && styles.optionBtnSelected, isPreschool && { padding: 20 }]}
                  onPress={() => handleAnswerChange(opt)}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected, isPreschool && { width: 26, height: 26, borderRadius: 13 }]} />
                  {isVisual ? (
                    <View style={{ padding: 10, backgroundColor: '#F8FAFC', borderRadius: 12 }}>
                        <SVGIcon name={opt} size={isPreschool ? 60 : 40} />
                    </View>
                  ) : (
                    <Text style={[styles.optionLabel, isPreschool && { fontSize: 20, fontWeight: '800' }, isSelected && styles.optionLabelSelected]}>{opt}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          !isMathematics && (
            <TextInput
              style={[
                styles.answerInput,
                isPreschool && { fontSize: 22, minHeight: 80, fontWeight: '800' }
              ]}
              placeholder="Type your answer here..."
              placeholderTextColor="#94A3B8"
              multiline={type !== "preschool"}
              value={answer}
              onChangeText={setAnswer}
            />
          )
        )}
      </View>
    </View>
  );
});

export default QuestionResponseItem;

const styles = StyleSheet.create({
  questionBox: { marginBottom: 25, backgroundColor: '#F8FAFC', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  questionText: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
  optionsList: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  optionBtnSelected: { borderColor: COLORS.success, backgroundColor: COLORS.success + '05' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1' },
  radioSelected: { borderColor: COLORS.success, backgroundColor: COLORS.success },
  optionLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
  optionLabelSelected: { color: COLORS.success, fontWeight: '800' },
  answerInput: { backgroundColor: '#fff', borderRadius: 12, padding: 15, fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  mathCanvasWrapper: {
    gap: 15,
    marginBottom: 10
  },
  preschoolBadge: {
    backgroundColor: COLORS.secondary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  preschoolBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: 0.5,
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  visualLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
    textTransform: 'capitalize',
  },
  worksheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 80,
  },
  worksheetLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  worksheetVisualBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  worksheetRight: {
    flex: 1,
    paddingLeft: 15,
    justifyContent: 'center',
  },
  worksheetOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  worksheetOption: {
    minWidth: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
  },
  worksheetOptionSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  worksheetOptionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  worksheetOptionTextSelected: {
    color: COLORS.success,
  },
  workingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    marginLeft: 4
  }
});
