import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export interface UseLiveLocationOptions {
  /** If true, continuously stream live position updates (default: false) */
  enableLiveTracking?: boolean;
  /** Desired accuracy for Native Expo Location (default: Location.Accuracy.High) */
  accuracy?: Location.Accuracy;
  /** Minimum distance in meters between position updates when live tracking */
  distanceInterval?: number;
  /** Minimum time interval in milliseconds between updates */
  timeInterval?: number;
  /** Auto request position on mount (default: true) */
  autoStart?: boolean;
}

export function useLiveLocation(options: UseLiveLocationOptions = {}) {
  const {
    enableLiveTracking = false,
    accuracy = Location.Accuracy.High,
    distanceInterval = 5,
    timeInterval = 3000,
    autoStart = true,
  } = options;

  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const webWatchIdRef = useRef<number | null>(null);

  /**
   * Request Location Permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === "web") {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setErrorMsg("Geolocation is not supported by this web browser.");
          setPermissionGranted(false);
          return false;
        }
        setPermissionGranted(true);
        return true;
      }

      // Check device GPS hardware status
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setErrorMsg("Location services (GPS) are disabled on your device.");
        setPermissionGranted(false);
        return false;
      }

      // Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Location permission was denied.");
        setPermissionGranted(false);
        return false;
      }

      setPermissionGranted(true);
      setErrorMsg(null);
      return true;
    } catch (err: any) {
      console.error("Error requesting location permissions:", err);
      setErrorMsg(err?.message || "Failed to request location permissions.");
      setPermissionGranted(false);
      return false;
    }
  }, []);

  /**
   * Fetch a single one-time current live location snapshot
   */
  const fetchCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setLoading(false);
        return null;
      }

      // Web Implementation
      if (Platform.OS === "web") {
        const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => {
              // Try again with fallback accuracy if high accuracy failed
              navigator.geolocation.getCurrentPosition(
                (fallbackPos) => resolve(fallbackPos.coords),
                (finalErr) => reject(finalErr),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
              );
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
          );
        });

        const newLoc: LocationData = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy || 0,
          altitude: coords.altitude,
          heading: coords.heading,
          speed: coords.speed,
          timestamp: Date.now(),
        };

        setLocation(newLoc);
        setErrorMsg(null);
        return newLoc;
      }

      // Native Expo Implementation (Android / iOS)
      let loc: Location.LocationObject | null = null;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy });
      } catch (highErr) {
        console.warn("High accuracy location request failed, trying Balanced accuracy:", highErr);
        try {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (balErr) {
          console.warn("Balanced accuracy failed, trying last known position:", balErr);
          loc = await Location.getLastKnownPositionAsync();
        }
      }

      if (!loc || !loc.coords) {
        throw new Error("Unable to obtain GPS location fix.");
      }

      const newLoc: LocationData = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
        altitude: loc.coords.altitude,
        heading: loc.coords.heading,
        speed: loc.coords.speed,
        timestamp: loc.timestamp,
      };

      setLocation(newLoc);
      setErrorMsg(null);
      return newLoc;
    } catch (err: any) {
      console.error("Error fetching location:", err);
      const msg = err?.message || "Failed to acquire GPS location.";
      setErrorMsg(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [accuracy, requestPermissions]);

  /**
   * Start continuous live tracking updates
   */
  const startLiveTracking = useCallback(async () => {
    stopLiveTracking();
    setLoading(true);

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setLoading(false);
      return;
    }

    try {
      if (Platform.OS === "web") {
        webWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 0,
              altitude: pos.coords.altitude,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            });
            setErrorMsg(null);
            setLoading(false);
          },
          (err) => {
            console.warn("Web watchPosition error:", err);
            setErrorMsg(err.message || "Error watching live GPS location.");
            setLoading(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
        );
        return;
      }

      // Native Expo watchPositionAsync
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy,
          distanceInterval,
          timeInterval,
        },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy || 0,
            altitude: loc.coords.altitude,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
          });
          setErrorMsg(null);
          setLoading(false);
        }
      );
    } catch (err: any) {
      console.error("Error starting live tracking:", err);
      setErrorMsg(err?.message || "Could not start live GPS tracking.");
      setLoading(false);
    }
  }, [accuracy, distanceInterval, requestPermissions, timeInterval]);

  /**
   * Stop continuous live tracking updates
   */
  const stopLiveTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (webWatchIdRef.current !== null && Platform.OS === "web") {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!autoStart) return;

    if (enableLiveTracking) {
      startLiveTracking();
    } else {
      fetchCurrentLocation();
    }

    return () => {
      stopLiveTracking();
    };
  }, [autoStart, enableLiveTracking, fetchCurrentLocation, startLiveTracking, stopLiveTracking]);

  return {
    location,
    loading,
    errorMsg,
    permissionGranted,
    refetchLocation: fetchCurrentLocation,
    startLiveTracking,
    stopLiveTracking,
  };
}
