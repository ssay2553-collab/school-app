import React, { memo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  ScrollView,
} from "react-native";
import { COLORS } from "../../../constants/theme";
import SVGIcon from "../../SVGIcon";
import { Question } from "../../../types/assignments";

interface QuestionResponseItemProps {
  q: Question;
  qIdx: number;
  type: string;
  answer: string;
  setAnswer: (val: string) => void;
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
  const isMathInput = isMathematics;
  const [isFocused, setIsFocused] = useState(false);

  const mathSymbols = [
    { label: "√", value: "√(" },
    { label: "π", value: "π" },
    { label: "x²", value: "²" },
    { label: "xⁿ", value: "^" },
    { label: "±", value: "±" },
    { label: "÷", value: "÷" },
    { label: "×", value: "×" },
    { label: "≠", value: "≠" },
    { label: "≈", value: "≈" },
    { label: "≤", value: "≤" },
    { label: "≥", value: "≥" },
    { label: "(", value: "(" },
    { label: ")", value: ")" },
    { label: "/", value: "/" },
    { label: "θ", value: "θ" },
    { label: "α", value: "α" },
    { label: "β", value: "β" },
  ];

  const insertSymbol = (symbol: string) => {
    setAnswer((answer || "") + symbol);
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
              const isSelected = answer === opt;
              return (
                <TouchableOpacity
                  key={oIdx}
                  style={[styles.worksheetOption, isSelected && styles.worksheetOptionSelected, isPreschool && { minWidth: 50, height: 50 }]}
                  onPress={() => setAnswer(opt)}
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
                    <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                      <Text style={{ fontSize: textFontSize * 0.75, fontWeight: mathFontWeight }}>
                        {item.numerator?.map((n: any) => n.value).join('')}
                      </Text>
                      <View style={{ height: 2, backgroundColor: '#000', width: '120%' }} />
                      <Text style={{ fontSize: textFontSize * 0.75, fontWeight: mathFontWeight }}>
                        {item.denominator?.map((d: any) => d.value).join('')}
                      </Text>
                    </View>
                  ) : item.type === 'mixed_fraction' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 5 }}>
                        <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#1E293B' }}>{item.whole}</Text>
                        <View style={{ alignItems: 'center', marginLeft: 2 }}>
                            <Text style={{ fontSize: textFontSize * 0.7, fontWeight: mathFontWeight }}>
                                {item.numerator?.map((n: any) => n.value).join('')}
                            </Text>
                            <View style={{ height: 1.5, backgroundColor: '#000', width: '120%' }} />
                            <Text style={{ fontSize: textFontSize * 0.7, fontWeight: mathFontWeight }}>
                                {item.denominator?.map((d: any) => d.value).join('')}
                            </Text>
                        </View>
                    </View>
                  ) : item.type === 'sqrt' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 5 }}>
                      <SVGIcon name="sqrt" size={iconSize} color="#000" />
                      <View style={{ borderTopWidth: 2, borderTopColor: '#000', paddingTop: 2 }}>
                        <Text style={{ fontSize: textFontSize * 0.75, fontWeight: mathFontWeight }}>
                          {item.content?.map((c: any) => c.value).join('')}
                        </Text>
                      </View>
                    </View>
                  ) : item.type === 'bracket' ? (
                    <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#1E293B', marginHorizontal: 2 }}>
                      {item.bracketType === 'round' ? '(' : item.bracketType === 'square' ? '[' : '{'}
                      {item.content?.map((c: any) => c.value).join('')}
                      {item.bracketType === 'round' ? ')' : item.bracketType === 'square' ? ']' : '}'}
                    </Text>
                  ) : item.type === 'mapping' ? (
                    <View style={{ alignItems: 'center', marginHorizontal: 8 }}>
                        <Text style={{ fontSize: textFontSize * 0.8, fontWeight: mathFontWeight }}>
                            {item.numerator?.map((n: any) => n.value).join('')}
                        </Text>
                        <SVGIcon name="arrow-down" size={textFontSize * 0.8} color="#000" />
                        <Text style={{ fontSize: textFontSize * 0.8, fontWeight: mathFontWeight }}>
                            {item.denominator?.map((d: any) => d.value).join('')}
                        </Text>
                    </View>
                  ) : item.type === 'vector' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 5 }}>
                        <Text style={{ fontSize: textFontSize * 1.5, fontWeight: '300', color: '#000' }}>(</Text>
                        <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                            <Text style={{ fontSize: textFontSize * 0.8, fontWeight: mathFontWeight }}>
                                {item.numerator?.map((n: any) => n.value).join('')}
                            </Text>
                            <View style={{ height: 8 }} />
                            <Text style={{ fontSize: textFontSize * 0.8, fontWeight: mathFontWeight }}>
                                {item.denominator?.map((d: any) => d.value).join('')}
                            </Text>
                        </View>
                        <Text style={{ fontSize: textFontSize * 1.5, fontWeight: '300', color: '#000' }}>)</Text>
                    </View>
                  ) : item.type === 'matrix' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 5 }}>
                        <Text style={{ fontSize: textFontSize * 1.8, fontWeight: '200', color: '#000' }}>(</Text>
                        <View style={{ paddingHorizontal: 5 }}>
                            <View style={{ flexDirection: 'row', gap: 15, marginBottom: 5 }}>
                                <Text style={{ fontSize: textFontSize * 0.7, fontWeight: mathFontWeight }}>{item.cells?.[0]?.value}</Text>
                                <Text style={{ fontSize: textFontSize * 0.7, fontWeight: mathFontWeight }}>{item.cells?.[1]?.value}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 15 }}>
                                <Text style={{ fontSize: textFontSize * 0.7, fontWeight: mathFontWeight }}>{item.cells?.[2]?.value}</Text>
                                <Text style={{ fontSize: textFontSize * 0.7, fontWeight: mathFontWeight }}>{item.cells?.[3]?.value}</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: textFontSize * 1.8, fontWeight: '200', color: '#000' }}>)</Text>
                    </View>
                  ) : item.type === 'bar' ? (
                    <View style={{ alignItems: 'center', marginHorizontal: 2 }}>
                        <View style={{ height: 1.5, backgroundColor: '#000', width: '100%', marginBottom: -2 }} />
                        <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#1E293B' }}>
                            {item.content?.map((c: any) => c.value).join('')}
                        </Text>
                    </View>
                  ) : item.type === 'superscript' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#1E293B' }}>x</Text>
                      <Text style={{ fontSize: textFontSize * 0.5, fontWeight: mathFontWeight, color: '#1E293B', marginTop: -5 }}>{item.value}</Text>
                    </View>
                  ) : item.type === 'subscript' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: textFontSize, fontWeight: mathFontWeight, color: '#1E293B' }}>x</Text>
                      <Text style={{ fontSize: textFontSize * 0.5, fontWeight: mathFontWeight, color: '#1E293B', marginBottom: -3 }}>{item.value}</Text>
                    </View>
                  ) : item.type === 'variable' ? (
                    <Text style={[
                      {
                        fontSize: textFontSize,
                        fontWeight: '600',
                        color: '#1E293B'
                      },
                      { fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }
                    ]}>{item.value}</Text>
                  ) : (
                    <Text style={{
                      fontSize: textFontSize,
                      fontWeight: mathFontWeight,
                      color: '#1E293B'
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

      {isMathInput && !showOptions && (
        <View style={styles.mathToolbarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mathToolbar}>
            {mathSymbols.map((sym, index) => (
              <TouchableOpacity
                key={index}
                style={styles.mathSymbolBtn}
                onPress={() => insertSymbol(sym.value)}
              >
                <Text style={styles.mathSymbolText}>{sym.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showOptions ? (
        <View style={styles.optionsList}>
          {q.options?.map((opt, oIdx) => {
            const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
            const isVisual = emojiRegex.test(opt) || [
              "square-outline", "circle-outline", "triangle-outline", "diamond-outline",
              "star-outline", "heart-outline", "pentagon", "pentagon-outline",
              "hexagon", "hexagon-outline", "octagon", "octagon-outline"
            ].includes(opt);

            return (
              <TouchableOpacity
                key={oIdx}
                style={[styles.optionBtn, answer === opt && styles.optionBtnSelected, isPreschool && { padding: 20 }]}
                onPress={() => setAnswer(opt)}
              >
                <View style={[styles.radio, answer === opt && styles.radioSelected, isPreschool && { width: 26, height: 26, borderRadius: 13 }]} />
                {isVisual ? (
                   <View style={{ padding: 10, backgroundColor: '#F8FAFC', borderRadius: 12 }}>
                      <SVGIcon name={opt} size={isPreschool ? 60 : 40} />
                   </View>
                ) : (
                  <Text style={[styles.optionLabel, isPreschool && { fontSize: 20, fontWeight: '800' }, answer === opt && styles.optionLabelSelected]}>{opt}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TextInput
          style={[
            styles.answerInput,
            isMathInput && { minHeight: 60, fontSize: 18, fontWeight: '600', textAlign: 'center' },
            isPreschool && { fontSize: 22, minHeight: 80, fontWeight: '800' }
          ]}
          placeholder={isMathInput ? "Enter final answer" : "Type your answer here..."}
          placeholderTextColor="#94A3B8"
          multiline={type !== "preschool" && !isMathInput}
          value={answer || ""}
          onChangeText={setAnswer}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      )}
    </View>
  );
});

export default QuestionResponseItem;

const styles = StyleSheet.create({
  questionBox: { marginBottom: 25, backgroundColor: '#F8FAFC', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  questionText: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
  optionsList: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  optionBtnSelected: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary + '05' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1' },
  radioSelected: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary },
  optionLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
  optionLabelSelected: { color: COLORS.secondary, fontWeight: '800' },
  answerInput: { backgroundColor: '#fff', borderRadius: 12, padding: 15, fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  mathToolbarContainer: {
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden'
  },
  mathToolbar: {
    padding: 8,
    gap: 8,
  },
  mathSymbolBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mathSymbolText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
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
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + '10',
  },
  worksheetOptionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  worksheetOptionTextSelected: {
    color: COLORS.secondary,
  }
});
