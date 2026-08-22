import React, { memo, useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, Modal } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "./SVGIcon";
import { COLORS, SHADOWS } from "../constants/theme";
import { VisualItem } from "../types/assignments";

interface MathCanvasProps {
  visualGroup: VisualItem[];
  onChange: (newGroup: VisualItem[]) => void;
  label?: string;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
}

const MathCanvas = memo(({
  visualGroup = [],
  onChange,
  label = "Mathematical Expression",
  placeholder = "Your mathematical expression will appear here. Add components from the library below.",
  minHeight = 120,
  readOnly = false
}: MathCanvasProps) => {
  const [activeCategory, setActiveCategory] = useState<string>("Numbers & Basics");
  const [suggestion, setSuggestion] = useState<{ idx: number, char: string, nestedField?: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const itemOffsets = useRef<Record<number, number>>({});
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (activeIdx !== null && itemOffsets.current[activeIdx] !== undefined) {
      scrollRef.current?.scrollTo({
        y: itemOffsets.current[activeIdx],
        animated: true
      });
    }
  }, [activeIdx]);

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

  const updateVisualGroup = (newGroup: VisualItem[]) => {
    onChange(newGroup);
  };

  const handleSuggestionChoice = (type: 'text' | 'variable') => {
    if (!suggestion) return;

    if (type === 'text') {
      setSuggestion(null);
      return;
    }

    const { idx, char, nestedField } = suggestion;

    if (!nestedField) {
      const currentItem = visualGroup[idx];
      const fullText = currentItem.value;
      const prefix = fullText.slice(0, -1);

      const newItems: VisualItem[] = [];
      if (prefix.length > 0) {
        newItems.push({ id: Math.random().toString(), type: 'text', value: prefix, size: 'medium' });
      }
      newItems.push({ id: Math.random().toString(), type: 'variable', value: char, size: 'medium' });
      newItems.push({ id: Math.random().toString(), type: 'text', value: '', size: 'medium' });

      const newGroup = [
        ...visualGroup.slice(0, idx),
        ...newItems,
        ...visualGroup.slice(idx + 1)
      ];
      onChange(newGroup);
    } else {
      const currentItem = { ...visualGroup[idx] };
      const currentArray = (currentItem as any)[nestedField] || [];
      const nestedIdx = currentArray.length - 1;
      const fullText = currentArray[nestedIdx]?.value || "";
      const prefix = fullText.slice(0, -1);

      const newNestedItems: VisualItem[] = [];
      if (prefix.length > 0) {
        newNestedItems.push({ id: Math.random().toString(), type: 'text', value: prefix });
      }
      newNestedItems.push({ id: Math.random().toString(), type: 'variable', value: char });
      newNestedItems.push({ id: Math.random().toString(), type: 'text', value: '' });

      (currentItem as any)[nestedField] = [
        ...currentArray.slice(0, nestedIdx),
        ...newNestedItems
      ];

      const newGroup = [...visualGroup];
      newGroup[idx] = currentItem;
      onChange(newGroup);
    }
    setSuggestion(null);
  };

  const addItem = (item: any) => {
    const newItemIdx = visualGroup.length;
    const newItem: VisualItem = {
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
    };
    updateVisualGroup([...visualGroup, newItem]);
    setActiveIdx(newItemIdx);
  };

  const removeItem = (idx: number) => {
    updateVisualGroup(visualGroup.filter((_, i) => i !== idx));
  };

  const toggleNewLine = (idx: number) => {
    const newGroup = [...visualGroup];
    newGroup[idx].isNewLine = !newGroup[idx].isNewLine;
    updateVisualGroup(newGroup);
  };

  const updateItemValue = (idx: number, updates: Partial<VisualItem>) => {
    const newGroup = [...visualGroup];
    newGroup[idx] = { ...newGroup[idx], ...updates };
    updateVisualGroup(newGroup);
  };

  const getCombinedText = (items: VisualItem[]) => items.map(i => i.value).join('');

  const handleNestedChange = (idx: number, field: string, text: string) => {
    const vars = ['x', 'y', 'z', 'a', 'b', 'c', 'n', 'f', 'g', 'k', 'θ', 'α', 'β', 'i', 'j'];
    const lastChar = text.slice(-1).toLowerCase();

    const currentItem = { ...visualGroup[idx] };
    (currentItem as any)[field] = [{ id: Math.random().toString(), type: 'text', value: text }];

    const newGroup = [...visualGroup];
    newGroup[idx] = currentItem;
    onChange(newGroup);

    if (vars.includes(lastChar) && text.length > 0) {
      setSuggestion({ idx, char: text.slice(-1), nestedField: field });
    }
  };

  const renderItems = (items: VisualItem[]) => {
    return items.map((item, idx) => (
      <React.Fragment key={item.id || idx}>
        {item.isNewLine && <View style={{ width: '100%', height: 0 }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.type === 'fraction' ? (
            <View style={styles.fraction}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.numerator || [])}</View>
              <View style={styles.fractionLine} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.denominator || [])}</View>
            </View>
          ) : item.type === 'mixed_fraction' ? (
            <View style={styles.mixedFraction}>
              <Text style={styles.wholeNumber}>{item.whole || '2'}</Text>
              <View style={styles.fractionSmall}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.numerator || [])}</View>
                <View style={styles.fractionLine} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.denominator || [])}</View>
              </View>
            </View>
          ) : item.type === 'sqrt' ? (
            <View style={styles.sqrtContainer}>
              <SVGIcon name="sqrt" size={24} color="#000" />
              <View style={styles.sqrtContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.content || [])}</View>
              </View>
            </View>
          ) : item.type === 'bracket' ? (
            <Text style={styles.bracketText}>{item.value}</Text>
          ) : item.type === 'mapping' ? (
            <View style={styles.mapping}>
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.numerator || [])}</View>
              <Text style={styles.arrowText}>↓</Text>
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.denominator || [])}</View>
            </View>
          ) : item.type === 'vector' ? (
            <View style={styles.vector}>
              <Text style={styles.vectorBracket}>(</Text>
              <View style={styles.vectorContent}>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.numerator || [])}</View>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.denominator || [])}</View>
              </View>
              <Text style={styles.vectorBracket}>)</Text>
            </View>
          ) : item.type === 'matrix' ? (
            <View style={styles.matrix}>
              <Text style={styles.matrixBracket}>(</Text>
              <View style={styles.matrixCells}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={styles.mathTextSmall}>{item.cells?.[0]?.value || 'a'}</Text>
                  <Text style={styles.mathTextSmall}>{item.cells?.[1]?.value || 'b'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={styles.mathTextSmall}>{item.cells?.[2]?.value || 'c'}</Text>
                  <Text style={styles.mathTextSmall}>{item.cells?.[3]?.value || 'd'}</Text>
                </View>
              </View>
              <Text style={styles.matrixBracket}>)</Text>
            </View>
          ) : item.type === 'bar' ? (
            <View style={styles.barContainer}>
              <View style={styles.barLine} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderItems(item.content || [])}</View>
            </View>
          ) : item.type === 'superscript' ? (
            <View style={styles.superscriptContainer}>
              <Text style={[styles.mathText, /[a-zA-Z]/.test(item.base || '') && styles.italic]}>{item.base || 'x'}</Text>
              <Text style={styles.superscriptText}>{item.value || '2'}</Text>
            </View>
          ) : item.type === 'subscript' ? (
            <View style={styles.subscriptContainer}>
              <Text style={[styles.mathText, /[a-zA-Z]/.test(item.base || '') && styles.italic]}>{item.base || 'x'}</Text>
              <Text style={styles.subscriptText}>{item.value || '2'}</Text>
            </View>
          ) : item.type === 'variable' ? (
            <Text style={[styles.mathText, styles.italic, { color: COLORS.primary }]}>{item.value}</Text>
          ) : item.type === 'operator' ? (
            <Text style={styles.operatorText}>{item.value}</Text>
          ) : item.type === 'number' ? (
            <Text style={styles.mathText}>{item.value}</Text>
          ) : (
            <Text style={styles.plainText}>{item.value}</Text>
          )}
        </View>
      </React.Fragment>
    ));
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}

      {suggestion !== null && (
        <View style={[
          styles.modalOverlay,
          { zIndex: 99999, elevation: 100 },
          Platform.OS === 'web' ? ({ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0 } as any) : StyleSheet.absoluteFillObject
        ]}>
          <Animatable.View animation="zoomIn" duration={200} style={styles.suggestionPopup}>
            <Text style={styles.suggestionTitle}>Use "{suggestion.char}" as:</Text>
            <View style={styles.suggestionActions}>
              <TouchableOpacity
                style={styles.suggestionChoice}
                onPress={() => handleSuggestionChoice('text')}
              >
                <Text style={styles.suggestionChoiceText}>Standard Letter</Text>
                <Text style={styles.suggestionChoiceSub}>Normal text style</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.suggestionChoice, styles.suggestionChoicePrimary]}
                onPress={() => handleSuggestionChoice('variable')}
              >
                <Text style={[styles.suggestionChoiceText, styles.suggestionChoiceTextPrimary]}>Math Variable</Text>
                <Text style={styles.suggestionChoiceSubPrimary}>Italic & Colored style</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 10, padding: 10, alignItems: 'center' }}
                onPress={() => setSuggestion(null)}
              >
                <Text style={{ color: '#94A3B8', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      )}

      <View style={[styles.canvasContainer, { minHeight }]}>
        <View style={styles.canvas}>
          {(!visualGroup || visualGroup.length === 0) && (
            <Text style={styles.placeholderText}>{placeholder}</Text>
          )}
          {renderItems(visualGroup)}
        </View>

        {!readOnly && (
          <>
            <ScrollView
              ref={scrollRef}
              nestedScrollEnabled={true}
              style={visualGroup.length > 3 ? { maxHeight: 200 } : {}}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            >
              {visualGroup?.map((item, idx) => {
                // If it's a variable, we skip rendering it as a separate row if the previous item was text
                // This makes them feel like part of the same "manage field"
                const isVariableAfterText = item.type === 'variable' && idx > 0 && visualGroup[idx-1].type === 'text';
                if (isVariableAfterText) return null;

                return (
                  <View
                    key={idx}
                    style={styles.itemEditorRow}
                    onLayout={(e) => {
                      itemOffsets.current[idx] = e.nativeEvent.layout.y;
                    }}
                  >
                    <View style={styles.itemEditorMain}>
                      <View style={styles.itemBadge}>
                        <Text style={styles.itemBadgeText}>{idx + 1}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        {item.type === 'fraction' ? (
                          <View style={styles.inputGroup}>
                            <TextInput
                              style={styles.smallInput}
                              value={getCombinedText(item.numerator || [])}
                              placeholder="Num"
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => handleNestedChange(idx, 'numerator', t)}
                            />
                            <Text style={styles.inputDivider}>/</Text>
                            <TextInput
                              style={styles.smallInput}
                              value={getCombinedText(item.denominator || [])}
                              placeholder="Den"
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => handleNestedChange(idx, 'denominator', t)}
                            />
                          </View>
                        ) : item.type === 'mixed_fraction' ? (
                          <View style={styles.inputGroup}>
                            <TextInput
                              style={[styles.smallInput, { width: 30 }]}
                              value={item.whole}
                              placeholder="W"
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => updateItemValue(idx, { whole: t })}
                            />
                            <TextInput
                              style={styles.smallInput}
                              value={getCombinedText(item.numerator || [])}
                              placeholder="Num"
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => handleNestedChange(idx, 'numerator', t)}
                            />
                            <Text style={styles.inputDivider}>/</Text>
                            <TextInput
                              style={styles.smallInput}
                              value={getCombinedText(item.denominator || [])}
                              placeholder="Den"
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => handleNestedChange(idx, 'denominator', t)}
                            />
                          </View>
                        ) : (item.type === 'mapping' || item.type === 'vector') ? (
                          <View style={styles.inputGroup}>
                            <TextInput
                              style={styles.smallInput}
                              value={getCombinedText(item.numerator || [])}
                              placeholder={item.type === 'vector' ? "x" : "Top"}
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => handleNestedChange(idx, 'numerator', t)}
                            />
                            <Text style={styles.inputDivider}>{item.type === 'vector' ? '|' : '→'}</Text>
                            <TextInput
                              style={styles.smallInput}
                              value={getCombinedText(item.denominator || [])}
                              placeholder={item.type === 'vector' ? "y" : "Bottom"}
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => handleNestedChange(idx, 'denominator', t)}
                            />
                          </View>
                        ) : item.type === 'matrix' ? (
                          <View style={{ gap: 4, paddingVertical: 4 }}>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              {[0, 1].map((cIdx) => (
                                <TextInput
                                  key={cIdx}
                                  style={styles.matrixInput}
                                  value={item.cells?.[cIdx]?.value}
                                  placeholder={['a', 'b'][cIdx]}
                                  onFocus={() => setActiveIdx(idx)}
                                  onChangeText={(t) => {
                                    const newCells = [...(item.cells || [
                                      { id: '0', type: 'text', value: '' },
                                      { id: '1', type: 'text', value: '' },
                                      { id: '2', type: 'text', value: '' },
                                      { id: '3', type: 'text', value: '' }
                                    ])];
                                    newCells[cIdx] = { ...newCells[cIdx], value: t };
                                    updateItemValue(idx, { cells: newCells });
                                  }}
                                />
                              ))}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              {[2, 3].map((cIdx) => (
                                <TextInput
                                  key={cIdx}
                                  style={styles.matrixInput}
                                  value={item.cells?.[cIdx]?.value}
                                  placeholder={['c', 'd'][cIdx - 2]}
                                  onFocus={() => setActiveIdx(idx)}
                                  onChangeText={(t) => {
                                    const newCells = [...(item.cells || [
                                      { id: '0', type: 'text', value: '' },
                                      { id: '1', type: 'text', value: '' },
                                      { id: '2', type: 'text', value: '' },
                                      { id: '3', type: 'text', value: '' }
                                    ])];
                                    newCells[cIdx] = { ...newCells[cIdx], value: t };
                                    updateItemValue(idx, { cells: newCells });
                                  }}
                                />
                              ))}
                            </View>
                          </View>
                        ) : (item.type === 'sqrt' || item.type === 'bar') ? (
                          <TextInput
                            style={styles.fullWidthInput}
                            value={getCombinedText(item.content || [])}
                            placeholder={item.type === 'sqrt' ? "Radicand (Inside √)" : "Repeating digits"}
                            onFocus={() => setActiveIdx(idx)}
                            onChangeText={(t) => handleNestedChange(idx, 'content', t)}
                          />
                        ) : (item.type === 'superscript' || item.type === 'subscript') ? (
                          <View style={styles.inputGroup}>
                            <TextInput
                              style={[styles.smallInput, { width: 40 }]}
                              value={item.base}
                              placeholder="Base"
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => updateItemValue(idx, { base: t })}
                            />
                            <TextInput
                              style={styles.smallInput}
                              value={item.value}
                              placeholder={item.type === 'superscript' ? "Exp" : "Idx"}
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => updateItemValue(idx, { value: t })}
                            />
                          </View>
                        ) : item.type === 'bracket' || item.type === 'operator' || item.type === 'number' ? (
                          <Text style={styles.staticLabel}>{item.value}</Text>
                        ) : (
                          <View style={{ flex: 1 }}>
                            <TextInput
                              style={styles.textInput}
                              value={item.value}
                              placeholder="Type text..."
                              multiline={true}
                              onFocus={() => setActiveIdx(idx)}
                              onChangeText={(t) => {
                                updateItemValue(idx, { value: t });
                                const vars = ['x', 'y', 'z', 'a', 'b', 'c', 'n', 'f', 'g', 'k', 'θ', 'α', 'β', 'i', 'j'];
                                const lastChar = t.slice(-1).toLowerCase();
                                if (vars.includes(lastChar) && t.length > 0) {
                                  setSuggestion({ idx, char: t.slice(-1) });
                                } else {
                                  setSuggestion(null);
                                }
                              }}
                            />
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        onPress={() => toggleNewLine(idx)}
                        style={[styles.actionBtn, item.isNewLine && styles.actionBtnActive]}
                      >
                        <SVGIcon name="return-down-back" size={12} color={item.isNewLine ? COLORS.primary : '#64748B'} />
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => removeItem(idx)} style={styles.deleteBtn}>
                        <SVGIcon name="trash" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => updateVisualGroup([...visualGroup, { type: 'text', value: '', size: 'medium', id: Math.random().toString() }])}
              style={styles.addTextBtn}
            >
              <SVGIcon name="add-circle" size={18} color={COLORS.secondary} />
              <Text style={styles.addTextBtnLabel}>Add text</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {!readOnly && (
        <View style={styles.libraryContainer}>
          <View style={styles.libraryHeader}>
            <Text style={styles.libraryTitle}>Mathematical Symbols & Tools</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {visualAssetLibrary.map((cat) => (
              <TouchableOpacity
                key={cat.category}
                onPress={() => setActiveCategory(cat.category)}
                style={[
                  styles.categoryBubble,
                  activeCategory === cat.category && styles.categoryBubbleActive
                ]}
              >
                <SVGIcon name={cat.icon} size={14} color={activeCategory === cat.category ? "#FFF" : COLORS.secondary} />
                <Text style={[styles.categoryBubbleText, activeCategory === cat.category && { color: "#FFF" }]}>
                  {cat.category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={styles.symbolsGrid}>
            {visualAssetLibrary.find(c => c.category === activeCategory)?.items.map((item: any, idx) => (
              <TouchableOpacity key={`${item.id}_${idx}`} onPress={() => addItem(item)} style={styles.symbolItem}>
                <View style={styles.symbolPreview}>
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
                    <View style={styles.symbolBar}>
                      <View style={styles.symbolBarLine} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>x</Text>
                    </View>
                  ) : item.type === 'sqrt' ? (
                    <SVGIcon name="sqrt" size={22} color="#000" />
                  ) : item.type === 'variable' ? (
                    <Text style={styles.symbolVariable}>{item.value || item.id}</Text>
                  ) : item.type === 'operator' ? (
                    <Text style={styles.symbolOperator}>{item.value || item.id}</Text>
                  ) : (
                    <Text style={styles.symbolPlain}>{item.value || item.id}</Text>
                  )}
                </View>
                <Text style={styles.symbolLabel} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%' },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 8, marginTop: 10 },
  canvasContainer: {
    gap: 10,
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  canvas: {
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
  },
  placeholderText: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic', flex: 1, textAlign: 'center' },
  fraction: { alignItems: 'center', minWidth: 20, marginHorizontal: 2 },
  fractionLine: { height: 1.5, backgroundColor: '#000', width: '100%' },
  mathText: { fontSize: 16, fontWeight: '600', color: '#000' },
  mixedFraction: { flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: 2 },
  wholeNumber: { fontSize: 18, fontWeight: '600', color: '#000' },
  fractionSmall: { alignItems: 'center', minWidth: 18 },
  mathTextSmall: { fontSize: 14, fontWeight: '600', color: '#000' },
  sqrtContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 },
  sqrtContent: { borderTopWidth: 1.5, borderTopColor: '#000', paddingTop: 2, minWidth: 16, marginLeft: -2 },
  italic: { fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  bracketText: { fontSize: 28, fontWeight: '300', color: '#000', marginHorizontal: 1, marginTop: -2 },
  mapping: { alignItems: 'center', minWidth: 20, marginHorizontal: 4 },
  arrowText: { fontSize: 16, fontWeight: '900', color: '#000', marginTop: -2, marginBottom: -2 },
  vector: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 },
  vectorBracket: { fontSize: 28, fontWeight: '300', color: '#000', marginTop: -2 },
  vectorContent: { alignItems: 'center', minWidth: 16, marginHorizontal: 1 },
  matrix: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 },
  matrixBracket: { fontSize: 32, fontWeight: '300', color: '#000', marginTop: -4 },
  matrixCells: { paddingHorizontal: 2, alignItems: 'center' },
  barContainer: { alignItems: 'center', marginHorizontal: 2 },
  barLine: { height: 1.5, backgroundColor: '#000', width: '100%', marginBottom: 1 },
  superscriptContainer: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 1 },
  superscriptText: { fontSize: 13, fontWeight: '700', color: '#000', marginTop: -4 },
  subscriptContainer: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 1 },
  subscriptText: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: -3 },
  operatorText: { fontSize: 18, fontWeight: '600', color: '#000', marginHorizontal: 4 },
  plainText: { fontSize: 16, fontWeight: '600', color: '#000', lineHeight: 24 },
  itemEditorRow: {
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.secondary + '15',
    ...SHADOWS.small
  },
  itemEditorMain: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  itemBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
  itemBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  inputGroup: { flexDirection: 'row', gap: 2, alignItems: 'center', flex: 1 },
  smallInput: { fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6, flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 0 },
  inputDivider: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' },
  matrixInput: { fontSize: 9, fontWeight: '700', backgroundColor: '#F8FAFC', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 6, width: 35, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'center' },
  fullWidthInput: { fontSize: 14, fontWeight: '700', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, flex: 1, borderWidth: 1, borderColor: '#E2E8F0' },
  staticLabel: { fontSize: 22, fontWeight: '400', color: '#000', textAlign: 'center', width: 30 },
  textInput: { fontSize: 16, fontWeight: '600', color: '#1E293B', flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 2 },
  actionBtn: { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 6, width: 26, alignItems: 'center', justifyContent: 'center' },
  actionBtnActive: { backgroundColor: COLORS.primary + '20' },
  deleteBtn: { padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6, width: 26, alignItems: 'center', justifyContent: 'center' },
  addTextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary + '10', padding: 10, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.secondary },
  addTextBtnLabel: { fontWeight: '600', color: COLORS.secondary, fontSize: 13 },
  libraryContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...SHADOWS.medium,
    marginBottom: 20
  },
  libraryHeader: { padding: 15, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  libraryTitle: { fontWeight: '700', color: '#1E293B' },
  categoryScroll: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  categoryBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  categoryBubbleActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  categoryBubbleText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  categoryBubbleTextActive: { color: "#FFF" },
  symbolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 15 },
  symbolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '22%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4
  },
  symbolPreview: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  symbolBar: { alignItems: 'center' },
  symbolBarLine: { height: 2, backgroundColor: '#000', width: 12, marginBottom: 1 },
  symbolVariable: { fontSize: 22, fontWeight: '600', fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: COLORS.primary },
  symbolOperator: { fontSize: 22, fontWeight: '600', color: COLORS.secondary },
  symbolPlain: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  symbolLabel: { fontSize: 9, color: "#64748B", fontWeight: '700', textAlign: 'center', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  suggestionPopup: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 20,
  },
  suggestionActions: {
    gap: 12,
  },
  suggestionChoice: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  suggestionChoicePrimary: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  suggestionChoiceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  suggestionChoiceTextPrimary: {
    color: COLORS.primary,
  },
  suggestionChoiceSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  suggestionChoiceSubPrimary: {
    fontSize: 11,
    color: COLORS.primary,
    opacity: 0.7,
    fontWeight: '600',
    marginTop: 2,
  }
});

export default MathCanvas;
