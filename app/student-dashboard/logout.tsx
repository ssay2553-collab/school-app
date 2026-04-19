import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useEffect } from "react";
import { ActivityIndicator, View, Platform, Alert } from "react-native";
import { COLORS } from "../../constants/theme";
import { auth } from "../../firebaseConfig";

export default function LogoutScreen() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await signOut(auth);
        if (Platform.OS === 'web') {
          window.location.href = "/";
        } else {
          router.replace("/");
        }
      } catch (err) {
        console.error("Logout error", err);
        router.back();
      }
    };

    performLogout();
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
