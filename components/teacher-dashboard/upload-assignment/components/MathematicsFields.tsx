import React, { memo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../../SVGIcon";
import { COLORS, SHADOWS } from "../../../../constants/theme";

const MathematicsFields = memo(({
  q,
  qIndex,
  updateMathematicsQuestion,
  updateOption,
  addOption,
  styles
}: any) => {
  const [activeCategory, setActiveCategory] = useState<string>("Numbers & Basics");
  const [isLibraryVisible, setIsLibraryVisible] = useState(true);

  const visualAssetLibrary = [
    {
      category: "Numbers & Basics",
      icon: "calculator",
      items: [
        { id: "1", label: "1", type: "number" }, { id: "2", label: "2", type: "number" }, { id: "3", label: "3", type: "number" },
        { id: "4", label: "4", type: "number" }, { id: "5", label: "5", type: "number" }, { id: "6", label: "6", type: "number" },
        { id: "7", label: "7", type: "number" }, { id: "8", label: "8", type: "number" }, { id: "9", label: "9", type: "number" },
        { id: "0", label: "0", type: "number" }, { id: ".", label: "Decimal", type: "number" }, { id: ",", label: "Comma", type: "number" },
      ]
    },
    {
      category: "Operations",
      icon: "add-circle",
      items: [
        { id: "+", label: "Plus", type: "operator" },
        { id: "-", label: "Minus", type: "operator" },
        { id: "×", label: "Multiply", type: "operator" },
        { id: "÷", label: "Divide", type: "operator" },
        { id: "=", label: "Equals", type: "operator" },
        { id: "≠", label: "Not Equal", type: "operator" },
        { id: "≈", label: "Approx", type: "operator" },
        { id: ">", label: "Greater Than", type: "operator" },
        { id: "<", label: "Less Than", type: "operator" },
        { id: "±", label: "Plus-Minus", type: "operator" },
      ]
    },
    {
      category: "Complex Math",
      icon: "school",
      items: [
        { id: "√", label: "Square Root", type: "sqrt" },
        { id: "/", label: "Fraction", type: "fraction" },
        { id: "mixed", label: "Mixed Frac", type: "mixed_fraction" },
        { id: "vector", label: "Vector", type: "vector" },
        { id: "matrix", label: "2x2 Matrix", type: "matrix" },
        { id: "bar", label: "Bar Not.", type: "bar" },
        { id: "mapping", label: "Mapping", type: "mapping" },
        { id: "°", label: "Degree", type: "superscript", base: "", value: "°" },
        { id: "^", label: "Superscript", type: "superscript", base: "x" },
        { id: "_", label: "Subscript", type: "subscript", base: "x" },
        { id: "(", label: "(", type: "bracket", value: "(" },
        { id: ")", label: ")", type: "bracket", value: ")" },
        { id: "[", label: "[", type: "bracket", value: "[" },
        { id: "]", label: "]", type: "bracket", value: "]" },
        { id: "{", label: "{", type: "bracket", value: "{" },
        { id: "}", label: "}", type: "bracket", value: "}" },
        { id: "|", label: "|", type: "bracket", value: "|" },
        { id: "π", label: "Pi", type: "variable" },
        { id: "∞", label: "Infinity" },
        { id: "%", label: "Percent" },
      ]
    },
    {
      category: "Sets & Logic",
      icon: "list",
      items: [
        { id: "∪", label: "Union", type: "operator" },
        { id: "∩", label: "Intersect", type: "operator" },
        { id: "∈", label: "Element", type: "operator" },
        { id: "∉", label: "Not Elem", type: "operator" },
        { id: "⊂", label: "Subset", type: "operator" },
        { id: "∅", label: "Null Set", type: "operator" },
        { id: "ξ", label: "Universal", type: "variable" },
        { id: "∴", label: "Therefore", type: "operator" },
        { id: "∵", label: "Because", type: "operator" },
        { id: "≤", label: "Less/Eq", type: "operator" },
        { id: "≥", label: "Great/Eq", type: "operator" },
        { id: "≡", label: "Congruent", type: "operator" },
      ]
    },
    {
      category: "Geometry",
      icon: "triangle",
      items: [
        { id: "∠", label: "Angle", type: "operator" },
        { id: "△", label: "Triangle", type: "operator" },
        { id: "⊥", label: "Perp", type: "operator" },
        { id: "∥", label: "Parallel", type: "operator" },
        { id: "θ", label: "Theta", type: "variable" },
        { id: "α", label: "Alpha", type: "variable" },
        { id: "β", label: "Beta", type: "variable" },
        { id: "cm", label: "cm", type: "text" },
        { id: "m", label: "m", type: "text" },
        { id: "km", label: "km", type: "text" },
      ]
    },
    {
      category: "Variables",
      icon: "text",
      items: [
        { id: "x", label: "x", type: "variable" },
        { id: "y", label: "y", type: "variable" },
        { id: "z", label: "z", type: "variable" },
        { id: "a", label: "a", type: "variable" },
        { id: "b", label: "b", type: "variable" },
        { id: "c", label: "c", type: "variable" },
        { id: "n", label: "n", type: "variable" },
        { id: "f", label: "f", type: "variable" },
        { id: "g", label: "g", type: "variable" },
      ]
    },
    {
      category: "Ratios & Proportionality",
      icon: "analytics",
      items: [
        { id: ":", label: "Ratio", type: "operator" },
        { id: "::", label: "Proportion", type: "operator" },
        { id: "∝", label: "Proportional", type: "operator" },
        { id: "!", label: "Factorial", type: "operator" },
        { id: "k", label: "Constant", type: "variable" },
      ]
    }
  ];

  return (
    <Animatable.View animation="fadeIn" duration={400}>
      <Text style={styles.inputLabel}>Question Builder (Canvas)</Text>

      {/* Math Canvas Editor */}
      <View style={{
        gap: 10,
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 18,
        minHeight: 120,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 15,
          minHeight: 100,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          borderStyle: 'dashed'
        }}>
          {(!q.visualGroup || q.visualGroup.length === 0) && (
            <Text style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic', flex: 1, textAlign: 'center' }}>
              Your mathematical expression will appear here. Add components from the library below.
            </Text>
          )}
          {q.visualGroup?.map((item: any, idx: number) => (
            <React.Fragment key={idx}>
              {item.isNewLine && <View style={{ width: '100%', height: 0 }} />}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                {item.type === 'fraction' ? (
                  <View style={{ alignItems: 'center', minWidth: 20, marginHorizontal: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.numerator?.[0]?.value || '1'}</Text>
                    <View style={{ height: 1.5, backgroundColor: '#000', width: '100%' }} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.denominator?.[0]?.value || '2'}</Text>
                  </View>
                ) : item.type === 'mixed_fraction' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: 2 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#000' }}>{item.whole || '2'}</Text>
                    <View style={{ alignItems: 'center', minWidth: 18 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{item.numerator?.[0]?.value || '1'}</Text>
                      <View style={{ height: 1.5, backgroundColor: '#000', width: '100%' }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{item.denominator?.[0]?.value || '2'}</Text>
                    </View>
                  </View>
                ) : item.type === 'sqrt' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
                    <SVGIcon name="sqrt" size={24} color="#000" />
                    <View style={{ borderTopWidth: 1.5, borderTopColor: '#000', paddingTop: 2, minWidth: 16, marginLeft: -2 }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#000',
                        fontStyle: /[a-zA-Z]/.test(item.content?.[0]?.value || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}>{item.content?.[0]?.value || 'x'}</Text>
                    </View>
                  </View>
                ) : item.type === 'bracket' ? (
                  <Text style={{
                    fontSize: 28,
                    fontWeight: '300',
                    color: '#000',
                    marginHorizontal: 1,
                    marginTop: -2
                  }}>{item.value}</Text>
                ) : item.type === 'mapping' ? (
                  <View style={{ alignItems: 'center', minWidth: 20, marginHorizontal: 4 }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: '#000',
                      fontStyle: /[a-zA-Z]/.test(item.numerator?.[0]?.value || '') ? 'italic' : 'normal',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                    }}>{item.numerator?.[0]?.value || 'x'}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#000', marginTop: -2, marginBottom: -2 }}>↓</Text>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: '#000',
                      fontStyle: /[a-zA-Z]/.test(item.denominator?.[0]?.value || '') ? 'italic' : 'normal',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                    }}>{item.denominator?.[0]?.value || 'y'}</Text>
                  </View>
                ) : item.type === 'vector' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
                    <Text style={{ fontSize: 28, fontWeight: '300', color: '#000', marginTop: -2 }}>(</Text>
                    <View style={{ alignItems: 'center', minWidth: 16, marginHorizontal: 1 }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#000',
                        fontStyle: /[a-zA-Z]/.test(item.numerator?.[0]?.value || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}>{item.numerator?.[0]?.value || 'x'}</Text>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#000',
                        fontStyle: /[a-zA-Z]/.test(item.denominator?.[0]?.value || '') ? 'italic' : 'normal',
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}>{item.denominator?.[0]?.value || 'y'}</Text>
                    </View>
                    <Text style={{ fontSize: 28, fontWeight: '300', color: '#000', marginTop: -2 }}>)</Text>
                  </View>
                ) : item.type === 'matrix' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
                    <Text style={{ fontSize: 32, fontWeight: '300', color: '#000', marginTop: -4 }}>(</Text>
                    <View style={{ paddingHorizontal: 2, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.cells?.[0]?.value || 'a'}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.cells?.[1]?.value || 'b'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.cells?.[2]?.value || 'c'}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>{item.cells?.[3]?.value || 'd'}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 32, fontWeight: '300', color: '#000', marginTop: -4 }}>)</Text>
                  </View>
                ) : item.type === 'bar' ? (
                  <View style={{ alignItems: 'center', marginHorizontal: 2 }}>
                    <View style={{ height: 1.5, backgroundColor: '#000', width: '100%', marginBottom: 1 }} />
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: '#000',
                      fontStyle: /[a-zA-Z]/.test(item.content?.[0]?.value || '') ? 'italic' : 'normal',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                    }}>{item.content?.[0]?.value || 'x'}</Text>
                  </View>
                ) : item.type === 'superscript' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 1 }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      fontStyle: /[a-zA-Z]/.test(item.base || '') ? 'italic' : 'normal',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      color: '#000'
                    }}>{item.base || 'x'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#000', marginTop: -4 }}>{item.value || '2'}</Text>
                  </View>
                ) : item.type === 'subscript' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 1 }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '600',
                      fontStyle: /[a-zA-Z]/.test(item.base || '') ? 'italic' : 'normal',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      color: '#000'
                    }}>{item.base || 'x'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#000', marginBottom: -3 }}>{item.value || '2'}</Text>
                  </View>
                ) : item.type === 'variable' ? (
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    fontStyle: 'italic',
                    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                    color: '#000'
                  }}>{item.value}</Text>
                ) : item.type === 'operator' ? (
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: '#000',
                    marginHorizontal: 4
                  }}>{item.value}</Text>
                ) : item.type === 'number' ? (
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: '#000'
                  }}>{item.value}</Text>
                ) : (
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '400',
                    color: '#334155',
                    lineHeight: 20
                  }}>{item.value}</Text>
                )}
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* List Management for Math Items */}
        <View style={{ gap: 8 }}>
          {q.visualGroup?.map((item: any, idx: number) => (
            <View key={idx} style={{
              backgroundColor: '#fff',
              padding: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.secondary + '15',
              ...SHADOWS.small
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{idx + 1}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    {item.type === 'fraction' ? (
                      <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flex: 1 }}>
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 }}
                          value={item.numerator?.[0]?.value}
                          placeholder="Num"
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].numerator = [{ id: Math.random().toString(), type: 'text', value: t }];
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                        <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: 'bold' }}>/</Text>
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 }}
                          value={item.denominator?.[0]?.value}
                          placeholder="Den"
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].denominator = [{ id: Math.random().toString(), type: 'text', value: t }];
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                      </View>
                    ) : item.type === 'mixed_fraction' ? (
                      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', flex: 1 }}>
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, width: 30, borderWidth: 1, borderColor: '#E2E8F0' }}
                          value={item.whole}
                          placeholder="W"
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].whole = t;
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 }}
                          value={item.numerator?.[0]?.value}
                          placeholder="Num"
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].numerator = [{ id: Math.random().toString(), type: 'text', value: t }];
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                        <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: 'bold' }}>/</Text>
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 }}
                          value={item.denominator?.[0]?.value}
                          placeholder="Den"
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].denominator = [{ id: Math.random().toString(), type: 'text', value: t }];
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                      </View>
                    ) : (item.type === 'mapping' || item.type === 'vector') ? (
                      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', flex: 1 }}>
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 }}
                          value={item.numerator?.[0]?.value}
                          placeholder={item.type === 'vector' ? "x" : "Top"}
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].numerator = [{ id: Math.random().toString(), type: 'text', value: t }];
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                        <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: 'bold' }}>{item.type === 'vector' ? '|' : '→'}</Text>
                        <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 }}
                          value={item.denominator?.[0]?.value}
                          placeholder={item.type === 'vector' ? "y" : "Bottom"}
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].denominator = [{ id: Math.random().toString(), type: 'text', value: t }];
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                      </View>
                    ) : item.type === 'matrix' ? (
                      <View style={{ gap: 4, paddingVertical: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                           <TextInput
                            style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, width: 35, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center' }}
                            value={item.cells?.[0]?.value}
                            placeholder="a"
                            onChangeText={(t) => {
                              const newGroup = [...q.visualGroup];
                              if (!newGroup[idx].cells) newGroup[idx].cells = [{value: ''}, {value: ''}, {value: ''}, {value: ''}];
                              newGroup[idx].cells[0].value = t;
                              updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                            }}
                          />
                          <TextInput
                            style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, width: 35, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center' }}
                            value={item.cells?.[1]?.value}
                            placeholder="b"
                            onChangeText={(t) => {
                              const newGroup = [...q.visualGroup];
                              if (!newGroup[idx].cells) newGroup[idx].cells = [{value: ''}, {value: ''}, {value: ''}, {value: ''}];
                              newGroup[idx].cells[1].value = t;
                              updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                            }}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                           <TextInput
                            style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, width: 35, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center' }}
                            value={item.cells?.[2]?.value}
                            placeholder="c"
                            onChangeText={(t) => {
                              const newGroup = [...q.visualGroup];
                              if (!newGroup[idx].cells) newGroup[idx].cells = [{value: ''}, {value: ''}, {value: ''}, {value: ''}];
                              newGroup[idx].cells[2].value = t;
                              updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                            }}
                          />
                          <TextInput
                            style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, width: 35, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center' }}
                            value={item.cells?.[3]?.value}
                            placeholder="d"
                            onChangeText={(t) => {
                              const newGroup = [...q.visualGroup];
                              if (!newGroup[idx].cells) newGroup[idx].cells = [{value: ''}, {value: ''}, {value: ''}, {value: ''}];
                              newGroup[idx].cells[3].value = t;
                              updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                            }}
                          />
                        </View>
                      </View>
                    ) : (item.type === 'sqrt' || item.type === 'bar') ? (
                      <TextInput
                        style={{ fontSize: 14, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, flex: 1, borderWidth: 1, borderColor: '#E2E8F0' }}
                        value={item.content?.[0]?.value}
                        placeholder={item.type === 'sqrt' ? "Radicand (Inside √)" : "Repeating digits (e.g. 3)"}
                        onChangeText={(t) => {
                          const newGroup = [...q.visualGroup];
                          newGroup[idx].content = [{ id: Math.random().toString(), type: 'text', value: t }];
                          updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                        }}
                      />
                    ) : item.type === 'bracket' ? (
                      <Text style={{
                        fontSize: 22,
                        fontWeight: '400',
                        color: '#000',
                        textAlign: 'center',
                        width: 30
                      }}>{item.value}</Text>
                    ) : (item.type === 'superscript' || item.type === 'subscript') ? (
                       <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', flex: 1 }}>
                         <TextInput
                          style={{ fontSize: 10, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, width: 40, borderWidth: 1, borderColor: '#E2E8F0' }}
                          value={item.base}
                          placeholder="Base"
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].base = t;
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                         <TextInput
                          style={{ fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 30 }}
                          value={item.value}
                          placeholder={item.type === 'superscript' ? "Exp" : "Idx"}
                          onChangeText={(t) => {
                            const newGroup = [...q.visualGroup];
                            newGroup[idx].value = t;
                            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                          }}
                        />
                       </View>
                    ) : item.type === 'variable' ? (
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    fontStyle: 'italic',
                    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                    color: COLORS.primary
                  }}>{item.value}</Text>
                ) : item.type === 'operator' ? (
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: COLORS.secondary,
                    marginHorizontal: 4
                  }}>{item.value}</Text>
                ) : (
                      <TextInput
                        style={{ fontSize: 13, fontWeight: '400', color: '#1E293B', flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                        value={item.value}
                        placeholder="Type text or story problem part..."
                        multiline={true}
                        onChangeText={(t) => {
                          const newGroup = [...q.visualGroup];
                          newGroup[idx].value = t;
                          updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                        }}
                      />
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 2 }}>
                   <TouchableOpacity
                    onPress={() => {
                      const newGroup = [...q.visualGroup];
                      newGroup[idx].isNewLine = !newGroup[idx].isNewLine;
                      updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                    }}
                    style={{ padding: 4, backgroundColor: item.isNewLine ? COLORS.primary + '20' : '#F1F5F9', borderRadius: 6, width: 26, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <SVGIcon name="return-down-back" size={12} color={item.isNewLine ? COLORS.primary : '#64748B'} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => {
                    const newGroup = q.visualGroup.filter((_: any, i: number) => i !== idx);
                    updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                  }} style={{ padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6, width: 26, alignItems: 'center', justifyContent: 'center' }}>
                    <SVGIcon name="trash" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => {
            const newGroup = [...(q.visualGroup || []), { type: 'text', value: '', size: 'medium', id: Math.random().toString() }];
            updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary + '10', padding: 10, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.secondary }}
        >
          <SVGIcon name="add-circle" size={18} color={COLORS.secondary} />
          <Text style={{ fontWeight: '600', color: COLORS.secondary, fontSize: 13 }}>Add New Part</Text>
        </TouchableOpacity>
      </View>

      {/* Asset Library */}
      <View style={{ marginBottom: 20 }}>
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          overflow: 'hidden',
          ...SHADOWS.medium,
        }}>
        <View style={{ padding: 15, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
            <Text style={{ fontWeight: '700', color: '#1E293B' }}>Mathematical Symbols & Tools</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
            {visualAssetLibrary.map((cat) => (
              <TouchableOpacity
                key={cat.category}
                onPress={() => setActiveCategory(cat.category)}
                style={[
                  styles.smallBubble,
                  { marginRight: 8, paddingHorizontal: 12 },
                  activeCategory === cat.category && { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary }
                ]}
              >
                <SVGIcon name={cat.icon} size={14} color={activeCategory === cat.category ? "#FFF" : COLORS.secondary} />
                <Text style={[styles.smallBubbleText, activeCategory === cat.category && { color: "#FFF" }]}>{cat.category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={{ maxHeight: 250 }}
            contentContainerStyle={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              padding: 15,
            }}
          >
            {visualAssetLibrary.find(c => c.category === activeCategory)?.items.map((item: any, idx) => (
              <TouchableOpacity
                key={`${item.id}_${idx}`}
                onPress={() => {
                  const newGroup = [...(q.visualGroup || []), {
                    type: item.type || 'text',
                    value: item.value ?? item.id,
                    base: item.base,
                    size: 'medium',
                    id: Math.random().toString(),
                    bracketType: item.bracketType,
                    whole: item.type === 'mixed_fraction' ? '' : undefined,
                    numerator: (item.type === 'fraction' || item.type === 'mixed_fraction' || item.type === 'mapping' || item.type === 'vector') ? [{ id: Math.random().toString(), type: 'text', value: '' }] : undefined,
                    denominator: (item.type === 'fraction' || item.type === 'mixed_fraction' || item.type === 'mapping' || item.type === 'vector') ? [{ id: Math.random().toString(), type: 'text', value: '' }] : undefined,
                    content: (item.type === 'sqrt' || item.type === 'bar') ? [{ id: Math.random().toString(), type: 'text', value: '' }] : undefined,
                    cells: item.type === 'matrix' ? [
                      { id: '0', type: 'text', value: '' },
                      { id: '1', type: 'text', value: '' },
                      { id: '2', type: 'text', value: '' },
                      { id: '3', type: 'text', value: '' }
                    ] : undefined
                  }];
                  updateMathematicsQuestion(qIndex, { visualGroup: newGroup });
                }}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22%',
                  aspectRatio: 1,
                  borderRadius: 12,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 4
                }}
              >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                  {item.type === 'fraction' || item.type === 'mixed_fraction' || item.type === 'mapping' || item.type === 'vector' ? (
                    <View style={{ alignItems: 'center', flexDirection: 'row' }}>
                      {item.type === 'mixed_fraction' && <Text style={{ fontSize: 10, fontWeight: '700', marginRight: 1 }}>w</Text>}
                      {item.type === 'vector' && <Text style={{ fontSize: 14, marginRight: 1 }}>(</Text>}
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 8, fontWeight: '700' }}>{item.type === 'mapping' ? 't' : item.type === 'vector' ? 'x' : 'n'}</Text>
                        {item.type === 'mapping' ? (
                          <Text style={{ fontSize: 7, marginVertical: -3 }}>↓</Text>
                        ) : item.type === 'vector' ? (
                          <View style={{ height: 1 }} />
                        ) : (
                          <View style={{ height: 1.5, backgroundColor: '#000', width: 8, marginVertical: 1 }} />
                        )}
                        <Text style={{ fontSize: 8, fontWeight: '700' }}>{item.type === 'mapping' ? 'b' : item.type === 'vector' ? 'y' : 'd'}</Text>
                      </View>
                      {item.type === 'vector' && <Text style={{ fontSize: 14, marginLeft: 1 }}>)</Text>}
                    </View>
                  ) : item.type === 'superscript' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>x</Text>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#000', marginTop: -4 }}>2</Text>
                    </View>
                  ) : item.type === 'subscript' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>x</Text>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#000', marginBottom: -4 }}>2</Text>
                    </View>
                  ) : item.type === 'bar' ? (
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ height: 2, backgroundColor: '#000', width: 12, marginBottom: 1 }} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>x</Text>
                    </View>
                  ) : item.type === 'sqrt' ? (
                    <SVGIcon name="sqrt" size={22} color="#000" />
                  ) : item.type === 'variable' ? (
                    <Text style={{
                      fontSize: 22,
                      fontWeight: '600',
                      fontStyle: 'italic',
                      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      color: COLORS.primary
                    }}>{item.value || item.id}</Text>
                  ) : item.type === 'operator' ? (
                    <Text style={{
                      fontSize: 22,
                      fontWeight: '600',
                      color: COLORS.secondary,
                    }}>{item.value || item.id}</Text>
                  ) : (
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B' }}>{item.value || item.id}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 9, color: "#64748B", fontWeight: '700', textAlign: 'center', marginTop: 2 }} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <Text style={styles.inputLabel}>Instructions (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Solve for x or Simplify the expression"
        value={q.text}
        onChangeText={(t) => updateMathematicsQuestion(qIndex, { text: t })}
      />

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
