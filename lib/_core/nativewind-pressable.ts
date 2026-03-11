// NativeWind + Pressable/TouchableOpacity: className can swallow onPress or cause Web crashes.
// Disable className mapping globally for interactive components.
import { Pressable, TouchableOpacity } from "react-native";
import { remapProps } from "nativewind";

remapProps(Pressable, { className: false });
remapProps(TouchableOpacity, { className: false });
