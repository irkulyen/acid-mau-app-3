import { Pressable, View, type PressableProps, type ViewStyle, type StyleProp } from "react-native";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TouchableProps extends Omit<PressableProps, "style"> {
  /**
   * Tailwind className — applied to a wrapper View (NOT to Pressable, which has className disabled by NativeWind).
   */
  className?: string;
  /**
   * Style prop (can be object, array, or function).
   */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /**
   * Disable button interaction.
   */
  disabled?: boolean;
}

/**
 * Touchable component that works on both Web and Native.
 * 
 * IMPORTANT: NativeWind disables className on Pressable globally.
 * This component wraps Pressable in a View that receives className,
 * so onPress always fires on Native.
 */
export const Touchable = forwardRef<any, TouchableProps>(
  ({ onPress, disabled, className, style, children, ...props }, ref) => {
    return (
      <View className={cn(className)}>
        <Pressable
          ref={ref}
          onPress={disabled ? undefined : onPress}
          disabled={disabled}
          style={({ pressed }) => {
            // Handle style prop
            const baseStyle = typeof style === "function" ? style({ pressed }) : style;
            
            // Add pressed opacity
            const pressedStyle = pressed && !disabled ? { opacity: 0.8 } : {};
            
            return [baseStyle, pressedStyle];
          }}
          {...props}
        >
          {children}
        </Pressable>
      </View>
    );
  }
);

Touchable.displayName = "Touchable";
