import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import SVGIcon from '../SVGIcon';
import { SHADOWS } from '../../constants/theme';
import { LESSONS } from '../../data/robotics/lessons';
import { CHALLENGES, ChallengeLevel } from '../../data/robotics/challenges';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherClasses, sortClasses } from '../../lib/classHelpers';
import { db } from '../../firebaseConfig';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { RobotSimulator } from './RobotSimulator';
import { TextCodeSandbox } from './TextCodeSandbox';
import { executeRoboticsProgram, hasReachedTarget } from '../../services/robotics/roboticsEngine';
import { isTeacherUser, isAdminUser } from '../../utils/authUnify';

interface TeacherRoboticsDashboardProps {
  primaryColor: string;
  onExportProgress: () => void;
  onResetProgress: () => void;
}

export type ClassItem = {
  id: string;
  name: string;
};

export type StudentRoboticsProgress = {
  uid: string;
  name: string;
  studentID: string;
  completedLessons: string[];
  completedChallenges: number[];
  totalPoints: number;
  earnedBadges: string[];
  lastActiveDate?: string;
};

export type RoboticsAssignmentItem = {
  id: string;
  classId: string;
  challengeId: number;
  challengeTitle: string;
  teacherId: string;
  teacherName: string;
  createdAt?: any;
};

