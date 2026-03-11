import { PropsWithChildren, useState } from "react";
import { Text, View } from "react-native";
import { Touchable } from "@/components/ui/button";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useColors();

  return (
    <View className="bg-background">
      <Touchable
        className="flex-row items-center gap-1.5"
        onPress={() => setIsOpen((value) => !value)}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={colors.icon}
          style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
        />
        <Text className="text-base font-semibold text-foreground">{title}</Text>
      </Touchable>
      {isOpen && <View className="mt-1.5 ml-6">{children}</View>}
    </View>
  );
}