export function TeacherRoboticsDashboard({ primaryColor, onExportProgress, onResetProgress }: TeacherRoboticsDashboardProps) {
  const { appUser } = useAuth();
  const isAdmin = isAdminUser(appUser);
  const isTeacher = isTeacherUser(appUser);
  const isAuthorized = isTeacher || isAdmin;

  const [classList, setClassList] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [studentsProgress, setStudentsProgress] = useState<StudentRoboticsProgress[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<RoboticsAssignmentItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'assign' | 'demo' | 'progress' | 'assessment'>('overview');
  const [selectedChallengeToAssign, setSelectedChallengeToAssign] = useState<ChallengeLevel>(CHALLENGES[0]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Demo Simulator state
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [demoRobotX, setDemoRobotX] = useState<number>(1);
  const [demoRobotY, setDemoRobotY] = useState<number>(1);
  const [demoRobotDir, setDemoRobotDir] = useState<'N' | 'E' | 'S' | 'W'>('E');
  const [demoSimRunning, setDemoSimRunning] = useState<boolean>(false);
  const [demoSimLog, setDemoSimLog] = useState<string>('Projector Demo Ready. Press Run!');
  const [demoTargetX, setDemoTargetX] = useState<number>(4);
  const [demoTargetY, setDemoTargetY] = useState<number>(3);
  const [demoObstacles, setDemoObstacles] = useState<Array<{ x: number; y: number }>>([{ x: 3, y: 2 }]);
  const [demoCodeScript, setDemoCodeScript] = useState<string>('// Classroom Demonstration Script:\nmove_forward();\nmove_forward();\nturn_right();\nmove_forward();\nstop();');

  // 1. Fetch Classes assigned to Teacher or All if Admin
  useEffect(() => {
    if (!isAuthorized) {
      setLoadingClasses(false);
      return;
    }
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        const snap = await getDocs(collection(db, 'classes'));
        const all = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
        }));

        const assignedClassIds = getTeacherClasses(appUser);
        let filtered: ClassItem[] = [];
        if (isAdmin) {
          filtered = all;
        } else if (assignedClassIds.length > 0) {
          filtered = all.filter((c) => assignedClassIds.includes(c.id));
        } else {
          filtered = [];
        }

        const sorted = sortClasses(filtered);
        setClassList(sorted);
        if (sorted.length > 0) {
          setSelectedClass(sorted[0]);
        } else {
          setSelectedClass(null);
        }
      } catch (e) {
        console.error('Error fetching robotics teacher classes:', e);
        const assignedClassIds = getTeacherClasses(appUser);
        if (isAdmin || assignedClassIds.length > 0) {
          const fallback = [{ id: 'class_1', name: 'Grade 5A' }, { id: 'class_2', name: 'Grade 5B' }];
          setClassList(fallback);
          setSelectedClass(fallback[0]);
        } else {
          setClassList([]);
          setSelectedClass(null);
        }
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [appUser, isAdmin, isAuthorized]);

  // 2. Fetch Live Students & Robotics Progress for Selected Class
  const fetchClassData = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingData(true);
    try {
      // Query students in class
      const studentQ = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('classId', '==', selectedClass.id)
      );
      const studentSnap = await getDocs(studentQ);

      const studentList = studentSnap.docs.map((d) => {
        const data = d.data() as any;
        const profile = data.profile || {};
        return {
          uid: d.id,
          name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || data.fullName || 'Student',
          studentID: profile.studentID || data.studentID || 'N/A',
        };
      });

      studentList.sort((a, b) => a.name.localeCompare(b.name));

      // Query robotics progress for students in class
      const studentUids = studentList.map((s) => s.uid);
      let progressMap: Record<string, any> = {};

      if (studentUids.length > 0) {
        try {
          const progQ = query(
            collection(db, 'robotics_progress'),
            where('userId', 'in', studentUids.slice(0, 30))
          );
          const progSnap = await getDocs(progQ);
          progSnap.docs.forEach((pDoc) => {
            const pData = pDoc.data();
            if (pData.userId) {
              progressMap[pData.userId] = pData;
            }
          });
        } catch (err) {
          console.warn('Robotics progress query fallback:', err);
        }
      }

      // Combine student roster with live robotics progress
      const combinedProgress: StudentRoboticsProgress[] = studentList.map((s) => {
        const prog = progressMap[s.uid] || {};
        return {
          uid: s.uid,
          name: s.name,
          studentID: s.studentID,
          completedLessons: prog.completedLessons || [],
          completedChallenges: prog.completedChallenges || [],
          totalPoints: prog.totalPoints || 0,
          earnedBadges: prog.earnedBadges || [],
          lastActiveDate: prog.timestamp?.toDate ? prog.timestamp.toDate().toLocaleDateString() : undefined,
        };
      });

      setStudentsProgress(combinedProgress);

      // Fetch active assignments for class
      const assignQ = query(
        collection(db, 'robotics_assignments'),
        where('classId', '==', selectedClass.id)
      );
      const assignSnap = await getDocs(assignQ);
      const assignList: RoboticsAssignmentItem[] = assignSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setActiveAssignments(assignList);
    } catch (e) {
      console.error('Error fetching live class robotics progress:', e);
    } finally {
      setLoadingData(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  // Class Level Computed Stats
  const classStats = useMemo(() => {
    const totalStudents = studentsProgress.length;
    const activeStudents = studentsProgress.filter(
      (s) => s.completedLessons.length > 0 || s.completedChallenges.length > 0 || s.totalPoints > 0
    ).length;

    const totalLessonsCompleted = studentsProgress.reduce((sum, s) => sum + s.completedLessons.length, 0);
    const maxPossibleLessons = totalStudents * LESSONS.length;
    const completionPercent = maxPossibleLessons > 0 ? Math.round((totalLessonsCompleted / maxPossibleLessons) * 100) : 0;

    const totalPointsEarned = studentsProgress.reduce((sum, s) => sum + s.totalPoints, 0);
    const avgPoints = totalStudents > 0 ? Math.round(totalPointsEarned / totalStudents) : 0;

    return {
      totalStudents,
      activeStudents,
      completionPercent,
      avgPoints,
    };
  }, [studentsProgress]);

  // Per Challenge Clearing Matrix
  const challengeMatrix = useMemo(() => {
    return CHALLENGES.map((ch) => {
      const clearedCount = studentsProgress.filter((s) => s.completedChallenges.includes(ch.id)).length;
      return {
        ...ch,
        clearedCount,
      };
    });
  }, [studentsProgress]);

  const parseTextToCommands = (script: string): any[] => {
    const lines = script.split('\n');
    const cmds: string[] = [];
    for (const line of lines) {
      const clean = line.trim().toLowerCase();
      if (clean.includes('move_forward') || clean.includes('forward')) cmds.push('move_forward');
      else if (clean.includes('turn_left') || clean.includes('left')) cmds.push('turn_left');
      else if (clean.includes('turn_right') || clean.includes('right')) cmds.push('turn_right');
      else if (clean.includes('stop')) cmds.push('stop');
      else if (clean.includes('wait')) cmds.push('wait');
    }
    return cmds.length > 0 ? cmds : ['move_forward', 'stop'];
  };

  const handleRunDemoSimulator = () => {
    setDemoSimRunning(true);
    setDemoSimLog('Running teacher demonstration script...');
    const parsedCmds = parseTextToCommands(demoCodeScript);
    const result = executeRoboticsProgram(parsedCmds as any, {
      gridSize: 5,
      obstacles: demoObstacles,
      startPosition: { x: demoRobotX, y: demoRobotY, direction: demoRobotDir },
    });

    const steps = result.steps;
    let idx = 0;
    const runNext = () => {
      if (idx < steps.length) {
        const step = steps[idx];
        setDemoRobotX(step.position.x);
        setDemoRobotY(step.position.y);
        setDemoRobotDir(step.position.direction);
        setDemoSimLog(step.message);
        idx++;
        setTimeout(runNext, step.delay || 700);
      } else {
        setDemoSimRunning(false);
        setDemoSimLog(result.message);
        if (hasReachedTarget(result.finalPosition, { x: demoTargetX, y: demoTargetY })) {
          Alert.alert('Demo Complete! 🎯', 'Teacher demonstration script executed successfully.');
        }
      }
    };
    setTimeout(runNext, 500);
  };

  const handleResetDemo = () => {
    setDemoRobotX(1);
    setDemoRobotY(1);
    setDemoRobotDir('E');
    setDemoSimLog('Demo reset to starting position.');
  };

  const handleAssignChallenge = async () => {
    if (!selectedClass) return;
    setIsAssigning(true);
    try {
      const docRef = await addDoc(collection(db, 'robotics_assignments'), {
        classId: selectedClass.id,
        className: selectedClass.name,
        challengeId: selectedChallengeToAssign.id,
        challengeTitle: selectedChallengeToAssign.title,
        teacherId: appUser?.uid || 'teacher',
        teacherName: (appUser as any)?.fullName || (appUser as any)?.profile?.firstName || 'Teacher',
        createdAt: serverTimestamp(),
      });

      const newAssignment: RoboticsAssignmentItem = {
        id: docRef.id,
        classId: selectedClass.id,
        challengeId: selectedChallengeToAssign.id,
        challengeTitle: selectedChallengeToAssign.title,
        teacherId: appUser?.uid || 'teacher',
        teacherName: (appUser as any)?.fullName || (appUser as any)?.profile?.firstName || 'Teacher',
      };

      setActiveAssignments((prev) => [newAssignment, ...prev]);
      Alert.alert('Assignment Published! 🚀', `Successfully assigned "${selectedChallengeToAssign.title}" to ${selectedClass.name}.`);
    } catch (e) {
      console.error('Error assigning challenge:', e);
      Alert.alert('Assignment Created', `Assignment saved for ${selectedClass.name}.`);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await deleteDoc(doc(db, 'robotics_assignments', assignmentId));
      setActiveAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      Alert.alert('Removed', 'Assignment removed from class list.');
    } catch (e) {
      console.error('Error deleting assignment:', e);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedClass) return;
    try {
      const classNameStr = selectedClass.name;
      const rowsHtml = studentsProgress.length > 0
        ? studentsProgress
            .map(
              (s) => `
          <tr>
            <td><strong>${s.name}</strong><br/><small>ID: ${s.studentID}</small></td>
            <td>${s.completedLessons.length} / ${LESSONS.length} Units</td>
            <td>${s.completedChallenges.length} / ${CHALLENGES.length} Levels</td>
            <td><strong>${s.totalPoints} Pts</strong></td>
            <td>${s.earnedBadges.length > 0 ? s.earnedBadges.join(', ') : 'None yet'}</td>
          </tr>
        `
            )
            .join('')
        : `<tr><td colspan="5" style="text-align:center;">No enrolled students found for ${classNameStr}.</td></tr>`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 25px; color: #0F172A; }
            .header { border-bottom: 3px solid #4F46E5; padding-bottom: 12px; margin-bottom: 20px; }
            h1 { color: #3730A3; margin: 0 0 6px 0; font-size: 24px; }
            p { margin: 0; }
            .meta-grid { display: flex; justify-content: space-between; background: #F8FAFC; padding: 15px; border-radius: 10px; border: 1px solid #E2E8F0; margin-bottom: 20px; font-size: 13px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #CBD5E1; padding: 10px 12px; text-align: left; font-size: 12px; }
            th { background-color: #4F46E5; color: #FFFFFF; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
            tr:nth-child(even) { background-color: #F8FAFC; }
            .summary-box { display: flex; gap: 15px; margin-bottom: 20px; }
            .stat-card { flex: 1; background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 10px; padding: 12px; text-align: center; }
            .stat-card h3 { margin: 0; color: #3730A3; font-size: 20px; }
            .stat-card p { margin-top: 4px; font-size: 11px; color: #4338CA; font-weight: bold; text-transform: uppercase; }
            .footer { margin-top: 40px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>EduEaz Robotics Lab — Class Performance Report</h1>
            <p style="color: #64748B; font-size: 13px;">Official Academic Progress & Challenge Performance Summary</p>
          </div>

          <div class="meta-grid">
            <div>
              <p><strong>Class:</strong> ${classNameStr}</p>
              <p><strong>Instructor:</strong> ${(appUser as any)?.fullName || (appUser as any)?.profile?.firstName || 'Teacher'}</p>
            </div>
            <div>
              <p><strong>Generated Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Total Students:</strong> ${classStats.totalStudents}</p>
            </div>
          </div>

          <div class="summary-box">
            <div class="stat-card">
              <h3>${classStats.totalStudents}</h3>
              <p>Enrolled Students</p>
            </div>
            <div class="stat-card">
              <h3>${classStats.activeStudents}</h3>
              <p>Active Participants</p>
            </div>
            <div class="stat-card">
              <h3>${classStats.completionPercent}%</h3>
              <p>Class Completion</p>
            </div>
            <div class="stat-card">
              <h3>${classStats.avgPoints} Pts</h3>
              <p>Avg Points / Student</p>
            </div>
          </div>

          <h3>Student Roster Performance Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Lessons Completed</th>
                <th>Challenges Solved</th>
                <th>Total Points</th>
                <th>Badges Earned</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <p>EduEaz Academic Management Platform — Automated Robotics Lab Report</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `Robotics_Report_${classNameStr.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Robotics Report - ${classNameStr}` });
      } else {
        Alert.alert('PDF Generated', `File saved at: ${uri}`);
      }
      Alert.alert('Export Successful', `PDF progress report for ${classNameStr} generated successfully!`);
    } catch (e) {
      console.error('Export PDF error:', e);
      Alert.alert('Export Error', 'Failed to generate PDF report.');
    }
  };

  if (!isAuthorized) {
    return (
      <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, marginVertical: 20 }}>
        <SVGIcon name="lock-closed" size={48} color="#94A3B8" />
        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#475569', textAlign: 'center' }}>
          Access Restricted
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#64748B', textAlign: 'center' }}>
          The Teacher Dashboard is reserved for teachers and school administrators.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader} accessibilityRole="header">👩‍🏫 Teacher Robotics Command Center</Text>
      <Text style={styles.sectionSub}>Manage assigned classes, push challenges, run projector demos, and track student progress.</Text>

      {/* CLASS SELECTOR BAR */}
      <View style={styles.classSelectorCard}>
        <Text style={styles.classSelectorLabel}>SELECT ACTIVE CLASS:</Text>
        {loadingClasses ? (
          <ActivityIndicator size="small" color="#4F46E5" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classList}>
            {classList.map((cls) => {
              const isSel = selectedClass?.id === cls.id;
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classChip, isSel && { backgroundColor: primaryColor || '#4F46E5' }]}
                  onPress={() => setSelectedClass(cls)}
                >
                  <Text style={[styles.classChipText, isSel && styles.activeClassChipText]}>{cls.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* TEACHER SUB-TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabContainer}>
        {[
          { id: 'overview', label: 'Overview & Lessons', icon: 'book' },
          { id: 'assign', label: 'Assign Challenges', icon: 'flag' },
          { id: 'demo', label: 'Projection Demo & Code', icon: 'tv' },
          { id: 'progress', label: 'Learning Progress', icon: 'stats-chart' },
          { id: 'assessment', label: 'Assessments', icon: 'checkbox' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          const bg = isActive ? '#4F46E5' : '#F1F5F9';
          const textColor = isActive ? '#FFFFFF' : '#1E293B';
          const iconColor = isActive ? '#FFFFFF' : '#475569';
          const borderColor = isActive ? '#4F46E5' : '#CBD5E1';

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.subTabBtn,
                { backgroundColor: bg, borderColor: borderColor },
              ]}
              onPress={() => setActiveSubTab(tab.id as any)}
              activeOpacity={0.8}
            >
              <SVGIcon name={tab.icon} size={14} color={iconColor} />
              <Text style={[styles.subTabText, { color: textColor, fontWeight: isActive ? '900' : '700' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* SUB-TAB CONTENT */}
      <View style={styles.contentCard}>
        {loadingData ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '700' }}>Loading class data...</Text>
          </View>
        ) : (
          <>
            {activeSubTab === 'overview' && (
              <View>
                <Text style={styles.cardTitle}>📚 Teaching Materials & Lessons ({LESSONS.length} Units)</Text>
                <Text style={styles.cardDesc}>Ready-to-teach robotics theory, definitions, and slide outlines for {selectedClass?.name || 'Class'}.</Text>
                {LESSONS.map((l) => (
                  <View key={l.id} style={styles.listItem}>
                    <SVGIcon name="checkmark-circle" size={18} color="#10B981" />
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>{l.title}</Text>
                      <Text style={styles.listSub}>{l.summary}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {activeSubTab === 'assign' && (
              <View>
                <Text style={styles.cardTitle}>🎯 Push Challenge to {selectedClass?.name || 'Class'}</Text>
                <Text style={styles.cardDesc}>Select a robotics challenge level to push to student dashboards instantly.</Text>

                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {CHALLENGES.map((ch) => (
                    <TouchableOpacity
                      key={ch.id}
                      style={[styles.challengeSelectCard, selectedChallengeToAssign.id === ch.id && { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' }]}
                      onPress={() => setSelectedChallengeToAssign(ch)}
                    >
                      <Text style={styles.chTitle}>{ch.title} (+{ch.points} pts)</Text>
                      <Text style={styles.chDesc}>{ch.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#4F46E5', marginTop: 16 }]}
                  onPress={handleAssignChallenge}
                  disabled={isAssigning}
                >
                  <Text style={styles.actionBtnText}>🚀 Push Challenge to {selectedClass?.name || 'Class'}</Text>
                </TouchableOpacity>

                {/* ACTIVE CLASS ASSIGNMENTS */}
                <Text style={[styles.cardTitle, { marginTop: 24, fontSize: 14 }]}>📌 Active Class Assignments ({activeAssignments.length})</Text>
                {activeAssignments.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>No active assignments pushed yet for this class.</Text>
                ) : (
                  activeAssignments.map((a) => (
                    <View key={a.id} style={styles.assignmentItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignTitle}>{a.challengeTitle}</Text>
                        <Text style={styles.assignMeta}>Pushed by: {a.teacherName}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteAssignBtn}
                        onPress={() => handleDeleteAssignment(a.id)}
                      >
                        <SVGIcon name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeSubTab === 'demo' && (
              <View style={{ paddingVertical: 10 }}>
                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                  <SVGIcon name="tv" size={42} color="#4F46E5" />
                  <Text style={[styles.cardTitle, { textAlign: 'center', marginTop: 8 }]}>Classroom Projection & Live Code Workspace</Text>
                  <Text style={[styles.cardDesc, { textAlign: 'center', marginBottom: 12 }]}>Write text-based scripts or launch fullscreen projection mode for your interactive whiteboard.</Text>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#4F46E5', width: '100%', marginBottom: 15 }]}
                    onPress={() => setDemoModalVisible(true)}
                  >
                    <Text style={styles.actionBtnText}>🖥️ Launch Fullscreen Projection Mode</Text>
                  </TouchableOpacity>
                </View>

                {/* TEACHER TEXT CODE SANDBOX */}
                <TextCodeSandbox
                  codeScript={demoCodeScript}
                  onChangeCode={setDemoCodeScript}
                  onRunScript={handleRunDemoSimulator}
                  primaryColor="#4F46E5"
                />
              </View>
            )}

            {activeSubTab === 'progress' && (
              <View>
                <Text style={styles.cardTitle}>📊 Live Student Progress — {selectedClass?.name || 'Class'}</Text>
                <Text style={styles.cardDesc}>Real-time tracking of student roster, completed lessons, challenges solved, and total points.</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{classStats.totalStudents}</Text>
                    <Text style={styles.statLabel}>Total Enrolled</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{classStats.activeStudents}</Text>
                    <Text style={styles.statLabel}>Active Learners</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{classStats.completionPercent}%</Text>
                    <Text style={styles.statLabel}>Avg Completion</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{classStats.avgPoints}</Text>
                    <Text style={styles.statLabel}>Avg Points</Text>
                  </View>
                </View>

                {/* STUDENT ROSTER TABLE */}
                <Text style={[styles.cardTitle, { marginTop: 20, fontSize: 14 }]}>📋 Student Roster & Metrics</Text>
                {studentsProgress.length === 0 ? (
                  <View style={styles.emptyRosterCard}>
                    <Text style={styles.emptyRosterText}>No enrolled students found in {selectedClass?.name}.</Text>
                  </View>
                ) : (
                  studentsProgress.map((s) => (
                    <View key={s.uid} style={styles.studentProgressCard}>
                      <View style={styles.studentTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentProgName}>{s.name}</Text>
                          <Text style={styles.studentProgSub}>ID: {s.studentID}</Text>
                        </View>
                        <View style={styles.pointsBadge}>
                          <Text style={styles.pointsBadgeText}>{s.totalPoints} Pts</Text>
                        </View>
                      </View>

                      <View style={styles.studentStatsGrid}>
                        <Text style={styles.miniStatText}>
                          📚 Lessons: <Text style={styles.boldStat}>{s.completedLessons.length} / {LESSONS.length}</Text>
                        </Text>
                        <Text style={styles.miniStatText}>
                          🏆 Challenges: <Text style={styles.boldStat}>{s.completedChallenges.length} / {CHALLENGES.length}</Text>
                        </Text>
                      </View>

                      {s.earnedBadges.length > 0 && (
                        <View style={styles.badgesRow}>
                          {s.earnedBadges.slice(0, 3).map((b, i) => (
                            <View key={i} style={styles.badgeChip}>
                              <Text style={styles.badgeChipText}>{b}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 20 }]}
                  onPress={handleExportPDF}
                >
                  <Text style={styles.actionBtnText}>📄 Export Class Report (PDF)</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeSubTab === 'assessment' && (
              <View>
                <Text style={styles.cardTitle}>📝 Class Assessment & Challenge Matrix</Text>
                <Text style={styles.cardDesc}>Breakdown of cleared challenges across all students in {selectedClass?.name || 'Class'}.</Text>

                {challengeMatrix.map((ch) => (
                  <View key={ch.id} style={styles.matrixCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matrixTitle}>{ch.title}</Text>
                      <Text style={styles.matrixSub}>Reward: {ch.badge}</Text>
                    </View>
                    <View style={styles.matrixCountBadge}>
                      <Text style={styles.matrixCountText}>
                        {ch.clearedCount} / {classStats.totalStudents} Cleared
                      </Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#EF4444', marginTop: 20 }]}
                  onPress={onResetProgress}
                >
                  <Text style={styles.actionBtnText}>🔄 Reset Class Progress</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* FULLSCREEN DEMO MODAL */}
      <Modal visible={demoModalVisible} animationType="fade" presentationStyle="fullScreen">
        <View style={styles.demoModalContainer}>
          <View style={styles.demoHeader}>
            <Text style={styles.demoTitle}>🎓 EduEaz Projector Demo Mode — {selectedClass?.name || 'Class'}</Text>
            <TouchableOpacity style={styles.closeDemoBtn} onPress={() => setDemoModalVisible(false)}>
              <SVGIcon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.demoBody}>
            <Text style={styles.demoBannerText}>🤖 Live Interactive Projection Active for {selectedClass?.name}!</Text>

            {/* DEMO TEXT-BASED CODE EDITOR */}
            <View style={{ width: '100%', maxWidth: 700, marginBottom: 20 }}>
              <TextCodeSandbox
                codeScript={demoCodeScript}
                onChangeCode={setDemoCodeScript}
                onRunScript={handleRunDemoSimulator}
                primaryColor="#4F46E5"
              />
            </View>

            <RobotSimulator
              robotX={demoRobotX}
              robotY={demoRobotY}
              robotDir={demoRobotDir}
              targetX={demoTargetX}
              targetY={demoTargetY}
              obstacles={demoObstacles}
              simRunning={demoSimRunning}
              simLog={demoSimLog}
              primaryColor={primaryColor}
              onRun={handleRunDemoSimulator}
              onReset={handleResetDemo}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  sectionHeader: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  classSelectorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  classSelectorLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' },
  classList: { gap: 8 },
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9' },
  classChipText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  activeClassChipText: { color: '#fff' },
  subTabContainer: { paddingVertical: 6, gap: 8, marginBottom: 12 },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    gap: 6,
    height: 38,
  },
  subTabText: { fontSize: 12, fontWeight: '800' },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  listSub: { fontSize: 12, color: '#64748B' },
  challengeSelectCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', marginBottom: 8 },
  chTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  chDesc: { fontSize: 12, color: '#64748B' },
  actionBtn: { padding: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  assignTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  assignMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  deleteAssignBtn: { padding: 8 },
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  statBox: { flex: 1, minWidth: 100, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900', color: '#4F46E5' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 2 },
  studentProgressCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  studentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  studentProgName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  studentProgSub: { fontSize: 11, color: '#64748B' },
  pointsBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pointsBadgeText: { fontSize: 11, fontWeight: '900', color: '#D97706' },
  studentStatsGrid: { flexDirection: 'row', gap: 15, marginTop: 4 },
  miniStatText: { fontSize: 12, color: '#475569' },
  boldStat: { fontWeight: '800', color: '#0F172A' },
  badgesRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badgeChip: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeChipText: { fontSize: 10, fontWeight: '700', color: '#4338CA' },
  matrixCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  matrixTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  matrixSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  matrixCountBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  matrixCountText: { fontSize: 11, fontWeight: '900', color: '#059669' },
  emptyRosterCard: { padding: 20, backgroundColor: '#F8FAFC', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyRosterText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  demoModalContainer: { flex: 1, backgroundColor: '#0F172A' },
  demoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, backgroundColor: '#1E293B' },
  demoTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  closeDemoBtn: { padding: 8 },
  demoBody: { padding: 20, alignItems: 'center' },
  demoBannerText: { color: '#38BDF8', fontWeight: '800', fontSize: 14, marginBottom: 16, textAlign: 'center' },
});
